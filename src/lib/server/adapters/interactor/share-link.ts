import type { SharedLinkRepository } from '../../business/shared-link-repository';
import { ShareLink } from '../../domain/share-link';
import type { Input, Interactor, Output } from '../../usecase/share-link';

class ShareLinkInteractor implements Interactor {
	constructor(private readonly links: SharedLinkRepository) { }

	async share(input: Input): Promise<Output> {
		const link = ShareLink.parse(input.url);

		return this.links.share(link.toString());
	}

	find(id: string): Promise<Output | null> {
		return this.links.find(id);
	}
}

export function newShareLinkInteractor(links: SharedLinkRepository): Interactor {
	return new ShareLinkInteractor(links);
}
