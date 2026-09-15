<script lang="ts">
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Check from '@lucide/svelte/icons/check';
	import Languages from '@lucide/svelte/icons/languages';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Moon from '@lucide/svelte/icons/moon';
	import Music from '@lucide/svelte/icons/music';
	import Search from '@lucide/svelte/icons/search';
	import Sun from '@lucide/svelte/icons/sun';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import ProviderIcon, { brandOf } from '$lib/components/provider-icon.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as m from '$lib/paraglide/messages';
	import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let locale = $state<Locale>(getLocale());

	type Message = (inputs?: Record<string, never>, options?: { locale?: Locale }) => string;

	const t = (message: Message) => message({}, { locale });

	const LANGUAGES: { value: Locale; flag: string; name: string }[] = [
		{ value: 'en', flag: '🇬🇧', name: 'English' },
		{ value: 'fr', flag: '🇫🇷', name: 'Français' }
	];

	function switchTo(next: Locale) {
		if (next === locale) return;
		setLocale(next, { reload: false });
		locale = next;
		document.documentElement.lang = next;
	}

	const PROVIDERS: Record<string, string> = { spotify: 'Spotify', deezer: 'Deezer' };
	const label = (id: string) => PROVIDERS[id] ?? id[0].toUpperCase() + id.slice(1);

	const KINDS: Record<string, () => string> = {
		track: m.kind_track,
		album: m.kind_album,
		artist: m.kind_artist,
		podcast: m.kind_podcast,
		podcast_episode: m.kind_podcast_episode
	};

	type Failure = NonNullable<PageData['failure']>;

	const FAILURES: Record<Failure, () => string> = {
		invalid_link: m.error_invalid_link,
		unsupported: m.error_unsupported,
		not_found: m.error_not_found,
		unavailable: m.error_unavailable,
		unexpected: m.error_unexpected
	};

	const entries = $derived.by(() => {
		if (!data.results) return [];
		const { origin, matches } = data.results;
		return Object.entries(matches).sort(([a], [b]) =>
			a === origin ? -1 : b === origin ? 1 : a.localeCompare(b)
		);
	});

	const subject = $derived(entries[0]?.[1] ?? null);

	const artwork = $derived.by(() => {
		if (!subject) return null;
		if (subject.type === 'track') return subject.album.cover.url;
		if (subject.type === 'artist') return subject.cover?.url ?? null;
		return subject.cover.url;
	});

	const caption = $derived.by(() => {
		if (!subject) return '';
		switch (subject.type) {
			case 'track':
				return `${subject.artists.map((a: { name: string }) => a.name).join(', ')} · ${subject.album.name}`;
			case 'album':
				return subject.artists.map((a: { name: string }) => a.name).join(', ');
			case 'artist':
				return t(m.kind_artist);
			case 'podcast':
				return subject.publisher ?? t(m.kind_podcast);
			case 'podcast_episode':
				return subject.podcast.name;
		}
	});

	const busy = $derived(Boolean(navigating.to));

	const title = $derived(subject ? `${subject.name} - SongShare` : 'SongShare');
	const description = $derived(subject ? caption : t(m.page_description));

	let copied = $state(false);

	async function copyPageLink() {
		await navigator.clipboard.writeText(page.url.href);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	let dark = $state(false);

	onMount(() => {
		dark = document.documentElement.classList.contains('dark');
	});

	function toggleTheme() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {}
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />

	<meta property="og:site_name" content="SongShare" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if artwork}
		<meta property="og:image" content={artwork} />
	{/if}
</svelte:head>

