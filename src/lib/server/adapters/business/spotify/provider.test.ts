import { describe, expect, it } from 'vitest';
import { UnsupportedLinkError } from '$lib/server/business/music-provider';
import { ShareLink } from '$lib/server/domain/share-link';
import { SpotifyProvider } from './provider';

const spotify = new SpotifyProvider();
const link = (raw: string) => ShareLink.parse(raw);

describe('SpotifyProvider.supports', () => {
	it.each([
		'https://open.spotify.com/track/abc',
		'https://play.spotify.com/track/abc',
		'https://open.spotify.com/intl-fr/show/abc?si=x'
	])('claims %s', (raw) => {
		expect(spotify.supports(link(raw))).toBe(true);
	});

	it.each(['https://deezer.com/track/1', 'https://example.test/track/1', 'deezer:track:1'])(
		'declines %s',
		(raw) => {
			expect(spotify.supports(link(raw))).toBe(false);
		}
	);
});

describe('SpotifyProvider.fetchLinkContent', () => {
	it.each([
		['an entity it cannot fetch', 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'],
		['a path traversal', 'https://open.spotify.com/track/../../evil'],
		['a missing id', 'https://open.spotify.com/track/'],
		['an id with illegal characters', 'https://open.spotify.com/track/abc$def'],
		['a malformed URI', 'spotify:track']
	])('rejects %s without calling Spotify', async (_label, raw) => {
		await expect(spotify.fetchLinkContent(link(raw))).rejects.toThrow(UnsupportedLinkError);
	});
});
