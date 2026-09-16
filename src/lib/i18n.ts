import { getContext, setContext } from 'svelte';
import type { Locale } from '$lib/paraglide/runtime';

export type Message = (inputs?: Record<string, never>, options?: { locale?: Locale }) => string;

export type Translator = {
	t: (message: Message) => string;
	locale: () => Locale;
};

const KEY = Symbol('translator');

export const provideTranslator = (translator: Translator) => setContext(KEY, translator);

export const useTranslator = (): Translator => getContext(KEY);
