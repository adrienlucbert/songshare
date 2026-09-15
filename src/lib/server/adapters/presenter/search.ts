import { json } from '@sveltejs/kit';
import type { Output } from '../../usecase/search';

export function presentSearch(output: Output): Response {
	return json(output);
}
