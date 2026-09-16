import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { searchJsonPresenter, shareLinkInteractor } from '$lib/server/composition';

export async function GET({ url }: RequestEvent) {
	try {
		const link = await shareLinkInteractor.share({ url: url.searchParams.get('url') ?? '' });

		return json({ id: link.id, url: new URL(`/s/${link.id}`, url.origin).href });
	} catch (error) {
		return searchJsonPresenter.presentError(error);
	}
}
