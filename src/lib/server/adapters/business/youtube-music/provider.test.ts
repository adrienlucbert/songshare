import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityNotFoundError, UnsupportedLinkError } from '$lib/server/business/music-provider';
import type { Track } from '$lib/server/domain/entity';
import { ShareLink } from '$lib/server/domain/share-link';
import { attempt } from '../innertube/client';
import { describe as describeVideo } from '../innertube/oembed';
import { YouTubeMusicProvider } from './provider';

vi.mock('../innertube/client', async (importOriginal) => ({
	...(await importOriginal<typeof import('../innertube/client')>()),
	attempt: vi.fn()
}));

vi.mock('../innertube/oembed', () => ({ describe: vi.fn() }));

const music = new YouTubeMusicProvider();
const link = (raw: string) => ShareLink.parse(raw);

const answers = (value: unknown) => vi.mocked(attempt).mockResolvedValue(value);

const track = (name: string): Track => ({
	type: 'track',
	name,
	url: 'https://www.deezer.com/track/1',
	artists: [{ type: 'artist', name: 'Rick Astley', url: 'https://www.deezer.com/artist/6160' }]
});

const songShelf = (hits: unknown[]) => ({ songs: { contents: hits } });

beforeEach(() => {
	vi.mocked(attempt).mockReset();
	vi.mocked(describeVideo).mockReset();
});

describe('YouTubeMusicProvider.supports', () => {
	it.each([
		'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://music.youtube.com/browse/MPREb_ewByopgML4F',
		'https://music.youtube.com/channel/UCwZEU0wAwIyZb4x5G_KJp2w'
	])('claims %s', (raw) => {
		expect(music.supports(link(raw))).toBe(true);
	});

	it.each([
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://youtu.be/dQw4w9WgXcQ',
		'https://open.spotify.com/track/abc'
	])('declines %s', (raw) => {
		expect(music.supports(link(raw))).toBe(false);
	});
});

