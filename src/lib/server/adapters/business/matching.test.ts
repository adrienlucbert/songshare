import { describe, expect, it } from 'vitest';
import { barcodeVariants, looselyMatches, phrase } from './matching';

describe('looselyMatches', () => {
	it.each([
		['identical titles', 'The Best of Me', 'The Best of Me'],
		['differing case', 'NEVER GONNA GIVE YOU UP', 'never gonna give you up'],
		['differing accents', 'Dummy Podcast', 'Dummy Pódcast'],
		['differing punctuation', 'The Best: of Me!', 'The Best of Me'],
		['an edition suffix', 'The Best of Me (Deluxe Edition)', 'The Best of Me'],
		['the suffix on the other side', 'The Best of Me', 'The Best of Me - Remastered']
	])('accepts %s', (_label, candidate, wanted) => {
		expect(looselyMatches(candidate, wanted)).toBe(true);
	});

	it.each([
		['unrelated titles', 'Whenever You Need Somebody', 'The Best of Me'],
		['an empty candidate', '', 'The Best of Me'],
		['an empty target', 'The Best of Me', ''],
		['punctuation only', '!!!', 'The Best of Me']
	])('rejects %s', (_label, candidate, wanted) => {
		expect(looselyMatches(candidate, wanted)).toBe(false);
	});
});

describe('phrase', () => {
	it('removes the quotes that delimit a query phrase', () => {
		expect(phrase('Say "Hello"')).toBe('Say  Hello');
	});
});

describe('barcodeVariants', () => {
	it('offers the padded and unpadded spellings of a barcode', () => {
		// Spotify's EAN-13 for an album Deezer stores as 12-digit UPC-A.
		expect(barcodeVariants('0859381157694')).toContain('859381157694');
	});

	it('keeps the spelling it was given first', () => {
		expect(barcodeVariants('016861812300')[0]).toBe('016861812300');
	});

	it('does not repeat a spelling', () => {
		const variants = barcodeVariants('859381157694');
		expect(new Set(variants).size).toBe(variants.length);
	});

	it('has nothing to offer for an empty barcode', () => {
		expect(barcodeVariants('000')).toEqual([]);
	});
});
