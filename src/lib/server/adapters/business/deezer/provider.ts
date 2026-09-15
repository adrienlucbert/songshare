import * as v from 'valibot';
import {
	EntityNotFoundError,
	ProviderUnavailableError,
	UnsupportedLinkError,
	type MusicProvider
} from '$lib/server/business/music-provider';
import type {
	Album,
	AnyEntity,
	Artist,
	Cover,
	EntityType,
	Podcast,
	PodcastEpisode,
	Track
} from '$lib/server/domain/entity';
import type { ShareLink } from '$lib/server/domain/share-link';
import { DeezerUnavailableError, expandShareLink, fetchResource } from './client';
import { barcodeVariants, looselyMatches, phrase } from '../matching';

const HOSTS = new Set(['deezer.com', 'www.deezer.com', 'link.deezer.com']);

const SHORT_LINK_HOST = 'link.deezer.com';

const ENTITIES: Record<string, { type: EntityType; resource: string }> = {
	track: { type: 'track', resource: 'track' },
	album: { type: 'album', resource: 'album' },
	artist: { type: 'artist', resource: 'artist' },
	show: { type: 'podcast', resource: 'podcast' },
	podcast: { type: 'podcast', resource: 'podcast' },
	episode: { type: 'podcast_episode', resource: 'episode' }
};

const ID_PATTERN = /^\d+$/;

const NO_DATA_ERROR_CODE = 800;

const SEARCH_LIMIT = 10;

const EPISODE_PAGE = 100;

const nonEmpty = v.pipe(v.string(), v.minLength(1));

const Contributor = v.object({
	name: v.string(),
	link: nonEmpty,
	picture_xl: v.optional(nonEmpty)
});

const Contributors = v.pipe(v.array(Contributor), v.minLength(1));

const Failure = v.object({
	error: v.object({ code: v.number(), message: v.string(), type: v.string() })
});

const ArtistResponse = v.object({
	name: v.string(),
	link: nonEmpty,
	picture_xl: v.optional(nonEmpty)
});

const AlbumResponse = v.object({
	title: v.string(),
	link: nonEmpty,
	release_date: v.optional(v.string()),
	cover_xl: nonEmpty,
	contributors: Contributors,
	upc: v.optional(v.string())
});

const NestedAlbum = v.object({
	id: v.number(),
	title: v.string(),
	link: nonEmpty,
	cover_xl: nonEmpty,
	release_date: v.optional(v.string())
});

const TrackResponse = v.object({
	title: v.string(),
	link: nonEmpty,
	album: NestedAlbum,
	contributors: Contributors,
	isrc: v.optional(v.string())
});

const Identified = v.object({ id: v.number() });

const Playable = v.object({ id: v.number(), readable: v.optional(v.boolean()) });

const TrackHits = v.object({
	data: v.array(
		v.object({
			id: v.number(),
			title: v.string(),
			readable: v.optional(v.boolean()),
			isrc: v.optional(v.string())
		})
	)
});

const TitledHits = v.object({ data: v.array(v.object({ id: v.number(), title: v.string() })) });
const NamedHits = v.object({ data: v.array(v.object({ id: v.number(), name: v.string() })) });

const PodcastResponse = v.object({
	title: v.string(),
	link: nonEmpty,
	description: v.string(),
	picture_xl: nonEmpty
});

const NestedPodcast = v.object({
	id: v.number(),
	title: v.string(),
	link: nonEmpty,
	picture_xl: nonEmpty
});

const EpisodeResponse = v.object({
	title: v.string(),
	link: nonEmpty,
	release_date: v.optional(v.string()),
	picture_xl: nonEmpty,
	podcast: NestedPodcast
});

type EntityRef = {
	resource: string;
	type: EntityType;
	id: string;
};

function parsePage(url: URL, link: ShareLink): EntityRef {
	const segments = url.pathname.split('/').filter(Boolean);
	const index = segments.findIndex((segment) => Object.hasOwn(ENTITIES, segment));
	const id = index === -1 ? undefined : segments[index + 1];
	if (index === -1 || !id || !ID_PATTERN.test(id)) {
		throw new UnsupportedLinkError(`Not a supported Deezer link: ${link}`);
	}

	return { ...ENTITIES[segments[index]], id };
}

