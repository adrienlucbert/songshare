import { error } from '@sveltejs/kit';
import { StatusCodes } from 'http-status-codes';
import type { PageServerLoad } from './$types';
import {
	searchInteractor,
	searchPagePresenter,
	shareLinkInteractor
} from '$lib/server/composition';

export const load: PageServerLoad = async ({ params }) => {
	const link = await shareLinkInteractor.find(params.id);
	if (!link) {
		error(StatusCodes.NOT_FOUND, 'No such link');
	}

	try {
		const output = await searchInteractor.search({ url: link.url });

		return { query: link.url, ...searchPagePresenter.presentOk(output) };
	} catch (err) {
		return { query: link.url, ...searchPagePresenter.presentError(err) };
	}
};
