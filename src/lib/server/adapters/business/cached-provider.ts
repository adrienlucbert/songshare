import type { MusicProvider } from '../../business/music-provider';
import type { ProviderCache } from '../../business/provider-cache';
import type { AnyEntity } from '../../domain/entity';
import type { ShareLink } from '../../domain/share-link';

export function newCachedProvider(inner: MusicProvider, cache: ProviderCache): MusicProvider {
	return {
		id: inner.id,
		probeUrl: inner.probeUrl,

		supports: (link: ShareLink) => inner.supports(link),

		async fetchLinkContent(link: ShareLink): Promise<AnyEntity> {
			const key = link.toString();

			const cached = await cache.read(inner.id, 'resolve', key);
			if (cached?.entity) return cached.entity;

			const entity = await inner.fetchLinkContent(link);
			await cache.write(inner.id, 'resolve', key, entity);

			return entity;
		},

		async search(entity: AnyEntity): Promise<AnyEntity | null> {
			const key = entity.url;

			const cached = await cache.read(inner.id, 'match', key);
			if (cached) return cached.entity;

			const found = await inner.search(entity);
			await cache.write(inner.id, 'match', key, found);

			return found;
		}
	};
}
