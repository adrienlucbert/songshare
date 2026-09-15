import { healthInteractor, healthPresenter } from '$lib/server/composition';

export async function GET() {
	try {
		return healthPresenter.presentOk(await healthInteractor.check());
	} catch (error) {
		return healthPresenter.presentError(error);
	}
}
