import * as v from 'valibot';
import {
	EntityNotFoundError,
	ProviderContractError,
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
import { SpotifyUnavailableError } from './auth';
import { getClient } from './client';
import { barcodeVariants, looselyMatches, phrase } from '../matching';

const HOSTS = new Set(['open.spotify.com', 'play.spotify.com']);

const ENTITIES: Record<string, EntityType> = {
	track: 'track',
	album: 'album',
	artist: 'artist',
	show: 'podcast',
	episode: 'podcast_episode'
};

const ID_PATTERN = /^[A-Za-z0-9]+$/;

const SEARCH_LIMIT = 10;

const Link = v.object({ spotify: v.string() });

const Images = v.pipe(
	v.array(
		v.object({ url: v.string(), width: v.nullish(v.number()), height: v.nullish(v.number()) })
	),
	v.minLength(1)
);

const ArtistResponse = v.object({
	name: v.string(),
	external_urls: Link,
	images: v.optional(Images)
});

const AlbumResponse = v.object({
	name: v.string(),
	external_urls: Link,
	release_date: v.optional(v.string()),
	images: Images,
	artists: v.array(ArtistResponse),
	external_ids: v.optional(v.object({ upc: v.optional(v.string()) }))
});

const TrackResponse = v.object({
	name: v.string(),
	external_urls: Link,
	album: AlbumResponse,
	artists: v.array(ArtistResponse),
	external_ids: v.optional(v.object({ isrc: v.optional(v.string()) }))
});

const Hit = v.object({ id: v.string(), name: v.string() });
const TrackHits = v.object({ tracks: v.object({ items: v.array(Hit) }) });
const AlbumHits = v.object({ albums: v.object({ items: v.array(Hit) }) });
const ArtistHits = v.object({ artists: v.object({ items: v.array(Hit) }) });
const PodcastHits = v.object({ shows: v.object({ items: v.array(Hit) }) });
const EpisodeHits = v.object({ episodes: v.object({ items: v.array(Hit) }) });

const PodcastResponse = v.object({
	name: v.string(),
	external_urls: Link,
	publisher: v.optional(v.string()),
	description: v.string(),
	images: Images
});

const EpisodeResponse = v.object({
	name: v.string(),
	external_urls: Link,
	show: PodcastResponse,
	release_date: v.optional(v.string()),
	images: Images
});

type EntityRef = {
	type: EntityType;
	id: string;
};

function parseLink(link: ShareLink): EntityRef {
	const segments = link.segments;

	const index = segments.findIndex((segment) => Object.hasOwn(ENTITIES, segment));
	const id = index === -1 ? undefined : segments[index + 1];
	if (index === -1 || !id || !ID_PATTERN.test(id)) {
		throw new UnsupportedLinkError(`Not a supported Spotify link: ${link}`);
	}

	return { type: ENTITIES[segments[index]], id };
}

async function get<S extends v.GenericSchema>(
	schema: S,
	request: Promise<{ data?: unknown; error?: unknown; response: Response }>
): Promise<v.InferOutput<S>> {
	const { data, error, response } = await request;

	if (error !== undefined || data === undefined) {
		if (response.status === 404) {
			throw new EntityNotFoundError('No such entity on Spotify');
		}
		throw new ProviderUnavailableError(
			`Spotify request failed: ${response.status} ${response.statusText}`
		);
	}

	const parsed = v.safeParse(schema, data);
	if (!parsed.success) {
		throw new ProviderContractError(`Unexpected Spotify response: ${v.summarize(parsed.issues)}`);
	}

	return parsed.output;
}

function toCover(images: v.InferOutput<typeof Images>): Cover {
	const largest = images.reduce((best, image) =>
		(image.width ?? 0) > (best.width ?? 0) ? image : best
	);

	return {
		url: largest.url,
		width: largest.width ?? undefined,
		height: largest.height ?? undefined
	};
}

function toReleaseDate(releaseDate: string | undefined): Date | undefined {
	if (!releaseDate) return undefined;

	const released = new Date(releaseDate);
	return Number.isNaN(released.getTime()) ? undefined : released;
}

function toArtist(artist: v.InferOutput<typeof ArtistResponse>): Artist {
	return {
		type: 'artist',
		name: artist.name,
		url: artist.external_urls.spotify,
		cover: artist.images ? toCover(artist.images) : undefined
	};
}

function toAlbum(album: v.InferOutput<typeof AlbumResponse>): Album {
	return {
		type: 'album',
		name: album.name,
		url: album.external_urls.spotify,
		release_date: toReleaseDate(album.release_date),
		cover: toCover(album.images),
		artists: album.artists.map(toArtist),
		upc: album.external_ids?.upc
	};
}

function toTrack(track: v.InferOutput<typeof TrackResponse>): Track {
	return {
		type: 'track',
		name: track.name,
		url: track.external_urls.spotify,
		album: toAlbum(track.album),
		artists: track.artists.map(toArtist),
		isrc: track.external_ids?.isrc
	};
}

function toPodcast(show: v.InferOutput<typeof PodcastResponse>): Podcast {
	return {
		type: 'podcast',
		name: show.name,
		url: show.external_urls.spotify,
		publisher: show.publisher,
		description: show.description,
		cover: toCover(show.images)
	};
}

function toPodcastEpisode(episode: v.InferOutput<typeof EpisodeResponse>): PodcastEpisode {
	return {
		type: 'podcast_episode',
		name: episode.name,
		url: episode.external_urls.spotify,
		podcast: toPodcast(episode.show),
		release_date: toReleaseDate(episode.release_date),
		cover: toCover(episode.images)
	};
}

export class SpotifyProvider implements MusicProvider {
	readonly id = 'spotify';

	readonly probeUrl = 'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8';

	supports(link: ShareLink): boolean {
		return HOSTS.has(link.host);
	}

	async fetchLinkContent(link: ShareLink): Promise<AnyEntity> {
		const { type, id } = parseLink(link);

		return this.reachable(() => this.byId(type, id));
	}

	async search(entity: AnyEntity): Promise<AnyEntity | null> {
		return this.reachable(async () => {
			const id = await this.searchId(entity);
			return id === null ? null : this.byId(entity.type, id);
		});
	}

	private async byId(type: EntityType, id: string): Promise<AnyEntity> {
		const client = getClient();
		const params = { params: { path: { id } } };

		switch (type) {
			case 'track':
				return toTrack(await get(TrackResponse, client.GET('/tracks/{id}', params)));
			case 'album':
				return toAlbum(await get(AlbumResponse, client.GET('/albums/{id}', params)));
			case 'artist':
				return toArtist(await get(ArtistResponse, client.GET('/artists/{id}', params)));
			case 'podcast':
				return toPodcast(await get(PodcastResponse, client.GET('/shows/{id}', params)));
			case 'podcast_episode':
				return toPodcastEpisode(await get(EpisodeResponse, client.GET('/episodes/{id}', params)));
		}
	}

	private async searchId(entity: AnyEntity): Promise<string | null> {
		switch (entity.type) {
			case 'track': {
				const exact = entity.isrc
					? await this.hits(TrackHits, (r) => r.tracks.items, `isrc:${entity.isrc}`, 'track')
					: [];
				if (exact.length > 0) return exact[0].id;

				const query = `track:"${phrase(entity.name)}" artist:"${phrase(entity.artists[0]?.name ?? '')}"`;
				return this.best(TrackHits, (r) => r.tracks.items, query, 'track', entity.name);
			}
			case 'album': {
				if (entity.upc) {
					for (const variant of barcodeVariants(entity.upc)) {
						const exact = await this.hits(
							AlbumHits,
							(r) => r.albums.items,
							`upc:${variant}`,
							'album'
						);
						if (exact.length > 0) return exact[0].id;
					}
				}

				const query = `album:"${phrase(entity.name)}" artist:"${phrase(entity.artists[0]?.name ?? '')}"`;
				return this.best(AlbumHits, (r) => r.albums.items, query, 'album', entity.name);
			}
			case 'artist':
				return this.best(
					ArtistHits,
					(r) => r.artists.items,
					phrase(entity.name),
					'artist',
					entity.name
				);
			case 'podcast':
				return this.best(
					PodcastHits,
					(r) => r.shows.items,
					phrase(entity.name),
					'show',
					entity.name
				);
			case 'podcast_episode':
				return this.best(
					EpisodeHits,
					(r) => r.episodes.items,
					phrase(entity.name),
					'episode',
					entity.name
				);
		}
	}

	private async hits<S extends v.GenericSchema>(
		schema: S,
		pick: (parsed: v.InferOutput<S>) => { id: string; name: string }[],
		query: string,
		type: string
	): Promise<{ id: string; name: string }[]> {
		const parsed = await get(
			schema,
			getClient().GET('/search', {
				params: { query: { q: query, type: type as never, limit: SEARCH_LIMIT } }
			})
		);

		return pick(parsed);
	}

	private async best<S extends v.GenericSchema>(
		schema: S,
		pick: (parsed: v.InferOutput<S>) => { id: string; name: string }[],
		query: string,
		type: string,
		wanted: string
	): Promise<string | null> {
		const found = await this.hits(schema, pick, query, type);

		return found.find((hit) => looselyMatches(hit.name, wanted))?.id ?? null;
	}

	private async reachable<T>(run: () => Promise<T>): Promise<T> {
		try {
			return await run();
		} catch (exception) {
			if (exception instanceof SpotifyUnavailableError) {
				throw new ProviderUnavailableError('Spotify could not be reached');
			}
			throw exception;
		}
	}
}
