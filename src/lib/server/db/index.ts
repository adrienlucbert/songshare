import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

function connect() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	return drizzle(postgres(env.DATABASE_URL), { schema });
}

let instance: ReturnType<typeof connect> | null = null;

export function db() {
	return (instance ??= connect());
}
