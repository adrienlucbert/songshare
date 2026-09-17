const HOST = 'https://www.youtube-nocookie.com/embed';

const PLAYABLE = ['youtube', 'youtube_music'];

export type Player = {
	src: string;
	title: string;
};

export function playerFor(
	matches: Record<string, { url: string; name: string }> | undefined
): Player | null {
	for (const provider of PLAYABLE) {
		const found = matches?.[provider];
		if (!found || !URL.canParse(found.url)) continue;

		const { searchParams } = new URL(found.url);

		const video = searchParams.get('v');
		if (video) return { src: `${HOST}/${video}`, title: found.name };

		const list = searchParams.get('list');
		if (list) return { src: `${HOST}/videoseries?list=${list}`, title: found.name };
	}

	return null;
}
