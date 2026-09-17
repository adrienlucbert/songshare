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

const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

const SHORT_HOST = 'youtu.be';

const CHANNEL_ID = /^UC[A-Za-z0-9_-]+$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const SEARCH_LIMIT = 10;

const nonEmpty = v.pipe(v.string(), v.minLength(1));

const Thumb = v.object({
	url: nonEmpty,
	width: v.optional(v.number()),
	height: v.optional(v.number())
});

const VideoPage = v.object({
	basic_info: v.object({
		id: v.optional(v.string()),
		title: nonEmpty,
		author: v.optional(v.string()),
		channel_id: v.optional(v.string()),
		thumbnail: v.optional(v.array(Thumb))
	})
});

const PlaylistPage = v.object({
	info: v.object({
		title: nonEmpty,
		author: v.optional(v.object({ name: v.optional(v.string()) })),
		thumbnails: v.optional(v.array(Thumb))
	})
});

const ChannelPage = v.object({
	metadata: v.object({
		title: nonEmpty,
		avatar: v.optional(v.array(Thumb))
	})
});

const VideoHit = v.object({ id: nonEmpty, title: v.object({ text: nonEmpty }) });
const ListedHit = v.object({ id: nonEmpty, title: v.object({ text: nonEmpty }) });
const ChannelHit = v.object({ id: nonEmpty, author: v.object({ name: nonEmpty }) });

const DECORATION =
	/[([][^)\]]*\b(?:official|video|audio|lyrics?|visuali[sz]er|hd|hq|4k|8k|remaster(?:ed)?|explicit|mv|m\/v|full album)\b[^)\]]*[)\]]/gi;

