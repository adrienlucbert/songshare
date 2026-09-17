const NAMES: Record<string, string> = {
	spotify: 'Spotify',
	deezer: 'Deezer',
	youtube_music: 'YouTube Music'
};

export function providerName(id: string): string {
	return NAMES[id] ?? id[0].toUpperCase() + id.slice(1);
}
