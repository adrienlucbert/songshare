import { describe, expect, it } from 'vitest';
import { UnsupportedLinkError } from '$lib/server/business/music-provider';
import { ShareLink } from '$lib/server/domain/share-link';
import { DeezerProvider } from './provider';

const deezer = new DeezerProvider();
const link = (raw: string) => ShareLink.parse(raw);

describe('DeezerProvider.supports', () => {
	it.each([
		'https://www.deezer.com/track/3786363472',
		'https://deezer.com/album/901480252',
		'https://www.deezer.com/fr/show/123456789',
		'https://link.deezer.com/s/ExampleShareCode01'
	])('claims %s', (raw) => {
		expect(deezer.supports(link(raw))).toBe(true);
	});

	it.each([
		'https://open.spotify.com/track/abc',
		'https://example.test/track/1',
		'spotify:track:abc'
	])('declines %s', (raw) => {
		expect(deezer.supports(link(raw))).toBe(false);
	});
});

describe('DeezerProvider.fetchLinkContent', () => {
	it.each([
		['an entity it cannot fetch', 'https://www.deezer.com/playlist/1234'],
		['a path traversal', 'https://www.deezer.com/track/../../evil'],
		['a missing id', 'https://www.deezer.com/track/'],
		['a non-numeric id', 'https://www.deezer.com/track/abc'],
		['no entity at all', 'https://www.deezer.com/']
	])('rejects %s without calling Deezer', async (_label, raw) => {
		await expect(deezer.fetchLinkContent(link(raw))).rejects.toThrow(UnsupportedLinkError);
	});

	it('accepts a locale segment before the entity', async () => {
		const parsed = link('https://www.deezer.com/fr/album/901480252');
		expect(deezer.supports(parsed)).toBe(true);
	});
});
