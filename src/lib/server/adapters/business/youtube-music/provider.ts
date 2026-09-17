import * as v from 'valibot';
import {
	EntityNotFoundError,
	ProviderContractError,
	ProviderUnavailableError,
	UnsupportedLinkError,
	type MusicProvider
} from '$lib/server/business/music-provider';
import type { Album, AnyEntity, Artist, Cover, Track } from '$lib/server/domain/entity';
import type { ShareLink } from '$lib/server/domain/share-link';
import {
	InnertubeShapeError,
	InnertubeUnavailableError,
	attempt,
	largest
} from '../innertube/client';
import { describe as describeVideo } from '../innertube/oembed';
import { looselyMatches, phrase } from '../matching';

const HOST = 'music.youtube.com';

const ALBUM_ID = /^MPRE[A-Za-z0-9_-]+$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]+$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]+$/;

const SEARCH_LIMIT = 10;

const RELEASE_PREFIX = /^(?:Album|Single|EP)\s+-\s+/;

const TOPIC_SUFFIX = /\s+-\s+Topic$/;

const nonEmpty = v.pipe(v.string(), v.minLength(1));

const Thumb = v.object({
	url: nonEmpty,
	width: v.optional(v.number()),
	height: v.optional(v.number())
});

const Named = v.object({ name: nonEmpty, channel_id: v.optional(v.string()) });

const SongPage = v.object({
	basic_info: v.object({
		id: v.optional(v.string()),
		title: nonEmpty,
		author: v.optional(v.string()),
		channel_id: v.optional(v.string()),
		thumbnail: v.optional(v.array(Thumb))
	})
});

const SongHit = v.object({
	id: nonEmpty,
	title: nonEmpty,
	artists: v.optional(v.array(Named)),
	album: v.optional(v.object({ id: v.optional(v.string()), name: nonEmpty })),
	thumbnail: v.optional(v.unknown())
});

const TitledHit = v.object({ id: nonEmpty, title: nonEmpty });
const NamedHit = v.object({ id: nonEmpty, name: nonEmpty });

const Run = v.object({ text: nonEmpty, endpoint: v.optional(v.unknown()) });

const PlaylistPage = v.object({
	info: v.object({
		title: nonEmpty,
		subtitle: v.optional(v.object({ text: v.string() })),
		thumbnails: v.optional(v.array(Thumb))
	})
});

const Page = v.object({
	header: v.object({
		title: v.object({ text: nonEmpty }),
		subtitle: v.optional(v.object({ text: v.string() })),
		strapline_text_one: v.optional(v.object({ runs: v.optional(v.array(Run)) }))
	})
});

function thumbnailsOf(value: unknown): { url: string; width?: number; height?: number }[] {
	const holder = value as
		| { url?: string; width?: number; height?: number }[]
		| { contents?: unknown; image?: unknown }
		| undefined;

	if (Array.isArray(holder)) {
		return v.is(v.array(Thumb), holder) ? holder : [];
	}

	for (const nested of [holder?.contents, holder?.image]) {
		if (v.is(v.array(Thumb), nested)) return nested;
	}

	return [];
}

function toCover(value: unknown): Cover | undefined {
	const best = largest(thumbnailsOf(value));

	return best && { url: best.url, width: best.width, height: best.height };
}

function toReleaseDate(subtitle: string | undefined): Date | undefined {
	const year = subtitle?.match(/\b(\d{4})\b/)?.[1];
	if (!year) return undefined;

	const released = new Date(`${year}-01-01T00:00:00.000Z`);
	return Number.isNaN(released.getTime()) ? undefined : released;
}

function requireCover(value: unknown, what: string): Cover {
	const cover = toCover(value);
	if (!cover) {
		throw new ProviderContractError(`Unexpected YouTube Music response: ${what} has no artwork`);
	}

	return cover;
}

