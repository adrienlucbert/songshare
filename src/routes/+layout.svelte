<script lang="ts">
	import './layout.css';
	import Languages from '@lucide/svelte/icons/languages';
	import Moon from '@lucide/svelte/icons/moon';
	import Music from '@lucide/svelte/icons/music';
	import Server from '@lucide/svelte/icons/server';
	import Terminal from '@lucide/svelte/icons/terminal';
	import Sun from '@lucide/svelte/icons/sun';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { BRAND } from '$lib/brand';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { provideTranslator, type Message } from '$lib/i18n';
	import * as m from '$lib/paraglide/messages';
	import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';

	let { children } = $props();

	const GITHUB = 'https://github.com/adrienlucbert/songshare';
	const SELF_HOSTING = 'https://github.com/adrienlucbert/songshare#self-hosting';
	const API_DOCS = 'https://github.com/adrienlucbert/songshare#public-api';

	const LANGUAGES: { value: Locale; flag: string; name: string }[] = [
		{ value: 'en', flag: '🇬🇧', name: 'English' },
		{ value: 'fr', flag: '🇫🇷', name: 'Français' }
	];

	let locale = $state<Locale>(getLocale());

	const t = (message: Message) => message({}, { locale });

	provideTranslator({ t, locale: () => locale });

	function switchTo(next: Locale) {
		if (next === locale) return;
		setLocale(next, { reload: false });
		locale = next;
		document.documentElement.lang = next;
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

<div class="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-8 px-5 py-10 sm:py-16">
	<header class="flex items-center justify-between">
		<a href={resolve('/')} class="flex items-center gap-2 font-semibold tracking-tight">
			<span class="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
				<Music class="size-4" />
			</span>
			{BRAND}
		</a>

		<div class="flex items-center gap-1">
			<Button variant="ghost" size="sm" href={resolve('/status')}>{t(m.nav_status)}</Button>

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

	<main class="flex flex-1 flex-col gap-8">
		{@render children()}
	</main>

	<footer class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-6">
		<a
			href={GITHUB}
			target="_blank"
			rel="noreferrer"
			aria-label={t(m.view_source)}
			class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="size-3.5">
				<path
					d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
				/>
			</svg>
			GitHub
		</a>

		<a
			href={API_DOCS}
			target="_blank"
			rel="noreferrer"
			class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
		>
			<Terminal class="size-3.5 shrink-0" />
			API
		</a>

		<a
			href={SELF_HOSTING}
			target="_blank"
			rel="noreferrer"
			class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
		>
			<Server class="size-3.5 shrink-0" />
			{t(m.self_host)}
		</a>
	</footer>
</div>
