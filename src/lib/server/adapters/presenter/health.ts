import { json } from '@sveltejs/kit';
import type { Output } from '../../usecase/health';

/**
 * Always 200, even when a provider is failing: the body carries the verdict.
 * A monitor asserts on the JSON, and an orchestrator watching this endpoint
 * cannot be talked into restarting us because a third party went down.
 */
export function presentHealth(output: Output): Response {
	return json(output, { headers: { 'cache-control': 'no-store' } });
}
