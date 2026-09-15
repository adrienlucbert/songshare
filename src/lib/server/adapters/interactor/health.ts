import {
	EntityNotFoundError,
	ProviderContractError,
	ProviderUnavailableError,
	type MusicProvider
} from '../../business/music-provider';
import type { AnyEntity } from '../../domain/entity';
import { ShareLink } from '../../domain/share-link';
import type { Interactor, Output, ProviderHealth, Reason, Status } from '../../usecase/health';

const SEVERITY: Record<Reason, Status> = {
	contract: 'failing',
	unreachable: 'failing',
	internal: 'failing',
	missing: 'degraded',
	unmatched: 'degraded'
};

const RANK: Record<Status, number> = { ok: 0, degraded: 1, failing: 2 };

function worst(statuses: Status[]): Status {
	return statuses.reduce((a, b) => (RANK[a] >= RANK[b] ? a : b), 'ok');
}

function diagnose(error: unknown): { reason: Reason; detail: string } {
	if (error instanceof ProviderContractError) {
		return { reason: 'contract', detail: error.message };
	}
	if (error instanceof ProviderUnavailableError) {
		return { reason: 'unreachable', detail: error.message };
	}
	if (error instanceof EntityNotFoundError) {
		return { reason: 'missing', detail: 'the probe link no longer resolves' };
	}

	return { reason: 'internal', detail: (error as Error).message };
}

type Probe = {
	id: string;
	health: ProviderHealth;
	entity: AnyEntity | null;
};

class HealthInteractor implements Interactor {
	constructor(private readonly providers: readonly MusicProvider[]) { }

	async check(): Promise<Output> {
		const probes = await Promise.all(this.providers.map((p) => this.resolve(p)));

		const reference = probes.find((probe) => probe.entity !== null);

		const checked = await Promise.all(
			probes.map(async (probe, i) => ({
				id: probe.id,
				health:
					probe === reference || !reference?.entity
						? probe.health
						: await this.withMatch(this.providers[i], probe.health, reference.entity)
			}))
		);

		return {
			status: worst(checked.map((c) => c.health.status)),
			checkedAt: new Date().toISOString(),
			providers: Object.fromEntries(checked.map((c) => [c.id, c.health]))
		};
	}

	private async resolve(provider: MusicProvider): Promise<Probe> {
		const started = Date.now();

		try {
			const entity = await provider.fetchLinkContent(ShareLink.parse(provider.probeUrl));

			return {
				id: provider.id,
				entity,
				health: { status: 'ok', durationMs: Date.now() - started }
			};
		} catch (error) {
			const { reason, detail } = diagnose(error);

			return {
				id: provider.id,
				entity: null,
				health: {
					status: SEVERITY[reason],
					durationMs: Date.now() - started,
					reason,
					detail
				}
			};
		}
	}

	private async withMatch(
		provider: MusicProvider,
		health: ProviderHealth,
		reference: AnyEntity
	): Promise<ProviderHealth> {
		if (health.status === 'failing') return health;

		try {
			if (await provider.search(reference)) return health;

			return {
				...health,
				status: worst([health.status, 'degraded']),
				reason: 'unmatched',
				detail: `no match found for ${reference.type} "${reference.name}"`
			};
		} catch (error) {
			const { reason, detail } = diagnose(error);

			return { ...health, status: worst([health.status, SEVERITY[reason]]), reason, detail };
		}
	}
}

export function newHealthInteractor(providers: readonly MusicProvider[]): Interactor {
	return new HealthInteractor(providers);
}

export function newCachedHealthInteractor(inner: Interactor, ttlMs: number): Interactor {
	let snapshot: Output | null = null;
	let takenAt = 0;
	let pending: Promise<Output> | null = null;

	const refresh = () => {
		pending ??= inner
			.check()
			.then((next) => {
				snapshot = next;
				takenAt = Date.now();
				return next;
			})
			.finally(() => {
				pending = null;
			});

		return pending;
	};

	return {
		async check(): Promise<Output> {
			if (snapshot && Date.now() - takenAt < ttlMs) return snapshot;

			return refresh();
		}
	};
}
