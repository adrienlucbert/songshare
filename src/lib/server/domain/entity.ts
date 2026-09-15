export type EntityType = 'track' | 'album' | 'artist' | 'podcast' | 'podcast_episode';

export type Entity = {
	name: string;
	url: string;
	type: EntityType;
};

export type Cover = {
	url: string;
	width?: number;
	height?: number;
};

export type Album = Entity & { type: 'album' } & {
	release_date?: Date;
	cover: Cover;
	artists: Artist[];
	upc?: string;
};

export type Artist = Entity & { type: 'artist' } & {
	cover?: Cover;
};

export type Track = Entity & { type: 'track' } & {
	album: Album;
	artists: Artist[];
	isrc?: string;
};

export type Podcast = Entity & { type: 'podcast' } & {
	publisher?: string;
	description: string;
	cover: Cover;
};

export type PodcastEpisode = Entity & { type: 'podcast_episode' } & {
	podcast: Podcast;
	release_date?: Date;
	cover: Cover;
};

export type AnyEntity = Track | Album | Artist | Podcast | PodcastEpisode;
