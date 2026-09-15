/**
 * Comparison for text-search results, which is how entities are matched when no
 * shared identifier exists. Providers punctuate and accent titles differently,
 * so both sides are flattened before comparing.
 */
function normalize(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/**
 * Whether two titles plausibly name the same thing. Containment is allowed so
 * that an edition suffix, "The Best of Me (Deluxe)", still matches, while an
 * unrelated result from a loose query does not.
 */
export function looselyMatches(candidate: string, wanted: string): boolean {
	const left = normalize(candidate);
	const right = normalize(wanted);
	if (!left || !right) return false;

	return left === right || left.includes(right) || right.includes(left);
}

/** Quotes are the phrase delimiter in both providers' query syntax. */
export function phrase(value: string): string {
	return value.replace(/"/g, ' ').trim();
}

/**
 * Spellings of a barcode to try, most likely first.
 *
 * Providers disagree on padding: Spotify zero-pads to EAN-13 (`0859381157694`)
 * while Deezer keeps the 12-digit UPC-A (`859381157694`), so the same release
 * is missed unless both are attempted.
 */
export function barcodeVariants(barcode: string): string[] {
	const given = barcode.trim();
	const bare = given.replace(/^0+/, '');
	if (!bare) return [];

	return [...new Set([given, bare, bare.padStart(12, '0'), bare.padStart(13, '0')])];
}
