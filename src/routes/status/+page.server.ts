import type { PageServerLoad } from './$types';
import { healthInteractor, healthPagePresenter } from '$lib/server/composition';

export const load: PageServerLoad = async () => {
	try {
		return healthPagePresenter.presentOk(await healthInteractor.check());
	} catch (error) {
		return healthPagePresenter.presentError(error);
	}
};
