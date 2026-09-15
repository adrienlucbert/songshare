import { describe, expect, it } from 'vitest';
import { InvalidShareLinkError } from './errors';
import { ShareLink } from './share-link';

describe('ShareLink', () => {
	it('accepts an https link and exposes its parts', () => {
		const link = ShareLink.parse('https://open.spotify.com/intl-fr/track/abc123?si=xyz');

		expect(link.host).toBe('open.spotify.com');
		expect(link.segments).toEqual(['intl-fr', 'track', 'abc123']);
	});

	it('accepts a provider URI, which carries no host', () => {
		const link = ShareLink.parse('spotify:track:abc123');

		expect(link.host).toBe('');
	});

	it('trims surrounding whitespace', () => {
		expect(ShareLink.parse('  https://deezer.com/track/1  ').host).toBe('deezer.com');
	});

	it.each([
		['empty', ''],
		['blank', '   '],
		['not a url', 'hello world'],
		['scheme only', 'https://']
	])('rejects a link that is %s', (_label, raw) => {
		expect(() => ShareLink.parse(raw)).toThrow(InvalidShareLinkError);
	});
});
