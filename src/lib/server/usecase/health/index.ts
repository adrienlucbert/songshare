export type Status = 'ok' | 'degraded' | 'failing';

export type Reason = 'contract' | 'unreachable' | 'missing' | 'internal';

export type ProviderHealth = {
	status: Status;
	durationMs: number;
	reason?: Reason;
	detail?: string;
};

export type Output = {
	status: Status;
	checkedAt: string;
	providers: Record<string, ProviderHealth>;
};

export interface Interactor {
	check(): Promise<Output>;
}