function parse<S extends v.GenericSchema>(schema: S, value: unknown): v.InferOutput<S> {
	const parsed = v.safeParse(schema, value);
	if (!parsed.success) {
		throw new ProviderContractError(
			`Unexpected YouTube Music response: ${v.summarize(parsed.issues)}`
		);
	}

	return parsed.output;
}

async function call<T>(what: string, run: Parameters<typeof attempt<T>>[1]): Promise<T> {
	try {
		return await attempt(what, run);
	} catch (cause) {
		if (cause instanceof InnertubeShapeError) {
			throw new EntityNotFoundError('No such entity on YouTube Music');
		}
		if (cause instanceof InnertubeUnavailableError) {
			throw new ProviderUnavailableError('YouTube Music could not be reached');
		}
		throw cause;
	}
}

async function described(id: string) {
	try {
		return await describeVideo(id);
	} catch (cause) {
		if (cause instanceof InnertubeUnavailableError) {
			throw new ProviderUnavailableError('YouTube Music could not be reached');
		}
		throw cause;
	}
}

function trackUrl(id: string): string {
	return `https://${HOST}/watch?v=${id}`;
}

function albumUrl(id: string): string {
	return `https://${HOST}/browse/${id}`;
}

function artistUrl(id: string): string {
	return `https://${HOST}/channel/${id}`;
}

function toArtist(named: v.InferOutput<typeof Named>): Artist {
	return {
		type: 'artist',
		name: named.name,
		url: named.channel_id
			? artistUrl(named.channel_id)
			: `https://${HOST}/search?q=${encodeURIComponent(named.name)}`
	};
}

export class YouTubeMusicProvider implements MusicProvider {
	readonly id = 'youtube_music';

	readonly probeUrl = 'https://music.youtube.com/watch?v=dQw4w9WgXcQ';

	supports(link: ShareLink): boolean {
		return link.host === HOST;
	}

	async fetchLinkContent(link: ShareLink): Promise<AnyEntity> {
		const url = link.url;
		const segments = link.segments;

		const video = url.searchParams.get('v');
		if (video) return this.track(video);

		const list = url.searchParams.get('list');
		if (list && PLAYLIST_ID.test(list)) return this.albumOfPlaylist(list);

		const [section, id] = segments;
		if (section === 'browse' && id && ALBUM_ID.test(id)) return this.album(id);
		if (section === 'channel' && id && CHANNEL_ID.test(id)) return this.artist(id);

		throw new UnsupportedLinkError(`Not a supported YouTube Music link: ${link}`);
	}

	async search(entity: AnyEntity): Promise<AnyEntity | null> {
		switch (entity.type) {
			case 'track': {
				const wanted = this.words(entity.name, entity.artists[0]?.name);
				const hits = await this.hits(SongHit, wanted, 'song');
				const hit = hits.find((candidate) => looselyMatches(candidate.title, entity.name));

				return hit ? this.trackOfHit(hit) : null;
			}
			case 'album': {
				const wanted = this.words(entity.name, entity.artists[0]?.name);
				const hits = await this.hits(TitledHit, wanted, 'album');
				const hit = hits.find((candidate) => looselyMatches(candidate.title, entity.name));

				return hit ? this.album(hit.id) : null;
			}
			case 'artist': {
				const hits = await this.hits(NamedHit, phrase(entity.name), 'artist');
				const hit = hits.find((candidate) => looselyMatches(candidate.name, entity.name));

				return hit ? this.artist(hit.id) : null;
			}
			case 'podcast':
			case 'podcast_episode':
				return null;
		}
	}

	private words(...parts: (string | undefined)[]): string {
		return parts
			.filter(Boolean)
			.map((part) => phrase(part as string))
			.join(' ');
	}