describe('YouTubeMusicProvider.fetchLinkContent', () => {
	it.each([
		['a bare host', 'https://music.youtube.com/'],
		['an unknown section', 'https://music.youtube.com/library'],
		['a browse id that is not an album', 'https://music.youtube.com/browse/FEmusic_home'],
		['a channel id of the wrong shape', 'https://music.youtube.com/channel/not-a-channel']
	])('rejects %s without calling YouTube Music', async (_label, raw) => {
		await expect(music.fetchLinkContent(link(raw))).rejects.toThrow(UnsupportedLinkError);
		expect(attempt).not.toHaveBeenCalled();
	});

	it.each([
		['an auto-generated art track', {}],
		['a bot-gated track, whose keys are present but empty', { id: undefined, title: undefined }]
	])('describes %s through oembed, dropping the Topic suffix', async (_label, basic) => {
		answers({ basic_info: basic });
		vi.mocked(describeVideo).mockResolvedValue({
			title: 'Never Gonna Give You Up',
			author: 'Rick Astley - Topic',
			authorUrl: 'https://www.youtube.com/channel/UCwZEU0wAwIyZb4x5G_KJp2w'
		});

		const found = await music.fetchLinkContent(
			link('https://music.youtube.com/watch?v=lYBUbBu4W08')
		);

		expect(found).toMatchObject({
			type: 'track',
			name: 'Never Gonna Give You Up',
			artists: [{ name: 'Rick Astley' }]
		});
	});

	it('reports a track oembed cannot describe either as missing', async () => {
		answers({ basic_info: {} });
		vi.mocked(describeVideo).mockResolvedValue(null);

		await expect(
			music.fetchLinkContent(link('https://music.youtube.com/watch?v=lYBUbBu4W08'))
		).rejects.toThrow(EntityNotFoundError);
	});

	it('does not reach for oembed when the song page is usable', async () => {
		answers({ basic_info: { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up' } });

		await music.fetchLinkContent(link('https://music.youtube.com/watch?v=dQw4w9WgXcQ'));

		expect(describeVideo).not.toHaveBeenCalled();
	});

	it('reads the release name and artist out of an album playlist link', async () => {
		answers({
			info: {
				title: 'Album - The Best of Me',
				subtitle: { text: 'Rick Astley \u2022 Album' },
				thumbnails: [{ url: 'https://lh3.googleusercontent.com/a', width: 544, height: 544 }]
			}
		});

		const found = await music.fetchLinkContent(
			link('https://music.youtube.com/playlist?list=OLAK5uy_kKzgbumGI8XJFtMr9MZyCAq-oW7G1GOuY')
		);

		expect(found).toMatchObject({
			type: 'album',
			name: 'The Best of Me',
			artists: [{ name: 'Rick Astley' }]
		});
	});

	it('keeps a playlist title that is only the prefix', async () => {
		answers({
			info: {
				title: 'Album - ',
				thumbnails: [{ url: 'https://lh3.googleusercontent.com/a', width: 544, height: 544 }]
			}
		});

		const found = await music.fetchLinkContent(
			link('https://music.youtube.com/playlist?list=OLAK5uy_kKzgbumGI8XJFtMr9MZyCAq-oW7G1GOuY')
		);

		expect(found.name).toBe('Album - ');
	});

	it('reads a song page into a track', async () => {
		answers({
			basic_info: {
				id: 'dQw4w9WgXcQ',
				title: 'Never Gonna Give You Up',
				author: 'Rick Astley',
				channel_id: 'UCwZEU0wAwIyZb4x5G_KJp2w',
				thumbnail: [{ url: 'https://lh3.googleusercontent.com/a', width: 544, height: 544 }]
			}
		});

		const found = await music.fetchLinkContent(
			link('https://music.youtube.com/watch?v=dQw4w9WgXcQ')
		);

		expect(found).toMatchObject({
			type: 'track',
			name: 'Never Gonna Give You Up',
			url: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
			artists: [{ name: 'Rick Astley' }]
		});
	});
});

describe('YouTubeMusicProvider.search', () => {
	it('reads hits from the typed shelf, not the top-result card', async () => {
		answers(
			songShelf([
				{ id: 'aaaaaaaaaaa', title: 'Never Gonna Give You Up', artists: [{ name: 'Rick Astley' }] }
			])
		);

		const found = await music.search(track('Never Gonna Give You Up'));

		expect(found).toMatchObject({
			type: 'track',
			name: 'Never Gonna Give You Up',
			url: 'https://music.youtube.com/watch?v=aaaaaaaaaaa'
		});
	});

	it('builds the track from the hit rather than fetching the song page again', async () => {
		answers(songShelf([{ id: 'aaaaaaaaaaa', title: 'Never Gonna Give You Up' }]));

		await music.search(track('Never Gonna Give You Up'));

		expect(attempt).toHaveBeenCalledOnce();
	});

	it('finds nothing when no hit plausibly names the same track', async () => {
		answers(songShelf([{ id: 'aaaaaaaaaaa', title: 'Something Else Entirely' }]));

		await expect(music.search(track('Never Gonna Give You Up'))).resolves.toBeNull();
	});

	it('skips a hit the response no longer shapes as expected', async () => {
		answers(songShelf([{ title: 'Never Gonna Give You Up' }, { id: 'bbbbbbbbbbb', title: 'x' }]));

		await expect(music.search(track('Never Gonna Give You Up'))).resolves.toBeNull();
	});

	it.each(['podcast', 'podcast_episode'] as const)('finds nothing for a %s', async (type) => {
		const cover = { url: 'https://example.test/c.jpg' };
		const podcast = {
			type: 'podcast',
			name: 'A Podcast',
			url: 'https://example.test/p',
			description: '',
			cover
		} as const;

		const entity =
			type === 'podcast'
				? podcast
				: ({ type, name: 'An Episode', url: 'https://example.test/e', cover, podcast } as const);

		await expect(music.search(entity)).resolves.toBeNull();
		expect(attempt).not.toHaveBeenCalled();
	});
});
