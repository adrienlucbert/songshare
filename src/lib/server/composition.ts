import { DeezerProvider } from './adapters/business/deezer/provider';
import { SpotifyProvider } from './adapters/business/spotify/provider';
import { newSearchInteractor } from './adapters/interactor/search';
import { newJsonPresenter } from './adapters/presenter/json';
import { newPagePresenter, type PageView } from './adapters/presenter/page';
import { presentSearch } from './adapters/presenter/search';
import type { MusicProvider } from './business/music-provider';
import type { Presenter } from './usecase/presenter';
import type { Interactor, Output } from './usecase/search';

const providers: readonly MusicProvider[] = [new SpotifyProvider(), new DeezerProvider()];

export const searchInteractor: Interactor = newSearchInteractor(providers);

export const searchJsonPresenter: Presenter<Output, Response> = newJsonPresenter(presentSearch);

export const searchPagePresenter: Presenter<Output, PageView<Output>> = newPagePresenter<Output>();
