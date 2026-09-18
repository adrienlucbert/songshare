import { newCachedProvider } from './adapters/business/cached-provider';
import { DeezerProvider } from './adapters/business/deezer/provider';
import { newPostgresProviderCache } from './adapters/business/repository/postgres-provider-cache';
import { newPostgresSharedLinkRepository } from './adapters/business/repository/postgres-shared-link-repository';
import { SpotifyProvider } from './adapters/business/spotify/provider';
import { YouTubeMusicProvider } from './adapters/business/youtube-music/provider';
import { YouTubeProvider } from './adapters/business/youtube/provider';
import { newCachedHealthInteractor, newHealthInteractor } from './adapters/interactor/health';
import { newSearchInteractor } from './adapters/interactor/search';
import { newShareLinkInteractor } from './adapters/interactor/share-link';
import { presentHealth } from './adapters/presenter/health';
import { newJsonPresenter } from './adapters/presenter/json';
import { newPagePresenter, type PageView } from './adapters/presenter/page';
import { presentSearch } from './adapters/presenter/search';
import type { MusicProvider } from './business/music-provider';
import type { Presenter } from './usecase/presenter';
import type * as health from './usecase/health';
import type { Interactor, Output } from './usecase/search';
import type * as shareLink from './usecase/share-link';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = newPostgresProviderCache(CACHE_TTL_MS);

const spotify = new SpotifyProvider();
const deezer = new DeezerProvider();
const youtubeMusic = new YouTubeMusicProvider();
const youtube = new YouTubeProvider();

const providers: readonly MusicProvider[] = [
	newCachedProvider(spotify, cache),
	newCachedProvider(deezer, cache),
	newCachedProvider(youtubeMusic, cache),
	newCachedProvider(youtube, cache)
];

export const searchInteractor: Interactor = newSearchInteractor(providers);

export const shareLinkInteractor: shareLink.Interactor = newShareLinkInteractor(
	newPostgresSharedLinkRepository(),
	searchInteractor
);

export const searchJsonPresenter: Presenter<Output, Response> = newJsonPresenter(presentSearch);

const HEALTH_TTL_MS = 5 * 60 * 1000;

export const healthInteractor: health.Interactor = newCachedHealthInteractor(
	newHealthInteractor([spotify, deezer, youtubeMusic, youtube]),
	HEALTH_TTL_MS
);

export const healthPresenter: Presenter<health.Output, Response> = newJsonPresenter(presentHealth);

export const searchPagePresenter: Presenter<Output, PageView<Output>> = newPagePresenter<Output>();

export const healthPagePresenter: Presenter<
	health.Output,
	PageView<health.Output>
> = newPagePresenter<health.Output>();
