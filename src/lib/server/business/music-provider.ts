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

export class ProviderContractError extends ProviderUnavailableError {
	constructor(message: string) {
		super(message);
		this.name = 'ProviderContractError';
	}
}

export interface MusicProvider {
	readonly id: string;

	readonly probeUrl: string;

	supports(link: ShareLink): boolean;
	fetchLinkContent(link: ShareLink): Promise<AnyEntity>;
	search(entity: AnyEntity): Promise<AnyEntity | null>;
}
