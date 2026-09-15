import { describe, expect, it, vi } from 'vitest';
import {
	EntityNotFoundError,
	ProviderUnavailableError,
	UnsupportedLinkError
} from '../../business/music-provider';
import { InvalidShareLinkError } from '../../domain/errors';
import { classify } from './failure';

describe('classify', () => {
	it.each([
		['an unusable link', new InvalidShareLinkError('nope'), 'invalid_link'],
		['a link nobody claims', new UnsupportedLinkError('nobody'), 'unsupported'],
		['a missing entity', new EntityNotFoundError('gone'), 'not_found'],
		['an unreachable provider', new ProviderUnavailableError('down'), 'unavailable']
	])('names %s', (_label, error, expected) => {
		expect(classify(error)).toBe(expected);
	});

	it('names anything else unexpected, and logs it', () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const boom = new Error('postgres://user:password@host/db is unreachable');

		expect(classify(boom)).toBe('unexpected');
		expect(logged).toHaveBeenCalledWith('unhandled error while serving request', boom);

		logged.mockRestore();
	});

	it('does not log an error it recognises', () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		classify(new EntityNotFoundError('gone'));

		expect(logged).not.toHaveBeenCalled();
		logged.mockRestore();
	});
});
