import { redirect } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import type { PageServerLoad } from './$types';
import {
	searchInteractor,
	searchPagePresenter,
	shareLinkInteractor
} from '$lib/server/composition';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('url')?.trim() ?? '';

	if (!query) {
		return { query, results: null, failure: null };
	}

	let id: string;

	try {
		await searchInteractor.search({ url: query });
		({ id } = await shareLinkInteractor.share({ url: query }));
	} catch (error) {
		return { query, ...searchPagePresenter.presentError(error) };
	}

	redirect(StatusCodes.MOVED_TEMPORARILY, `/s/${id}`);
};
