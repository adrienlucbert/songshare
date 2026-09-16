import { newCachedProvider } from './adapters/business/cached-provider';
import { DeezerProvider } from './adapters/business/deezer/provider';
import { newPostgresProviderCache } from './adapters/business/repository/postgres-provider-cache';
import { SpotifyProvider } from './adapters/business/spotify/provider';
import { newCachedHealthInteractor, newHealthInteractor } from './adapters/interactor/health';
import { newSearchInteractor } from './adapters/interactor/search';
import { presentHealth } from './adapters/presenter/health';
import { newJsonPresenter } from './adapters/presenter/json';
import { newPagePresenter, type PageView } from './adapters/presenter/page';
import { presentSearch } from './adapters/presenter/search';
import type { MusicProvider } from './business/music-provider';
import type { Presenter } from './usecase/presenter';
import type * as health from './usecase/health';
import type { Interactor, Output } from './usecase/search';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = newPostgresProviderCache(CACHE_TTL_MS);

const providers: readonly MusicProvider[] = [
	newCachedProvider(new SpotifyProvider(), cache),
	newCachedProvider(new DeezerProvider(), cache)
];

export const searchInteractor: Interactor = newSearchInteractor(providers);

export const searchJsonPresenter: Presenter<Output, Response> = newJsonPresenter(presentSearch);

/** Probes run at most this often, however often the endpoint is polled. */
const HEALTH_TTL_MS = 5 * 60 * 1000;

export const healthInteractor: health.Interactor = newCachedHealthInteractor(
	newHealthInteractor(providers),
	HEALTH_TTL_MS
);

export const healthPresenter: Presenter<health.Output, Response> = newJsonPresenter(presentHealth);

export const searchPagePresenter: Presenter<Output, PageView<Output>> = newPagePresenter<Output>();

export const healthPagePresenter: Presenter<
	health.Output,
	PageView<health.Output>
> = newPagePresenter<health.Output>();
