import type { Presenter } from '../../usecase/presenter';
import { classify, type Failure } from './failure';

export type PageView<Output> = {
	results: Output | null;
	failure: Failure | null;
};

export function newPagePresenter<Output>(): Presenter<Output, PageView<Output>> {
	return {
		presentOk: (output) => ({ results: output, failure: null }),
		presentError: (error) => ({ results: null, failure: classify(error) })
	};
}
