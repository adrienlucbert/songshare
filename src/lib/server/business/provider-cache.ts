import type { AnyEntity } from '../domain/entity';

export type CacheKind = 'resolve' | 'match';

export type CachedAnswer = {
	entity: AnyEntity | null;
};

export interface ProviderCache {
	read(provider: string, kind: CacheKind, key: string): Promise<CachedAnswer | null>;

	write(provider: string, kind: CacheKind, key: string, entity: AnyEntity | null): Promise<void>;
}