{#if artwork}
	<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
		<img src={artwork} alt="" class="size-full scale-150 object-cover opacity-20 blur-3xl" />
		<div
			class="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background"
		></div>
	</div>
{/if}

<main class="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-8 px-5 py-10 sm:py-16">
	<header class="flex items-center justify-between">
		<a href={resolve('/')} class="flex items-center gap-2 font-semibold tracking-tight">
			<span class="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
				<Music class="size-4" />
			</span>
			SongShare
		</a>

		<div class="flex items-center gap-1">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" aria-label={t(m.switch_language)}>
							<Languages />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.RadioGroup
						value={locale}
						onValueChange={(next) => switchTo(next as Locale)}
					>
						{#each LANGUAGES as language (language.value)}
							<DropdownMenu.RadioItem value={language.value}>
								<span aria-hidden="true">{language.flag}</span>
								{language.name}
							</DropdownMenu.RadioItem>
						{/each}
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<Button variant="ghost" size="sm" onclick={toggleTheme} aria-label={t(m.switch_theme)}>
				{#if dark}<Sun />{:else}<Moon />{/if}
			</Button>
		</div>
	</header>

	<div class="space-y-3">
		<h1 class="text-2xl font-semibold tracking-tight text-balance">{t(m.tagline)}</h1>
		<p class="text-sm text-muted-foreground">{t(m.intro)}</p>

		<form method="GET" class="flex gap-2 pt-1">
			<div class="relative flex-1">
				<Link2
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					name="url"
					type="url"
					inputmode="url"
					placeholder="https://open.spotify.com/track/…"
					value={data.query}
					autocomplete="off"
					aria-label={t(m.link_label)}
					class="pl-9"
				/>
			</div>
			<Button type="submit" disabled={busy}>
				<Search />
				<span class="hidden sm:inline">{t(m.look_up)}</span>
			</Button>
		</form>
	</div>

	{#if busy}
		<div class="rounded-xl border bg-card/60 p-5 backdrop-blur-sm">
			<div class="flex items-center gap-4">
				<Skeleton class="size-24 shrink-0 rounded-xl" />
				<div class="flex-1 space-y-2">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-5 w-3/4" />
					<Skeleton class="h-4 w-1/2" />
				</div>
			</div>
			<div class="mt-5 space-y-2">
				<Skeleton class="h-14 w-full rounded-lg" />
				<Skeleton class="h-14 w-full rounded-lg" />
			</div>
		</div>
	{:else if data.failure}
		<div class="rounded-xl border bg-card/60 p-5 text-sm backdrop-blur-sm" role="alert">
			<p class="font-medium">{t(m.error_title)}</p>
			<p class="mt-1 text-muted-foreground">{t(FAILURES[data.failure])}</p>
		</div>
	{:else if subject}
		<div class="rounded-xl border bg-card/60 shadow-sm backdrop-blur-sm">
			<div class="flex items-start gap-4 p-5">
				{#if artwork}
					<img
						src={artwork}
						alt=""
						width="96"
						height="96"
						class="size-24 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-foreground/10"
					/>
				{:else}
					<div
						class="grid size-24 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-foreground/10"
					>
						<Music class="size-8" />
					</div>
				{/if}

				<div class="min-w-0 flex-1 space-y-1.5">
					<Badge variant="secondary">{t(KINDS[subject.type])}</Badge>
					<h2 class="truncate text-lg leading-tight font-semibold">{subject.name}</h2>
					<p class="truncate text-sm text-muted-foreground">{caption}</p>
				</div>
			</div>

			<ul class="space-y-1 px-3 pb-3">
				{#each entries as [provider, entity] (provider)}
					<li>
						<a
							href={entity.url}
							target="_blank"
							rel="noreferrer"
							class="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-foreground/10"
								style="color: {brandOf(provider)}"
							>
								<ProviderIcon {provider} class="size-5" />
							</span>

							<span class="min-w-0 flex-1">
								<span class="block text-sm font-medium">{label(provider)}</span>
								{#if provider === data.results?.origin}
									<span class="block text-xs text-muted-foreground">{t(m.pasted_link)}</span>
								{/if}
							</span>

							<ArrowUpRight
								class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
							/>
						</a>
					</li>
				{/each}
			</ul>

			<div class="flex justify-end border-t px-3 py-2">
				<Button variant="ghost" size="sm" onclick={copyPageLink}>
					{#if copied}<Check />{t(m.copied)}{:else}<Link2 />{t(m.copy_page)}{/if}
				</Button>
			</div>
		</div>
	{/if}
</main>