	private async hits<S extends v.GenericSchema>(
		schema: S,
		query: string,
		type: 'song' | 'album' | 'artist'
	): Promise<v.InferOutput<S>[]> {
		if (!query) return [];

		const found = await call(`search ${type}`, (yt) => yt.music.search(query, { type }));

		const shelves = found as unknown as Record<string, { contents?: unknown[] } | undefined>;
		const shelf = shelves[`${type}s`];
		const raw = Array.isArray(shelf?.contents) ? shelf.contents : [];

		return raw
			.map((candidate) => v.safeParse(schema, candidate))
			.filter((parsed) => parsed.success)
			.slice(0, SEARCH_LIMIT)
			.map((parsed) => parsed.output);
	}

	private async trackOfHit(hit: v.InferOutput<typeof SongHit>): Promise<Track> {
		return {
			type: 'track',
			name: hit.title,
			url: trackUrl(hit.id),
			cover: toCover(hit.thumbnail),
			artists: (hit.artists ?? []).map(toArtist),
			album: hit.album?.id ? await this.albumOrNothing(hit.album.id) : undefined
		};
	}

	private async albumOrNothing(id: string): Promise<Album | undefined> {
		try {
			return await this.album(id);
		} catch {
			return undefined;
		}
	}

	private async track(id: string): Promise<Track> {
		const found = await call('song', (yt) => yt.music.getInfo(id));

		const basic = (found as { basic_info?: { title?: unknown } }).basic_info;
		if (typeof basic?.title !== 'string') return this.trackOfOembed(id);

		const page = parse(SongPage, found);
		const { title, author, channel_id, thumbnail } = page.basic_info;

		return {
			type: 'track',
			name: title,
			url: trackUrl(id),
			cover: toCover(thumbnail),
			artists: author ? [toArtist({ name: author, channel_id })] : []
		};
	}

	private async trackOfOembed(id: string): Promise<Track> {
		const song = await described(id);
		if (!song) {
			throw new EntityNotFoundError('That YouTube Music track is not available');
		}

		const artist = song.author?.replace(TOPIC_SUFFIX, '').trim();

		return {
			type: 'track',
			name: song.title,
			url: trackUrl(id),
			cover: song.thumbnail ? { url: song.thumbnail } : undefined,
			artists: artist ? [{ type: 'artist', name: artist, url: song.authorUrl ?? trackUrl(id) }] : []
		};
	}

	private async album(id: string): Promise<Album> {
		const found = await call('album', (yt) => yt.music.getAlbum(id));
		const page = parse(Page, found);
		const header = page.header;

		return {
			type: 'album',
			name: header.title.text,
			url: albumUrl(id),
			release_date: toReleaseDate(header.subtitle?.text),
			cover: requireCover(
				(found as { header?: { thumbnail?: unknown } }).header?.thumbnail,
				'album'
			),
			artists: (header.strapline_text_one?.runs ?? []).map((run) => ({
				type: 'artist' as const,
				name: run.text,
				url: `https://${HOST}/search?q=${encodeURIComponent(run.text)}`
			}))
		};
	}

	private async albumOfPlaylist(list: string): Promise<Album> {
		const page = parse(PlaylistPage, await call('playlist', (yt) => yt.getPlaylist(list)));
		const { title, subtitle, thumbnails } = page.info;

		const name = title.replace(RELEASE_PREFIX, '').trim() || title;
		const artist = subtitle?.text.split('•')[0]?.trim();

		return {
			type: 'album',
			name,
			url: `https://${HOST}/playlist?list=${list}`,
			cover: requireCover(thumbnails, 'playlist'),
			artists: artist
				? [
						{
							type: 'artist',
							name: artist,
							url: `https://${HOST}/search?q=${encodeURIComponent(artist)}`
						}
					]
				: []
		};
	}

	private async artist(id: string): Promise<Artist> {
		const found = await call('artist', (yt) => yt.music.getArtist(id));
		const page = parse(Page, found);

		return {
			type: 'artist',
			name: page.header.title.text,
			url: artistUrl(id),
			cover: toCover((found as { header?: { thumbnail?: unknown } }).header?.thumbnail)
		};
	}
}
