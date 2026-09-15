import { describe, expect, it, vi } from 'vitest';
import { ProviderUnavailableError, UnsupportedLinkError } from '../../business/music-provider';
import type { MusicProvider } from '../../business/music-provider';
import type { AnyEntity, Artist } from '../../domain/entity';
import { InvalidShareLinkError } from '../../domain/errors';
import { ShareLink } from '../../domain/share-link';
import { newSearchInteractor } from './search';

const artist = (name: string, url: string): Artist => ({ type: 'artist', name, url });

const SPOTIFY_LINK = 'https://open.spotify.com/artist/1';

type FakeOptions = {
	fetched?: AnyEntity;
	match?: AnyEntity | null;
};

function fakeProvider(id: string, host: string, options: FakeOptions = {}): MusicProvider {
	const fetched = options.fetched ?? artist('Rick Astley', `https://${host}/fetched`);
	const match =
		options.match === undefined ? artist('Rick Astley', `https://${host}/match`) : options.match;

	return {
		id,
		probeUrl: `https://${host}/probe`,
		supports: (link: ShareLink) => link.host === host,
		fetchLinkContent: vi.fn(async () => fetched),
		search: vi.fn(async () => match)
	};
}

describe('search', () => {
	it('returns what the claiming provider fetched, under its own id', async () => {
		const fetched = artist('Rick Astley', 'https://open.spotify.com/artist/1');
		const spotify = fakeProvider('spotify', 'open.spotify.com', { fetched });
		const interactor = newSearchInteractor([spotify]);

		const output = await interactor.search({ url: SPOTIFY_LINK });

		expect(output).toEqual({ origin: spotify.id, matches: { spotify: fetched } });
		expect(spotify.fetchLinkContent).toHaveBeenCalledOnce();
	});

	it('asks every other provider for the same entity, keyed by provider id', async () => {
		const fetched = artist('Rick Astley', 'https://open.spotify.com/artist/1');
		const deezerMatch = artist('Rick Astley', 'https://deezer.com/artist/2');
		const spotify = fakeProvider('spotify', 'open.spotify.com', { fetched });
		const deezer = fakeProvider('deezer', 'deezer.com', { match: deezerMatch });
		const interactor = newSearchInteractor([spotify, deezer]);

		const output = await interactor.search({ url: SPOTIFY_LINK });

		expect(output).toEqual({
			origin: spotify.id,
			matches: { spotify: fetched, deezer: deezerMatch }
		});
		expect(deezer.search).toHaveBeenCalledWith(fetched);
	});

	it('names the provider whose link was given as the origin', async () => {
		const spotify = fakeProvider('spotify', 'open.spotify.com');
		const deezer = fakeProvider('deezer', 'deezer.com');
		const interactor = newSearchInteractor([spotify, deezer]);

		const fromDeezer = await interactor.search({ url: 'https://deezer.com/artist/2' });
		expect(fromDeezer.origin).toBe('deezer');

		const fromSpotify = await interactor.search({ url: SPOTIFY_LINK });
		expect(fromSpotify.origin).toBe('spotify');
	});

	it('never asks the claiming provider to search for its own entity', async () => {
		const spotify = fakeProvider('spotify', 'open.spotify.com');
		const deezer = fakeProvider('deezer', 'deezer.com');
		const interactor = newSearchInteractor([spotify, deezer]);

		await interactor.search({ url: SPOTIFY_LINK });

		expect(spotify.search).not.toHaveBeenCalled();
		expect(deezer.search).toHaveBeenCalledOnce();
	});

	it('hands the claiming provider a parsed link rather than the raw string', async () => {
		const spotify = fakeProvider('spotify', 'open.spotify.com');
		const interactor = newSearchInteractor([spotify]);

		await interactor.search({ url: SPOTIFY_LINK });

		expect(vi.mocked(spotify.fetchLinkContent).mock.calls[0][0]).toBeInstanceOf(ShareLink);
	});

	it('omits a provider that finds nothing', async () => {
		const fetched = artist('Rick Astley', 'https://open.spotify.com/artist/1');
		const spotify = fakeProvider('spotify', 'open.spotify.com', { fetched });
		const deezer = fakeProvider('deezer', 'deezer.com', { match: null });
		const interactor = newSearchInteractor([spotify, deezer]);

		const output = await interactor.search({ url: SPOTIFY_LINK });

		expect(output).toEqual({ origin: spotify.id, matches: { spotify: fetched } });
		expect(output).not.toHaveProperty('deezer');
	});

	it('keeps the other results when one provider fails', async () => {
		const fetched = artist('Rick Astley', 'https://open.spotify.com/artist/1');
		const tidalMatch = artist('Rick Astley', 'https://tidal.com/artist/3');
		const spotify = fakeProvider('spotify', 'open.spotify.com', { fetched });
		const tidal = fakeProvider('tidal', 'tidal.com', { match: tidalMatch });
		const broken: MusicProvider = {
			id: 'deezer',
			probeUrl: 'https://deezer.test/probe',
			supports: () => false,
			fetchLinkContent: vi.fn(),
			search: vi.fn(async () => {
				throw new ProviderUnavailableError('Deezer could not be reached');
			})
		};
		const interactor = newSearchInteractor([spotify, broken, tidal]);

		const output = await interactor.search({ url: SPOTIFY_LINK });

		expect(output).toEqual({
			origin: spotify.id,
			matches: { spotify: fetched, tidal: tidalMatch }
		});
	});

	it('takes the first provider that claims the link', async () => {
		const first = fakeProvider('first', 'open.spotify.com');
		const second = fakeProvider('second', 'open.spotify.com');
		const interactor = newSearchInteractor([first, second]);

		await interactor.search({ url: SPOTIFY_LINK });

		expect(first.fetchLinkContent).toHaveBeenCalledOnce();
		expect(second.fetchLinkContent).not.toHaveBeenCalled();
		expect(second.search).toHaveBeenCalledOnce();
	});

	it('rejects a link no provider claims', async () => {
		const interactor = newSearchInteractor([fakeProvider('spotify', 'open.spotify.com')]);

		await expect(interactor.search({ url: 'https://example.test/x' })).rejects.toThrow(
			UnsupportedLinkError
		);
	});

	it('rejects an unusable link before consulting any provider', async () => {
		const spotify = fakeProvider('spotify', 'open.spotify.com');
		const interactor = newSearchInteractor([spotify]);

		await expect(interactor.search({ url: 'nonsense' })).rejects.toThrow(InvalidShareLinkError);
		expect(spotify.fetchLinkContent).not.toHaveBeenCalled();
	});

	it('lets a failure from the claiming provider through untouched', async () => {
		const boom = new Error('upstream exploded');
		const interactor = newSearchInteractor([
			{
				id: 'spotify',
				probeUrl: 'https://spotify.test/probe',
				supports: () => true,
				fetchLinkContent: vi.fn(async () => {
					throw boom;
				}),
				search: vi.fn(async () => null)
			}
		]);

		await expect(interactor.search({ url: SPOTIFY_LINK })).rejects.toBe(boom);
	});
});
