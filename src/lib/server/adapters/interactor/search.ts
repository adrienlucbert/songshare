import { UnsupportedLinkError, type MusicProvider } from '../../business/music-provider';
import type { AnyEntity } from '../../domain/entity';
import { ShareLink } from '../../domain/share-link';
import type { Input, Interactor, Output } from '../../usecase/search';

class SearchInteractor implements Interactor {
	constructor(private readonly providers: readonly MusicProvider[]) {}

	async search(input: Input): Promise<Output> {
		const link = ShareLink.parse(input.url);

		const origin = this.providers.find((candidate) => candidate.supports(link));
		if (!origin) {
			throw new UnsupportedLinkError(`No provider handles ${link}`);
		}

		const entity = await origin.fetchLinkContent(link);
		const found: Record<string, AnyEntity> = { [origin.id]: entity };

		const others = this.targets(input.providers).filter((candidate) => candidate !== origin);
		const matches = await Promise.all(others.map((provider) => this.match(provider, entity)));

		for (const [id, match] of matches) {
			if (match !== null) found[id] = match;
		}

		return { origin: origin.id, matches: found as Output['matches'] };
	}

	private targets(wanted: Input['providers']): readonly MusicProvider[] {
		if (!wanted) return this.providers;

		return wanted.map((provider) => {
			const target = this.providers.find((candidate) => candidate.id === provider);
			if (!target) {
				throw new UnsupportedLinkError(`No provider named ${wanted}`);
			}
			return target;
		});
	}

	private async match(
		provider: MusicProvider,
		entity: AnyEntity
	): Promise<readonly [string, AnyEntity | null]> {
		try {
			return [provider.id, await provider.search(entity)];
		} catch {
			return [provider.id, null];
		}
	}
}

export function newSearchInteractor(providers: readonly MusicProvider[]): Interactor {
	return new SearchInteractor(providers);
}
