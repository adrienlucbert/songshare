import { describe, expect, it } from 'vitest';
import { playerFor } from './embed';

const at = (url: string, name = 'Something') => ({ url, name });

describe('playerFor', () => {
	it('plays a youtube video', () => {
		expect(
			playerFor({ youtube: at('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Winter') })
		).toEqual({ src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', title: 'Winter' });
	});

	it('plays a youtube music song', () => {
		expect(
			playerFor({ youtube_music: at('https://music.youtube.com/watch?v=7CTJcHjkq0E') })
		).toMatchObject({ src: 'https://www.youtube-nocookie.com/embed/7CTJcHjkq0E' });
	});

	it('plays a playlist as a series', () => {
		expect(
			playerFor({ youtube: at('https://www.youtube.com/playlist?list=OLAK5uy_abc') })
		).toMatchObject({ src: 'https://www.youtube-nocookie.com/embed/videoseries?list=OLAK5uy_abc' });
	});

	it('prefers the video over the music entry for the same result', () => {
		const player = playerFor({
			youtube_music: at('https://music.youtube.com/watch?v=musicid1234'),
			youtube: at('https://www.youtube.com/watch?v=videoid1234')
		});

		expect(player).toMatchObject({ src: 'https://www.youtube-nocookie.com/embed/videoid1234' });
	});

	it('has nothing to play for a channel', () => {
		expect(
			playerFor({ youtube: at('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw') })
		).toBeNull();
	});

	it('has nothing to play for an album browse page', () => {
		expect(
			playerFor({ youtube_music: at('https://music.youtube.com/browse/MPREb_ewByopgML4F') })
		).toBeNull();
	});

	it.each([
		['no youtube result at all', { spotify: at('https://open.spotify.com/track/abc') }],
		['no matches', undefined],
		['a url it cannot parse', { youtube: at('not a url') }]
	])('has nothing to play given %s', (_label, matches) => {
		expect(playerFor(matches)).toBeNull();
	});
});
