import { json } from '@sveltejs/kit';
import type { Output } from '../../usecase/health';

export function presentHealth(output: Output): Response {
	return json(output, { headers: { 'cache-control': 'no-store' } });
}
