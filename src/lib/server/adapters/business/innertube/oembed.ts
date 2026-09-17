import { InnertubeUnavailableError } from './client';

const ENDPOINT = 'https://www.youtube.com/oembed';

export type Described = {
	title: string;
	author?: string;
	authorUrl?: string;
	thumbnail?: string;
};

export async function describe(videoId: string): Promise<Described | null> {
	const target = new URL(ENDPOINT);
	target.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
	target.searchParams.set('format', 'json');

	let response: Response;
	try {
		response = await fetch(target, { headers: { accept: 'application/json' } });
	} catch (cause) {
		throw new InnertubeUnavailableError(`oembed: ${(cause as Error).message}`);
	}

	if (response.status === 401 || response.status === 403 || response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new InnertubeUnavailableError(`oembed: ${response.status} ${response.statusText}`);
	}

	let body: Record<string, unknown>;
	try {
		body = (await response.json()) as Record<string, unknown>;
	} catch {
		throw new InnertubeUnavailableError('oembed: body is not JSON');
	}

	const text = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : undefined);
	const title = text('title');

	return title
		? {
				title,
				author: text('author_name'),
				authorUrl: text('author_url'),
				thumbnail: text('thumbnail_url')
			}
		: null;
}
