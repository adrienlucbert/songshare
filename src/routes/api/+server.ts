import type { RequestEvent } from './$types';
import { searchInteractor, searchJsonPresenter } from '$lib/server/composition';

export async function GET({ url }: RequestEvent) {
	const providers = url.searchParams.get('providers')?.trim()?.split(',') ?? undefined

	try {
		const output = await searchInteractor.search({
			url: url.searchParams.get('url') ?? '',
			providers
		});

		return searchJsonPresenter.presentOk(output);
	} catch (error) {
		return searchJsonPresenter.presentError(error);
	}
}