async function get<S extends v.GenericSchema>(schema: S, path: string): Promise<v.InferOutput<S>> {
	let payload: unknown;
	try {
		payload = await fetchResource(path);
	} catch (cause) {
		if (cause instanceof DeezerUnavailableError) {
			throw new ProviderUnavailableError('Deezer could not be reached');
		}
		throw cause;
	}

	const failure = v.safeParse(Failure, payload);
	if (failure.success) {
		if (failure.output.error.code === NO_DATA_ERROR_CODE) {
			throw new EntityNotFoundError('No such entity on Deezer');
		}
		throw new ProviderUnavailableError(
			`Deezer rejected the request: ${failure.output.error.message}`
		);
	}

	const parsed = v.safeParse(schema, payload);
	if (!parsed.success) {
		throw new ProviderUnavailableError(`Unexpected Deezer response: ${v.summarize(parsed.issues)}`);
	}

	return parsed.output;
}

function toCover(url: string): Cover {
	return { url };
}

function toReleaseDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;

	const released = new Date(value.replace(' ', 'T'));
	return Number.isNaN(released.getTime()) ? undefined : released;
}

function toArtist(contributor: v.InferOutput<typeof Contributor>): Artist {
	return {
		type: 'artist',
		name: contributor.name,
		url: contributor.link,
		cover: contributor.picture_xl ? toCover(contributor.picture_xl) : undefined
	};
}

export class DeezerProvider implements MusicProvider {
	readonly id = 'deezer';

	supports(link: ShareLink): boolean {
		return HOSTS.has(link.host);
	}

	async fetchLinkContent(link: ShareLink): Promise<AnyEntity> {
		const { type, resource, id } = await this.locate(link);

		switch (type) {
			case 'track':
				return this.track(resource, id);
			case 'album':
				return this.album(resource, id);
			case 'artist':
				return this.artist(resource, id);
			case 'podcast':
				return this.podcast(resource, id);
			case 'podcast_episode':
				return this.episode(resource, id);
		}
	}

	private async locate(link: ShareLink): Promise<EntityRef> {
		if (link.host !== SHORT_LINK_HOST) {
			return parsePage(link.url, link);
		}

		let expanded: URL | null;
		try {
			expanded = await expandShareLink(link.url);
		} catch (cause) {
			if (cause instanceof DeezerUnavailableError) {
				throw new ProviderUnavailableError('Deezer could not be reached');
			}
			throw cause;
		}

		if (!expanded) {
			throw new EntityNotFoundError('That Deezer share link leads nowhere');
		}

		return parsePage(expanded, link);
	}

	async search(entity: AnyEntity): Promise<AnyEntity | null> {
		switch (entity.type) {
			case 'track': {
				const exact = entity.isrc ? await this.playableIsrc(entity.isrc) : null;
				if (exact !== null) return this.track('track', exact);

				const id = await this.bestTrack(this.words(entity.name, entity.artists[0]?.name), entity);
				return id === null ? null : this.track('track', id);
			}
			case 'album': {
				const exact = entity.upc ? await this.exactBarcodeId(entity.upc) : null;
				if (exact !== null) return this.album('album', exact);

				const query = this.words(entity.name, entity.artists[0]?.name);
				const id = await this.bestTitled('search/album', query, entity.name);
				return id === null ? null : this.album('album', id);
			}
			case 'artist': {
				const found = await get(NamedHits, `search/artist?${this.query(entity.name)}`);
				const hit = found.data.find((candidate) => looselyMatches(candidate.name, entity.name));
				return hit === undefined ? null : this.artist('artist', String(hit.id));
			}
			case 'podcast': {
				const id = await this.bestTitled('search/podcast', phrase(entity.name), entity.name);
				return id === null ? null : this.podcast('podcast', id);
			}
			case 'podcast_episode': {
				const podcastId = await this.bestTitled(
					'search/podcast',
					phrase(entity.podcast.name),
					entity.podcast.name
				);
				if (podcastId === null) return null;

				const episodes = await get(
					TitledHits,
					`podcast/${podcastId}/episodes?limit=${EPISODE_PAGE}`
				);
				const hit = episodes.data.find((candidate) => looselyMatches(candidate.title, entity.name));
				return hit === undefined ? null : this.episode('episode', String(hit.id));
			}
		}
	}

