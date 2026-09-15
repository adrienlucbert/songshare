import {
	EntityNotFoundError,
	ProviderUnavailableError,
	UnsupportedLinkError
} from '../../business/music-provider';
import { DomainError } from '../../domain/errors';

export type Failure = 'invalid_link' | 'unsupported' | 'not_found' | 'unavailable' | 'unexpected';

export function classify(error: unknown): Failure {
	if (error instanceof DomainError) return 'invalid_link';
	if (error instanceof UnsupportedLinkError) return 'unsupported';
	if (error instanceof EntityNotFoundError) return 'not_found';
	if (error instanceof ProviderUnavailableError) return 'unavailable';

	console.error('unhandled error while serving request', error);
	return 'unexpected';
}
