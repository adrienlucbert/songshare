import { describe, expect, it, vi } from 'vitest';
import { ProviderUnavailableError, type MusicProvider } from '../../business/music-provider';
import type { CachedAnswer, ProviderCache } from '../../business/provider-cache';
import type { Artist } from '../../domain/entity';
import { ShareLink } from '../../domain/share-link';
import { newCachedProvider } from './cached-provider';

const artist = (name: string): Artist => ({ type: 'artist', name, url: 'https://source.test/a' });

function fakeCache(): ProviderCache & { entries: Map<string, CachedAnswer> } {
	const entries = new Map<string, CachedAnswer>();

	return {
		entries,
		read: vi.fn(async (provider, kind, key) => entries.get(`${provider}:${kind}:${key}`) ?? null),
		write: vi.fn(async (provider, kind, key, entity) => {
			entries.set(`${provider}:${kind}:${key}`, { entity });
		})
	};
}

function fakeProvider(id: string, behaviour: Partial<MusicProvider> = {}): MusicProvider {
	return {
		id,
		probeUrl: `https://${id}.test/probe`,
		supports: () => true,
		fetchLinkContent: vi.fn(async () => artist('Rick Astley')),
		search: vi.fn(async () => artist('Rick Astley')),
		...behaviour
	};
}

const link = ShareLink.parse('https://open.spotify.com/track/1');

describe('cached provider', () => {
	it('asks the provider once for the same link', async () => {
		const inner = fakeProvider('spotify');
		const cached = newCachedProvider(inner, fakeCache());

		await cached.fetchLinkContent(link);
		await cached.fetchLinkContent(link);

		expect(inner.fetchLinkContent).toHaveBeenCalledOnce();
	});

	it('asks the provider once for the same entity', async () => {
		const inner = fakeProvider('deezer');
		const cached = newCachedProvider(inner, fakeCache());

		await cached.search(artist('Rick Astley'));
		await cached.search(artist('Rick Astley'));

		expect(inner.search).toHaveBeenCalledOnce();
	});

	it('remembers that a provider found nothing', async () => {
		const inner = fakeProvider('deezer', { search: vi.fn(async () => null) });
		const cached = newCachedProvider(inner, fakeCache());

		expect(await cached.search(artist('Rick Astley'))).toBeNull();
		expect(await cached.search(artist('Rick Astley'))).toBeNull();

		expect(inner.search).toHaveBeenCalledOnce();
	});

	it('never remembers a failure', async () => {
		const boom = new ProviderUnavailableError('Spotify is rate limiting us');
		const inner = fakeProvider('spotify', {
			fetchLinkContent: vi.fn(async () => {
				throw boom;
			})
		});
		const cached = newCachedProvider(inner, fakeCache());

		await expect(cached.fetchLinkContent(link)).rejects.toBe(boom);
		await expect(cached.fetchLinkContent(link)).rejects.toBe(boom);

		expect(inner.fetchLinkContent).toHaveBeenCalledTimes(2);
	});

	it('keeps one provider out of another provider entries', async () => {
		const cache = fakeCache();
		const spotify = fakeProvider('spotify');
		const deezer = fakeProvider('deezer');

		await newCachedProvider(spotify, cache).search(artist('Rick Astley'));
		await newCachedProvider(deezer, cache).search(artist('Rick Astley'));

		expect(spotify.search).toHaveBeenCalledOnce();
		expect(deezer.search).toHaveBeenCalledOnce();
		expect(cache.entries.size).toBe(2);
	});

	it('keeps resolving a link apart from matching an entity', async () => {
		const cache = fakeCache();
		const inner = fakeProvider('spotify');
		const cached = newCachedProvider(inner, cache);

		await cached.fetchLinkContent(ShareLink.parse('https://source.test/a'));
		await cached.search(artist('Rick Astley'));

		expect(inner.fetchLinkContent).toHaveBeenCalledOnce();
		expect(inner.search).toHaveBeenCalledOnce();
		expect([...cache.entries.keys()]).toEqual([
			'spotify:resolve:https://source.test/a',
			'spotify:match:https://source.test/a'
		]);
	});

	it('passes the port through untouched', () => {
		const inner = fakeProvider('spotify');
		const cached = newCachedProvider(inner, fakeCache());

		expect(cached.id).toBe('spotify');
		expect(cached.probeUrl).toBe(inner.probeUrl);
		expect(cached.supports(link)).toBe(true);
	});
});
