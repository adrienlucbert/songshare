import { eq } from 'drizzle-orm';
import type { SharedLink, SharedLinkRepository } from '../../../business/shared-link-repository';
import { db } from '../../../db';
import { sharedLink } from '../../../db/schema';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const LENGTH = 8;

function mintId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));

	return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function newPostgresSharedLinkRepository(): SharedLinkRepository {
	return {
		async share(url: string): Promise<SharedLink> {
			const [row] = await db
				.insert(sharedLink)
				.values({ id: mintId(), url })
				.onConflictDoUpdate({ target: sharedLink.url, set: { url } })
				.returning({ id: sharedLink.id, url: sharedLink.url });

			return row;
		},

		async find(id: string): Promise<SharedLink | null> {
			const [row] = await db
				.select({ id: sharedLink.id, url: sharedLink.url })
				.from(sharedLink)
				.where(eq(sharedLink.id, id))
				.limit(1);

			return row ?? null;
		}
	};
}
