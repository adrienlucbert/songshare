import type { AnyEntity } from '../../domain/entity';

export type Input = {
	url: string;
};

type ByProvider<T> = T extends unknown ? Record<string, T> : never;

export type Output = {
	origin: string;
	matches: ByProvider<AnyEntity>;
};

export interface Interactor {
	search(input: Input): Promise<Output>;
}
