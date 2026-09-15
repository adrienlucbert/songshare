import { env } from '$env/dynamic/private';

const ACCOUNTS_BASE_URL = 'https://accounts.spotify.com';
const EXPIRY_MARGIN_MS = 60_000;

interface Token {
	accessToken: string;
	expiresAt: number;
}

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

let token: Token | null = null;

let pendingRenew: Promise<Token> | null = null;

export class SpotifyConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SpotifyConfigurationError';
	}
}

export class SpotifyUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SpotifyUnavailableError';
	}
}

async function requestToken(): Promise<Token> {
	const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = env;
	if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
		throw new SpotifyConfigurationError(
			'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must both be set'
		);
	}

	const response = await fetch(`${ACCOUNTS_BASE_URL}/api/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({ grant_type: 'client_credentials' })
	});

	if (!response.ok) {
		throw new SpotifyUnavailableError(
			`Spotify token request failed (${response.status}): ${await response.text()}`
		);
	}

	const payload: TokenResponse = await response.json();
	return {
		accessToken: payload.access_token,
		expiresAt: Date.now() + payload.expires_in * 1000
	};
}

function renew(): Promise<Token> {
	if (pendingRenew) {
		return pendingRenew;
	}

	pendingRenew = requestToken()
		.then((next) => {
			token = next;
			return next;
		})
		.finally(() => {
			pendingRenew = null;
		});

	return pendingRenew;
}

export async function getAccessToken(): Promise<string> {
	if (token && Date.now() < token.expiresAt - EXPIRY_MARGIN_MS) {
		return token.accessToken;
	}

	return (await renew()).accessToken;
}

export async function renewAccessToken(): Promise<string> {
	token = null;
	return (await renew()).accessToken;
}
