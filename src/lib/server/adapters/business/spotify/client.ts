import createClient, { type Client, type Middleware } from 'openapi-fetch';
import { StatusCodes } from 'http-status-codes';
import type { paths } from '$lib/server/adapters/business/spotify/schema';
import { getAccessToken, renewAccessToken } from '$lib/server/adapters/business/spotify/auth';
import { noteRateLimit, rateLimitedFor } from './rate-limit';

let client: Client<paths, `${string}/${string}`> | null = null;

const replayable = new WeakMap<Request, Request>();

const rateLimit: Middleware = {
	onRequest() {
		const wait = rateLimitedFor();
		if (wait === 0) return;

		return new Response(null, {
			status: StatusCodes.TOO_MANY_REQUESTS,
			headers: { 'retry-after': String(wait) }
		});
	},

	onResponse({ response }) {
		if (response.status === StatusCodes.TOO_MANY_REQUESTS) {
			noteRateLimit(response);
		}

		return response;
	}
};

const auth: Middleware = {
	async onRequest({ request }) {
		request.headers.set('Authorization', `Bearer ${await getAccessToken()}`);
		replayable.set(request, request.clone());
		return request;
	},

	async onResponse({ request, response }) {
		const retry = replayable.get(request);
		replayable.delete(request);

		if (response.status !== StatusCodes.UNAUTHORIZED || !retry) {
			return response;
		}

		retry.headers.set('Authorization', `Bearer ${await renewAccessToken()}`);
		return fetch(retry);
	}
};

export const getClient = () => {
	if (client === null) {
		client = createClient<paths>({ baseUrl: 'https://api.spotify.com/v1/' });
		client.use(rateLimit);
		client.use(auth);
	}
	return client;
};
