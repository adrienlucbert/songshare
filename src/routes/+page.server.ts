import type { PageServerLoad } from './$types';
import { searchInteractor, searchPagePresenter } from '$lib/server/composition';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('url')?.trim() ?? '';

	if (!query) {
		return { query, results: null, failure: null };
	}

	try {
		const output = await searchInteractor.search({ url: query });

		return { query, ...searchPagePresenter.presentOk(output) };
	} catch (error) {
		return { query, ...searchPagePresenter.presentError(error) };
	}
};
