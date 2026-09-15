import { json } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import type { Presenter } from '../../usecase/presenter';
import { classify, type Failure } from './failure';

export type PresentOk<Output> = (output: Output) => Response;

const STATUS: Record<Failure, number> = {
	invalid_link: StatusCodes.BAD_REQUEST,
	unsupported: StatusCodes.BAD_REQUEST,
	not_found: StatusCodes.NOT_FOUND,
	unavailable: StatusCodes.BAD_GATEWAY,
	unexpected: StatusCodes.INTERNAL_SERVER_ERROR
};

export function newJsonPresenter<Output>(ok: PresentOk<Output>): Presenter<Output, Response> {
	return {
		presentOk: ok,

		presentError(error: unknown): Response {
			const failure = classify(error);
			const message = failure === 'unexpected' ? 'Internal error' : (error as Error).message;
			return json({ message }, { status: STATUS[failure] });
		}
	};
}