	private async exactBarcodeId(upc: string): Promise<string | null> {
		for (const variant of barcodeVariants(upc)) {
			const found = await this.exactId(`album/upc:${variant}`);
			if (found !== null) return found;
		}

		return null;
	}

	private words(...parts: (string | undefined)[]): string {
		return parts
			.filter(Boolean)
			.map((part) => phrase(part as string))
			.join(' ');
	}

	private async playableIsrc(isrc: string): Promise<string | null> {
		try {
			const found = await get(Playable, `track/isrc:${isrc}`);
			return found.readable === false ? null : String(found.id);
		} catch (exception) {
			if (exception instanceof EntityNotFoundError) return null;
			throw exception;
		}
	}

	private async bestTrack(query: string, entity: Track): Promise<string | null> {
		const found = await get(TrackHits, `search/track?${this.query(query)}`);
		const playable = found.data.filter((candidate) => candidate.readable !== false);

		const sameRecording = entity.isrc && playable.find((c) => c.isrc === entity.isrc);
		if (sameRecording) return String(sameRecording.id);

		const hit = playable.find((candidate) => looselyMatches(candidate.title, entity.name));
		return hit === undefined ? null : String(hit.id);
	}

	private async exactId(path: string): Promise<string | null> {
		try {
			return String((await get(Identified, path)).id);
		} catch (exception) {
			if (exception instanceof EntityNotFoundError) return null;
			throw exception;
		}
	}

	private async bestTitled(path: string, query: string, wanted: string): Promise<string | null> {
		const found = await get(TitledHits, `${path}?${this.query(query)}`);
		const hit = found.data.find((candidate) => looselyMatches(candidate.title, wanted));

		return hit === undefined ? null : String(hit.id);
	}

	private query(q: string): string {
		return new URLSearchParams({ q, limit: String(SEARCH_LIMIT) }).toString();
	}

	private async track(resource: string, id: string): Promise<Track> {
		const track = await get(TrackResponse, `${resource}/${id}`);
		const artists = track.contributors.map(toArtist);

		return {
			type: 'track',
			name: track.title,
			url: track.link,
			album: await this.albumOf(track, artists),
			artists,
			isrc: track.isrc
		};
	}

	private async albumOf(
		track: v.InferOutput<typeof TrackResponse>,
		artists: Artist[]
	): Promise<Album> {
		try {
			return await this.album('album', String(track.album.id));
		} catch (exception) {
			if (!(exception instanceof EntityNotFoundError)) throw exception;

			return {
				type: 'album',
				name: track.album.title,
				url: track.album.link,
				release_date: toReleaseDate(track.album.release_date),
				cover: toCover(track.album.cover_xl),
				artists
			};
		}
	}

	private async album(resource: string, id: string): Promise<Album> {
		const album = await get(AlbumResponse, `${resource}/${id}`);

		return {
			type: 'album',
			name: album.title,
			url: album.link,
			release_date: toReleaseDate(album.release_date),
			cover: toCover(album.cover_xl),
			artists: album.contributors.map(toArtist),
			upc: album.upc
		};
	}

	private async artist(resource: string, id: string): Promise<Artist> {
		return toArtist(await get(ArtistResponse, `${resource}/${id}`));
	}

	private async podcastOf(episode: v.InferOutput<typeof EpisodeResponse>): Promise<Podcast> {
		try {
			return await this.podcast('podcast', String(episode.podcast.id));
		} catch (exception) {
			if (!(exception instanceof EntityNotFoundError)) throw exception;

			return {
				type: 'podcast',
				name: episode.podcast.title,
				url: episode.podcast.link,
				description: '',
				cover: toCover(episode.podcast.picture_xl)
			};
		}
	}

	private async podcast(resource: string, id: string): Promise<Podcast> {
		const podcast = await get(PodcastResponse, `${resource}/${id}`);

		return {
			type: 'podcast',
			name: podcast.title,
			url: podcast.link,
			description: podcast.description,
			cover: toCover(podcast.picture_xl)
		};
	}

	private async episode(resource: string, id: string): Promise<PodcastEpisode> {
		const episode = await get(EpisodeResponse, `${resource}/${id}`);

		return {
			type: 'podcast_episode',
			name: episode.title,
			url: episode.link,
			podcast: await this.podcastOf(episode),
			release_date: toReleaseDate(episode.release_date),
			cover: toCover(episode.picture_xl)
		};
	}
}
