import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityNotFoundError, UnsupportedLinkError } from '$lib/server/business/music-provider';
import { ShareLink } from '$lib/server/domain/share-link';
import { attempt } from '../innertube/client';
import { describe as describeVideo } from '../innertube/oembed';
import { YouTubeProvider } from './provider';

vi.mock('../innertube/client', async (importOriginal) => ({
	...(await importOriginal<typeof import('../innertube/client')>()),
	attempt: vi.fn()
}));

vi.mock('../innertube/oembed', () => ({ describe: vi.fn() }));

const youtube = new YouTubeProvider();
const link = (raw: string) => ShareLink.parse(raw);

const answers = (value: unknown) => vi.mocked(attempt).mockResolvedValue(value);

const videoPage = (title: string, author?: string) => ({
	basic_info: {
		id: 'dQw4w9WgXcQ',
		title,
		author,
		channel_id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
		thumbnail: [
			{ url: 'https://i.ytimg.com/vi/x/small.jpg', width: 120, height: 90 },
			{ url: 'https://i.ytimg.com/vi/x/large.jpg', width: 1920, height: 1080 }
		]
	}
});

beforeEach(() => {
	vi.mocked(attempt).mockReset();
	vi.mocked(describeVideo).mockReset();
});

describe('YouTubeProvider.supports', () => {
	it.each([
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://youtube.com/watch?v=dQw4w9WgXcQ',
		'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://youtu.be/dQw4w9WgXcQ',
		'https://www.youtube.com/playlist?list=PLabc',
		'https://www.youtube.com/@RickAstleyYT'
	])('claims %s', (raw) => {
		expect(youtube.supports(link(raw))).toBe(true);
	});

	it('leaves music.youtube.com to the YouTube Music provider', () => {
		expect(youtube.supports(link('https://music.youtube.com/watch?v=dQw4w9WgXcQ'))).toBe(false);
	});

	it.each(['https://open.spotify.com/track/abc', 'https://www.deezer.com/track/1'])(
		'declines %s',
		(raw) => {
			expect(youtube.supports(link(raw))).toBe(false);
		}
	);
});

describe('YouTubeProvider.fetchLinkContent', () => {
	it.each([
		['a bare host', 'https://www.youtube.com/'],
		['an unknown section', 'https://www.youtube.com/feed/subscriptions'],
		['a short link with no id', 'https://youtu.be/'],
		['a short link with a malformed id', 'https://youtu.be/not-an-id-at-all']
	])('rejects %s without calling YouTube', async (_label, raw) => {
		await expect(youtube.fetchLinkContent(link(raw))).rejects.toThrow(UnsupportedLinkError);
		expect(attempt).not.toHaveBeenCalled();
	});

	it('reads the artist out of an "Artist - Title" video title', async () => {
		answers(videoPage('Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)'));

		const track = await youtube.fetchLinkContent(
			link('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
		);

		expect(track).toMatchObject({
			type: 'track',
			name: 'Never Gonna Give You Up',
			artists: [{ name: 'Rick Astley' }]
		});
	});

	it('falls back to the channel when the title carries no artist', async () => {
		answers(videoPage('Never Gonna Give You Up [HD]', 'Rick Astley'));

		const track = await youtube.fetchLinkContent(link('https://youtu.be/dQw4w9WgXcQ'));

		expect(track).toMatchObject({ name: 'Never Gonna Give You Up' });
		expect(track).toMatchObject({ artists: [{ name: 'Rick Astley' }] });
	});

	it('keeps a title that is only decoration rather than emptying it', async () => {
		answers(videoPage('(Official Video)', 'Some Channel'));

		const track = await youtube.fetchLinkContent(link('https://youtu.be/dQw4w9WgXcQ'));

		expect(track.name).toBe('(Official Video)');
	});

	it('takes the largest thumbnail as the artwork', async () => {
		answers(videoPage('Never Gonna Give You Up', 'Rick Astley'));

		const track = await youtube.fetchLinkContent(link('https://youtu.be/dQw4w9WgXcQ'));

		expect(track).toMatchObject({ cover: { url: 'https://i.ytimg.com/vi/x/large.jpg' } });
	});

	it('reports a track with no album, which YouTube has no notion of', async () => {
		answers(videoPage('Rick Astley - Never Gonna Give You Up'));

		const track = await youtube.fetchLinkContent(link('https://youtu.be/dQw4w9WgXcQ'));

		expect(track).not.toHaveProperty('album.name');
	});

	it('describes a bot-gated video through oembed instead of failing', async () => {
		answers({ basic_info: {}, playability_status: { status: 'LOGIN_REQUIRED' } });
		vi.mocked(describeVideo).mockResolvedValue({
			title: 'DISEMBODIED TYRANT/SYNESTIA - WINTER (OFFICIAL VIDEO)',
			author: 'Disembodied Tyrant',
			authorUrl: 'https://www.youtube.com/@disembodiedtyrant',
			thumbnail: 'https://i.ytimg.com/vi/J9aJQHJq4nc/hqdefault.jpg'
		});

		const track = await youtube.fetchLinkContent(
			link('https://www.youtube.com/watch?v=J9aJQHJq4nc')
		);

		expect(track).toMatchObject({
			type: 'track',
			name: 'WINTER',
			artists: [{ name: 'DISEMBODIED TYRANT/SYNESTIA' }],
			cover: { url: 'https://i.ytimg.com/vi/J9aJQHJq4nc/hqdefault.jpg' }
		});
	});

	it('reports a video oembed cannot describe either as missing', async () => {
		answers({ basic_info: {} });
		vi.mocked(describeVideo).mockResolvedValue(null);

		await expect(
			youtube.fetchLinkContent(link('https://www.youtube.com/watch?v=J9aJQHJq4nc'))
		).rejects.toThrow(EntityNotFoundError);
	});

	it('does not reach for oembed when the page is usable', async () => {
		answers(videoPage('Rick Astley - Never Gonna Give You Up'));

		await youtube.fetchLinkContent(link('https://youtu.be/dQw4w9WgXcQ'));

		expect(describeVideo).not.toHaveBeenCalled();
	});

	it('rejects a handle that resolves to no channel', async () => {
		answers({ payload: {} });

		await expect(
			youtube.fetchLinkContent(link('https://www.youtube.com/@NotAChannel'))
		).rejects.toThrow(EntityNotFoundError);
	});
});

describe('YouTubeProvider.search', () => {
	it.each(['podcast', 'podcast_episode'] as const)(
		'finds nothing for a %s rather than guessing at a video',
		async (type) => {
			const entity =
				type === 'podcast'
					? ({
							type,
							name: 'A Podcast',
							url: 'https://example.test/p',
							description: '',
							cover: { url: 'https://example.test/c.jpg' }
						} as const)
					: ({
							type,
							name: 'An Episode',
							url: 'https://example.test/e',
							cover: { url: 'https://example.test/c.jpg' },
							podcast: {
								type: 'podcast',
								name: 'A Podcast',
								url: 'https://example.test/p',
								description: '',
								cover: { url: 'https://example.test/c.jpg' }
							}
						} as const);

			await expect(youtube.search(entity)).resolves.toBeNull();
			expect(attempt).not.toHaveBeenCalled();
		}
	);
});
