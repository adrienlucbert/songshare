import { Innertube, Log } from 'youtubei.js';

export class InnertubeUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InnertubeUnavailableError';
	}
}

export class InnertubeShapeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InnertubeShapeError';
	}
}
Log.setLevel();

let session: Promise<Innertube> | null = null;

export function connect(): Promise<Innertube> {
	session ??= Innertube.create({ retrieve_player: false }).catch((cause: unknown) => {
		session = null;
		throw new InnertubeUnavailableError(
			`YouTube could not be reached: ${(cause as Error).message}`
		);
	});

	return session;
}

export async function attempt<T>(what: string, call: (yt: Innertube) => Promise<T>): Promise<T> {
	const yt = await connect();

	try {
		return await call(yt);
	} catch (cause) {
		const message = (cause as Error).message ?? String(cause);

		if (/not found|invalid|unavailable|does not exist/i.test(message)) {
			throw new InnertubeShapeError(`${what}: ${message}`);
		}

		throw new InnertubeUnavailableError(`${what}: ${message}`);
	}
}

export function largest(
	thumbnails: { url: string; width?: number; height?: number }[] | undefined
): { url: string; width?: number; height?: number } | undefined {
	if (!thumbnails?.length) return undefined;

	return thumbnails.reduce((best, candidate) =>
		(candidate.width ?? 0) > (best.width ?? 0) ? candidate : best
	);
}
