import { json } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import { describe, expect, it, vi } from 'vitest';
import {
	EntityNotFoundError,
	ProviderUnavailableError,
	UnsupportedLinkError
} from '../../business/music-provider';
import { InvalidShareLinkError } from '../../domain/errors';
import { newJsonPresenter } from './json';

const presenter = newJsonPresenter<{ value: string }>((output) => json(output));

describe('json presenter, presentOk', () => {
	it('delegates the success view', async () => {
		const response = presenter.presentOk({ value: 'hello' });

		expect(response.status).toBe(StatusCodes.OK);
		await expect(response.json()).resolves.toEqual({ value: 'hello' });
	});
});

describe('json presenter, presentError', () => {
	it.each([
		['an unusable link', new InvalidShareLinkError('nope'), StatusCodes.BAD_REQUEST],
		['an unclaimed link', new UnsupportedLinkError('nobody'), StatusCodes.BAD_REQUEST],
		['a missing entity', new EntityNotFoundError('gone'), StatusCodes.NOT_FOUND],
		['an unreachable provider', new ProviderUnavailableError('down'), StatusCodes.BAD_GATEWAY]
	])('maps %s onto its status and keeps the message', async (_label, error, status) => {
		const response = presenter.presentError(error);

		expect(response.status).toBe(status);
		await expect(response.json()).resolves.toEqual({ message: error.message });
	});

	it('hides an unexpected error behind a 500', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const leaky = new Error('postgres://user:password@host/db is unreachable');

		const response = presenter.presentError(leaky);

		expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
		await expect(response.json()).resolves.toEqual({ message: 'Internal error' });

		logged.mockRestore();
	});
});
