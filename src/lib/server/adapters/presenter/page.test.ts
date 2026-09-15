import { describe, expect, it, vi } from 'vitest';
import { EntityNotFoundError, UnsupportedLinkError } from '../../business/music-provider';
import { InvalidShareLinkError } from '../../domain/errors';
import { newPagePresenter } from './page';

const presenter = newPagePresenter<{ value: string }>();

describe('page presenter, presentOk', () => {
	it('hands the output through with no failure', () => {
		expect(presenter.presentOk({ value: 'hello' })).toEqual({
			results: { value: 'hello' },
			failure: null
		});
	});
});

describe('page presenter, presentError', () => {
	it.each([
		['an unusable link', new InvalidShareLinkError('nope'), 'invalid_link'],
		['a link nobody claims', new UnsupportedLinkError('nobody'), 'unsupported'],
		['a missing entity', new EntityNotFoundError('gone'), 'not_found']
	])('names %s rather than wording it', (_label, error, failure) => {
		expect(presenter.presentError(error)).toEqual({ results: null, failure });
	});

	it('never leaks an error message into the view', () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const leaky = new Error('postgres://user:password@host/db is unreachable');

		const view = presenter.presentError(leaky);

		expect(view).toEqual({ results: null, failure: 'unexpected' });
		expect(JSON.stringify(view)).not.toContain('password');

		logged.mockRestore();
	});
});
