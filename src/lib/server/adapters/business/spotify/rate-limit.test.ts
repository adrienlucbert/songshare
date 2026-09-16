import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetRateLimit, noteRateLimit, rateLimitedFor } from './rate-limit';

const limited = (retryAfter?: string) =>
	new Response(null, {
		status: 429,
		headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter }
	});

beforeEach(() => {
	forgetRateLimit();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('rate limit window', () => {
	it('is open until Spotify says otherwise', () => {
		expect(rateLimitedFor()).toBe(0);
	});

	it('waits for as long as Spotify asked', () => {
		noteRateLimit(limited('30'));

		expect(rateLimitedFor()).toBe(30);
	});

	it('counts down as time passes', () => {
		noteRateLimit(limited('30'));
		vi.advanceTimersByTime(20_000);

		expect(rateLimitedFor()).toBe(10);
	});

	it('opens again once the window elapses', () => {
		noteRateLimit(limited('30'));
		vi.advanceTimersByTime(30_001);

		expect(rateLimitedFor()).toBe(0);
	});

	it.each([
		['no header', undefined],
		['an unreadable header', 'soon'],
		['a nonsense value', '-5']
	])('falls back to a short wait given %s', (_label, header) => {
		noteRateLimit(limited(header));

		expect(rateLimitedFor()).toBeGreaterThan(0);
	});

	it('never shortens a window already in force', () => {
		noteRateLimit(limited('60'));
		noteRateLimit(limited('5'));

		expect(rateLimitedFor()).toBe(60);
	});

	it('extends a window when asked to wait longer', () => {
		noteRateLimit(limited('5'));
		noteRateLimit(limited('60'));

		expect(rateLimitedFor()).toBe(60);
	});
});
