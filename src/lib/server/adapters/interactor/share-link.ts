import type { SharedLinkRepository } from '../../business/shared-link-repository';
import { ShareLink } from '../../domain/share-link';
import type { Interactor as SearchInteractor } from '../../usecase/search';
import type { Input, Interactor, Output } from '../../usecase/share-link';

class ShareLinkInteractor implements Interactor {
	constructor(
		private readonly links: SharedLinkRepository,
		private readonly search: SearchInteractor
	) {}

	async share(input: Input): Promise<Output> {
		const link = ShareLink.parse(input.url);
		const target = link.toString();

		await this.search.search({ url: target });

		return this.links.share(target);
	}

	find(id: string): Promise<Output | null> {
		return this.links.find(id);
	}
}

export function newShareLinkInteractor(
	links: SharedLinkRepository,
	search: SearchInteractor
): Interactor {
	return new ShareLinkInteractor(links, search);
}
