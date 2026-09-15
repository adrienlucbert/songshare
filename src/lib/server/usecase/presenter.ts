export interface Presenter<Output, View> {
	presentOk(output: Output): View;
	presentError(error: unknown): View;
}
