import { index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const sharedLink = pgTable('shared_link', {
	id: text('id').primaryKey(),
	url: text('url').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const providerCache = pgTable(
	'provider_cache',
	{
		provider: text('provider').notNull(),
		kind: text('kind').notNull(),
		key: text('key').notNull(),
		entity: jsonb('entity'),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.provider, table.kind, table.key] }),
		index('provider_cache_expires_at_idx').on(table.expiresAt)
	]
);
