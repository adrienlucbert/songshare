import { and, eq, lt, sql } from 'drizzle-orm';
import type { CachedAnswer, CacheKind, ProviderCache } from '../../../business/provider-cache';
import { db } from '../../../db';
import { providerCache } from '../../../db/schema';
import type { AnyEntity } from '../../../domain/entity';

type Stored = Omit<AnyEntity, 'release_date'> & { release_date?: string };

function revive(entity: unknown): AnyEntity {
	return JSON.parse(JSON.stringify(entity), (key, value) =>
		(key === 'release_date' || key === 'createdAt') && typeof value === 'string'
			? new Date(value)
			: value
	) as AnyEntity;
}

export function newPostgresProviderCache(ttlMs: number): ProviderCache {
	return {
		async read(provider, kind, key): Promise<CachedAnswer | null> {
			const [row] = await db
				.select({ entity: providerCache.entity })
				.from(providerCache)
				.where(
					and(
						eq(providerCache.provider, provider),
						eq(providerCache.kind, kind),
						eq(providerCache.key, key),
						lt(sql`now()`, providerCache.expiresAt)
					)
				)
				.limit(1);

			if (!row) return null;

			return { entity: row.entity === null ? null : revive(row.entity as Stored) };
		},

		async write(provider, kind: CacheKind, key, entity): Promise<void> {
			const expiresAt = new Date(Date.now() + ttlMs);

			await db
				.insert(providerCache)
				.values({ provider, kind, key, entity, expiresAt })
				.onConflictDoUpdate({
					target: [providerCache.provider, providerCache.kind, providerCache.key],
					set: { entity, expiresAt }
				});
		}
	};
}

export async function sweepExpired(): Promise<number> {
	const removed = await db.delete(providerCache).where(lt(providerCache.expiresAt, sql`now()`));

	return removed.count ?? 0;
}
