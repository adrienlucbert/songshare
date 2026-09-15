const BASE_URL = 'https://api.deezer.com';

export class DeezerUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DeezerUnavailableError';
	}
}

export async function fetchResource(path: string): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(`${BASE_URL}/${path}`, { headers: { accept: 'application/json' } });
	} catch (cause) {
		throw new DeezerUnavailableError(`Deezer is unreachable: ${(cause as Error).message}`);
	}

	if (!response.ok) {
		throw new DeezerUnavailableError(
			`Deezer request failed: ${response.status} ${response.statusText}`
		);
	}

	try {
		return await response.json();
	} catch {
		throw new DeezerUnavailableError('Deezer returned a body that is not JSON');
	}
}

export async function expandShareLink(url: URL): Promise<URL | null> {
	let response: Response;
	try {
		response = await fetch(url, { redirect: 'manual' });
	} catch (cause) {
		throw new DeezerUnavailableError(`Deezer is unreachable: ${(cause as Error).message}`);
	}

	const location = response.headers.get('location');
	if (!location || !URL.canParse(location)) {
		return null;
	}

	const destination = new URL(location).searchParams.get('dest') ?? location;
	return URL.canParse(destination) ? new URL(destination) : null;
}
