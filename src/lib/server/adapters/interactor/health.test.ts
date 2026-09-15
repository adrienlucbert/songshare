import { describe, expect, it, vi } from 'vitest';
import {
	EntityNotFoundError,
	ProviderContractError,
	ProviderUnavailableError,
	type MusicProvider
} from '../../business/music-provider';
import type { AnyEntity, Artist } from '../../domain/entity';
import { newCachedHealthInteractor, newHealthInteractor } from './health';

const artist = (name: string): Artist => ({ type: 'artist', name, url: 'https://example.test/a' });

type Behaviour = { resolve?: unknown; match?: AnyEntity | null | (() => never) };

function fakeProvider(id: string, behaviour: Behaviour = {}): MusicProvider {
	const resolved = behaviour.resolve ?? artist('Rick Astley');

	return {
		id,
		probeUrl: `https://${id}.test/track/1`,
		supports: () => true,
		fetchLinkContent: vi.fn(async () => {
			if (resolved instanceof Error) throw resolved;
			return resolved as AnyEntity;
		}),
		search: vi.fn(async () => {
			const m = behaviour.match;
			if (typeof m === 'function') return m();
			return m === undefined ? artist('Rick Astley') : m;
		})
	};
}

const check = (providers: MusicProvider[]) => newHealthInteractor(providers).check();

describe('health check', () => {
	it('reports ok when every provider resolves and matches', async () => {
		const output = await check([fakeProvider('spotify'), fakeProvider('deezer')]);

		expect(output.status).toBe('ok');
		expect(Object.keys(output.providers)).toEqual(['spotify', 'deezer']);
		expect(Object.values(output.providers).every((p) => p.status === 'ok')).toBe(true);
		expect(output.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('probes each provider against its own pinned link', async () => {
		const spotify = fakeProvider('spotify');
		await check([spotify]);

		const link = vi.mocked(spotify.fetchLinkContent).mock.calls[0][0];
		expect(link.toString()).toBe('https://spotify.test/track/1');
	});

	it('calls a moved schema a contract failure', async () => {
		const drifted = new ProviderContractError('Unexpected Deezer response: missing cover_xl');
		const output = await check([
			fakeProvider('spotify'),
			fakeProvider('deezer', { resolve: drifted })
		]);

		const deezer = output.providers.deezer;
		expect(deezer).toMatchObject({ status: 'failing', reason: 'contract' });
		expect(deezer?.detail).toContain('cover_xl');
		expect(output.status).toBe('failing');
	});

	it('separates an outage from a moved contract', async () => {
		const output = await check([
			fakeProvider('spotify', {
				resolve: new ProviderUnavailableError('Deezer could not be reached')
			})
		]);

		expect(output.providers.spotify).toMatchObject({ status: 'failing', reason: 'unreachable' });
	});

	it('treats a vanished probe link as degraded, not an outage', async () => {
		const output = await check([
			fakeProvider('spotify', { resolve: new EntityNotFoundError('gone') })
		]);

		expect(output.providers.spotify).toMatchObject({ status: 'degraded', reason: 'missing' });
	});

	it('flags a provider that resolves but can no longer match', async () => {
		const output = await check([fakeProvider('spotify'), fakeProvider('deezer', { match: null })]);

		expect(output.providers.deezer).toMatchObject({
			status: 'degraded',
			reason: 'unmatched'
		});
		expect(output.status).toBe('degraded');
	});

	it('never asks the reference provider to match its own entity', async () => {
		const spotify = fakeProvider('spotify');
		const deezer = fakeProvider('deezer');
		await check([spotify, deezer]);

		expect(spotify.search).not.toHaveBeenCalled();
		expect(deezer.search).toHaveBeenCalledOnce();
	});

	it('calls anything it does not recognise internal', async () => {
		const output = await check([fakeProvider('spotify', { resolve: new Error('boom') })]);

		expect(output.providers.spotify).toMatchObject({ status: 'failing', reason: 'internal' });
	});

	it('records how long each probe took', async () => {
		const output = await check([fakeProvider('spotify')]);

		expect(output.providers.spotify.durationMs).toBeGreaterThanOrEqual(0);
	});
});

describe('cached health check', () => {
	it('serves the cached reading until it goes stale', async () => {
		const inner = {
			check: vi.fn(async () => ({ status: 'ok' as const, checkedAt: 'x', providers: {} }))
		};
		const cached = newCachedHealthInteractor(inner, 60_000);

		await cached.check();
		await cached.check();
		await cached.check();

		expect(inner.check).toHaveBeenCalledOnce();
	});

	it('probes again once the reading expires', async () => {
		const inner = {
			check: vi.fn(async () => ({ status: 'ok' as const, checkedAt: 'x', providers: {} }))
		};
		const cached = newCachedHealthInteractor(inner, 0);

		await cached.check();
		await cached.check();

		expect(inner.check).toHaveBeenCalledTimes(2);
	});

	it('collapses concurrent callers onto one probe', async () => {
		const inner = {
			check: vi.fn(async () => ({ status: 'ok' as const, checkedAt: 'x', providers: {} }))
		};
		const cached = newCachedHealthInteractor(inner, 60_000);

		await Promise.all([cached.check(), cached.check(), cached.check(), cached.check()]);

		expect(inner.check).toHaveBeenCalledOnce();
	});
});
