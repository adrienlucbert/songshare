import type { RequestEvent } from './$types';
import { searchInteractor, searchJsonPresenter } from '$lib/server/composition';

export async function GET({ url }: RequestEvent) {
	try {
		const output = await searchInteractor.search({
			url: url.searchParams.get('url') ?? ''
		});

		return searchJsonPresenter.presentOk(output);
	} catch (error) {
		return searchJsonPresenter.presentError(error);
	}
}
