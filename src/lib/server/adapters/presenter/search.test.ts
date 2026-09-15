import { StatusCodes } from 'http-status-codes';
import { describe, expect, it } from 'vitest';
import type { Artist } from '../../domain/entity';
import type { Output } from '../../usecase/search';
import { presentSearch } from './search';

const artist = (url: string): Artist => ({ type: 'artist', name: 'Rick Astley', url });

describe('presentSearch', () => {
	it('sends the whole map of provider id to entity', async () => {
		const output: Output = {
			origin: 'spotify',
			matches: {
				spotify: artist('https://open.spotify.com/artist/1'),
				deezer: artist('https://www.deezer.com/artist/2')
			}
		};

		const response = presentSearch(output);

		expect(response.status).toBe(StatusCodes.OK);
		await expect(response.json()).resolves.toEqual(output);
	});

	it('sends a body even when only one provider answered', async () => {
		const response = presentSearch({
			origin: 'spotify',
			matches: { spotify: artist('https://open.spotify.com/artist/1') }
		});

		await expect(response.text()).resolves.not.toBe('');
	});
});
