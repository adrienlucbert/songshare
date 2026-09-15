import type { AnyEntity } from '../domain/entity';
import type { ShareLink } from '../domain/share-link';

export class UnsupportedLinkError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedLinkError';
	}
}

export class EntityNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EntityNotFoundError';
	}
}

export class ProviderUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProviderUnavailableError';
	}
}

export interface MusicProvider {
	readonly id: string;

	supports(link: ShareLink): boolean;
	fetchLinkContent(link: ShareLink): Promise<AnyEntity>;
	search(entity: AnyEntity): Promise<AnyEntity | null>;
}
