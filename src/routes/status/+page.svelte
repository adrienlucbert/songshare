<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { BRAND } from '$lib/brand';
	import ProviderIcon, { brandOf } from '$lib/components/provider-icon.svelte';
	import { useTranslator } from '$lib/i18n';
	import * as m from '$lib/paraglide/messages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const { t } = useTranslator();

	const REFRESH_MS = 30_000;

	const PROVIDERS: Record<string, string> = { spotify: 'Spotify', deezer: 'Deezer' };
	const label = (id: string) => PROVIDERS[id] ?? id[0].toUpperCase() + id.slice(1);

	type Status = NonNullable<PageData['results']>['status'];
	type Reason = NonNullable<NonNullable<PageData['results']>['providers'][string]['reason']>;

	const STATUS: Record<Status, () => string> = {
		ok: m.status_ok,
		degraded: m.status_degraded,
		failing: m.status_failing
	};

	const DOT: Record<Status, string> = {
		ok: 'bg-emerald-500',
		degraded: 'bg-amber-500',
		failing: 'bg-red-500'
	};

	const REASON: Record<Reason, () => string> = {
		contract: m.reason_contract,
		unreachable: m.reason_unreachable,
		missing: m.reason_missing,
		unmatched: m.reason_unmatched,
		internal: m.reason_internal
	};

	const entries = $derived(Object.entries(data.results?.providers ?? {}));

	const checkedAt = $derived(
		data.results ? `${data.results.checkedAt.replace('T', ' ').slice(0, 16)} UTC` : ''
	);

	$effect(() => {
		const timer = setInterval(() => invalidateAll(), REFRESH_MS);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>{t(m.status_title)} - {BRAND}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet dot(status: Status)}
	<span class="relative flex size-2 shrink-0">
		{#if status === 'ok'}
			<span
				class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:hidden"
			></span>
		{/if}
		<span class="relative inline-flex size-2 rounded-full {DOT[status]}"></span>
	</span>
{/snippet}

<div class="space-y-1">
	<h1 class="text-2xl font-semibold tracking-tight">{t(m.status_title)}</h1>
	{#if data.results}
		<p class="flex items-center gap-2 text-sm text-muted-foreground">
			{@render dot(data.results.status)}
			{t(STATUS[data.results.status])}
		</p>
	{/if}
</div>

{#if data.results}
	<ul class="divide-y rounded-xl border bg-card/60">
		{#each entries as [provider, health] (provider)}
			<li class="flex items-center gap-3 p-4">
				<span
					class="grid size-9 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-foreground/10"
					style="color: {brandOf(provider)}"
				>
					<ProviderIcon {provider} class="size-5" />
				</span>

				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium">{label(provider)}</p>
					<p class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
						{@render dot(health.status)}
						{t(STATUS[health.status])}
					</p>
					{#if health.reason}
						<p class="mt-1 text-xs text-muted-foreground">{t(REASON[health.reason])}</p>
					{/if}
				</div>

				<span class="shrink-0 font-mono text-xs text-muted-foreground">{health.durationMs}ms</span>
			</li>
		{/each}
	</ul>

	<p class="text-xs text-muted-foreground">{t(m.last_checked)} {checkedAt}</p>
{:else}
	<p class="text-sm text-muted-foreground" role="alert">{t(m.error_unexpected)}</p>
{/if}
