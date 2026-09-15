/** Worst-case reading of a check, in the order a reader cares about. */
export type Status = 'ok' | 'degraded' | 'failing';

/**
 * Why a provider is not `ok`. `contract` is the one worth waking someone for:
 * the service answered, but no longer in a shape we understand.
 */
export type Reason = 'contract' | 'unreachable' | 'missing' | 'unmatched' | 'internal';

export type ProviderHealth = {
	status: Status;
	/** How long the provider took to resolve its own probe link. */
	durationMs: number;
	reason?: Reason;
	/** Human-readable specifics, e.g. which field stopped matching the schema. */
	detail?: string;
};

export type Output = {
	/** The worst status across providers. */
	status: Status;
	checkedAt: string;
	/** Keyed by provider id, so a monitor can name one without relying on order. */
	providers: Record<string, ProviderHealth>;
};

/** Probes every provider against a pinned link and reports what it found. */
export interface Interactor {
	check(): Promise<Output>;
}