function undecorate(title: string): string {
	return title
		.replace(DECORATION, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function readTitle(title: string, author: string | undefined): { name: string; artist?: string } {
	const clean = undecorate(title) || title;
	const [lead, ...rest] = clean.split(/\s+[-\u2013\u2014]\s+/);

	return rest.length
		? { name: rest.join(' - ').trim(), artist: lead.trim() }
		: { name: clean, artist: author };
}

function toCover(thumbnails: { url: string; width?: number; height?: number }[] | undefined) {
	const best = largest(thumbnails);

	return best && { url: best.url, width: best.width, height: best.height };
}

function requireCover(
	thumbnails: { url: string; width?: number; height?: number }[] | undefined,
	what: string
): Cover {
	const cover = toCover(thumbnails);
	if (!cover) {
		throw new ProviderContractError(`Unexpected YouTube response: ${what} has no artwork`);
	}

	return cover;
}

function parse<S extends v.GenericSchema>(schema: S, value: unknown): v.InferOutput<S> {
	const parsed = v.safeParse(schema, value);
	if (!parsed.success) {
		throw new ProviderContractError(`Unexpected YouTube response: ${v.summarize(parsed.issues)}`);
	}

	return parsed.output;
}

async function call<T>(what: string, run: Parameters<typeof attempt<T>>[1]): Promise<T> {
	try {
		return await attempt(what, run);
	} catch (cause) {
		if (cause instanceof InnertubeShapeError) {
			throw new EntityNotFoundError('No such entity on YouTube');
		}
		if (cause instanceof InnertubeUnavailableError) {
			throw new ProviderUnavailableError('YouTube could not be reached');
		}
		throw cause;
	}
}

async function described(id: string) {
	try {
		return await describeVideo(id);
	} catch (cause) {
		if (cause instanceof InnertubeUnavailableError) {
			throw new ProviderUnavailableError('YouTube could not be reached');
		}
		throw cause;
	}
}

function videoUrl(id: string): string {
	return `https://www.youtube.com/watch?v=${id}`;
}

function playlistUrl(id: string): string {
	return `https://www.youtube.com/playlist?list=${id}`;
}

function channelUrl(id: string): string {
	return `https://www.youtube.com/channel/${id}`;
}

export class YouTubeProvider implements MusicProvider {
	readonly id = 'youtube';

	readonly probeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

	supports(link: ShareLink): boolean {
		return link.host === SHORT_HOST || HOSTS.has(link.host);
	}

	async fetchLinkContent(link: ShareLink): Promise<AnyEntity> {
		const { url } = link;
		const segments = link.segments;

		if (link.host === SHORT_HOST) {
			const [id] = segments;
			if (!id || !VIDEO_ID.test(id)) {
				throw new UnsupportedLinkError(`Not a supported YouTube link: ${link}`);
			}

			return this.track(id);
		}

		const video = url.searchParams.get('v');
		if (video) return this.track(video);

		const list = url.searchParams.get('list');
		if (list) return this.album(list);

		const [section, id] = segments;
		if (section === 'shorts' && id && VIDEO_ID.test(id)) return this.track(id);
		if (section === 'channel' && id && CHANNEL_ID.test(id)) return this.artist(id);
		if (section?.startsWith('@') || section === 'c' || section === 'user') {
			return this.artist(await this.channelIdOf(url));
		}

		throw new UnsupportedLinkError(`Not a supported YouTube link: ${link}`);
	}

	async search(entity: AnyEntity): Promise<AnyEntity | null> {
		switch (entity.type) {
			case 'track': {
				const wanted = this.words(entity.name, entity.artists[0]?.name);
				const hits = await this.hits(VideoHit, wanted, 'video');
				const hit = hits.find((candidate) =>
					looselyMatches(undecorate(candidate.title.text), entity.name)
				);

				return hit ? this.track(hit.id) : null;
			}
			case 'album': {
				const wanted = this.words(entity.name, entity.artists[0]?.name);
				const hits = await this.hits(ListedHit, wanted, 'playlist');
				const hit = hits.find((candidate) => looselyMatches(candidate.title.text, entity.name));

				return hit ? this.album(hit.id) : null;
			}
			case 'artist': {
				const hits = await this.hits(ChannelHit, phrase(entity.name), 'channel');
				const hit = hits.find((candidate) => looselyMatches(candidate.author.name, entity.name));

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

	private async channelIdOf(url: URL): Promise<string> {
		const resolved = await call('resolve', (yt) => yt.resolveURL(url.toString()));
		const id = (resolved as { payload?: { browseId?: string } }).payload?.browseId;

		if (!id || !CHANNEL_ID.test(id)) {
			throw new EntityNotFoundError('That YouTube link names no channel');
		}

		return id;
	}

	private async hits<S extends v.GenericSchema>(
		schema: S,
		query: string,
		type: 'video' | 'playlist' | 'channel'
	): Promise<v.InferOutput<S>[]> {
		if (!query) return [];

		const found = await call(`search ${type}`, (yt) => yt.search(query, { type }));
		const raw = (found as { results?: unknown[] }).results ?? [];

		return raw
			.map((candidate) => v.safeParse(schema, candidate))
			.filter((parsed) => parsed.success)
			.slice(0, SEARCH_LIMIT)
			.map((parsed) => parsed.output);
	}

	private async track(id: string): Promise<Track> {
		const found = await call('video', (yt) => yt.getInfo(id));

		const basic = (found as { basic_info?: { title?: unknown } }).basic_info;
		if (typeof basic?.title !== 'string') return this.trackOfOembed(id);

		const page = parse(VideoPage, found);
		const { title, author, channel_id, thumbnail } = page.basic_info;
		const read = readTitle(title, author);

		return {
			type: 'track',
			name: read.name,
			url: videoUrl(id),
			cover: toCover(thumbnail),
			artists: read.artist
				? [
						{
							type: 'artist',
							name: read.artist,
							url: channel_id ? channelUrl(channel_id) : videoUrl(id)
						}
					]
				: []
		};
	}

	private async trackOfOembed(id: string): Promise<Track> {
		const video = await described(id);
		if (!video) {
			throw new EntityNotFoundError('That YouTube video is not available');
		}

		const read = readTitle(video.title, video.author);

		return {
			type: 'track',
			name: read.name,
			url: videoUrl(id),
			cover: video.thumbnail ? { url: video.thumbnail } : undefined,
			artists: read.artist
				? [{ type: 'artist', name: read.artist, url: video.authorUrl ?? videoUrl(id) }]
				: []
		};
	}

	private async album(list: string): Promise<Album> {
		const page = parse(PlaylistPage, await call('playlist', (yt) => yt.getPlaylist(list)));
		const { title, author, thumbnails } = page.info;

		return {
			type: 'album',
			name: title,
			url: playlistUrl(list),
			cover: requireCover(thumbnails, 'playlist'),
			artists: author?.name ? [{ type: 'artist', name: author.name, url: playlistUrl(list) }] : []
		};
	}

	private async artist(id: string): Promise<Artist> {
		const page = parse(ChannelPage, await call('channel', (yt) => yt.getChannel(id)));

		return {
			type: 'artist',
			name: page.metadata.title,
			url: channelUrl(id),
			cover: toCover(page.metadata.avatar)
		};
	}
}
