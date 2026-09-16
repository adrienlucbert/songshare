export type Input = {
	url: string;
};

export type Output = {
	id: string;
	url: string;
};

export interface Interactor {
	share(input: Input): Promise<Output>;
	find(id: string): Promise<Output | null>;
}
