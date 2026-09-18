import { describe, expect, it, vi } from 'vitest';
import { UnsupportedLinkError } from '../../business/music-provider';
import type { SharedLinkRepository } from '../../business/shared-link-repository';
import { InvalidShareLinkError } from '../../domain/errors';
import type { Interactor as SearchInteractor } from '../../usecase/search';
import { newShareLinkInteractor } from './share-link';

const SPOTIFY_LINK = 'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8';

function fakeRepository(): SharedLinkRepository {
	return {
		share: vi.fn(async (url: string) => ({ id: 'yndP8PZb', url })),
		find: vi.fn(async () => null)
	};
}

function resolves(): SearchInteractor {
	return {
		search: vi.fn(async () => ({ origin: 'spotify', matches: {} }))
	};
}

function rejects(error: Error): SearchInteractor {
	return {
		search: vi.fn(async () => {
			throw error;
		})
	};
}

describe('share', () => {
	it('mints a code for a link a provider resolves', async () => {
		const links = fakeRepository();
		const interactor = newShareLinkInteractor(links, resolves());

		await expect(interactor.share({ url: SPOTIFY_LINK })).resolves.toEqual({
			id: 'yndP8PZb',
			url: SPOTIFY_LINK
		});
		expect(links.share).toHaveBeenCalledWith(SPOTIFY_LINK);
	});

	it('stores nothing when no provider claims the link', async () => {
		const links = fakeRepository();
		const unsupported = new UnsupportedLinkError('No provider handles https://example.test/x');
		const interactor = newShareLinkInteractor(links, rejects(unsupported));

		await expect(interactor.share({ url: 'https://example.test/x' })).rejects.toBe(unsupported);
		expect(links.share).not.toHaveBeenCalled();
	});

	it('lets a failure from the resolving provider through untouched', async () => {
		const links = fakeRepository();
		const boom = new Error('upstream exploded');
		const interactor = newShareLinkInteractor(links, rejects(boom));

		await expect(interactor.share({ url: SPOTIFY_LINK })).rejects.toBe(boom);
		expect(links.share).not.toHaveBeenCalled();
	});

	it('rejects an unusable link before resolving it', async () => {
		const links = fakeRepository();
		const search = resolves();
		const interactor = newShareLinkInteractor(links, search);

		await expect(interactor.share({ url: 'nonsense' })).rejects.toThrow(InvalidShareLinkError);
		expect(search.search).not.toHaveBeenCalled();
		expect(links.share).not.toHaveBeenCalled();
	});

	it('looks a code up without resolving anything', async () => {
		const links = fakeRepository();
		const search = resolves();
		const interactor = newShareLinkInteractor(links, search);

		await interactor.find('yndP8PZb');

		expect(links.find).toHaveBeenCalledWith('yndP8PZb');
		expect(search.search).not.toHaveBeenCalled();
	});
});
