import { json } from '@sveltejs/kit';

/**
 * Liveness only: is this process answering? Deliberately knows nothing about
 * Spotify or Deezer, so an orchestrator watching it never restarts us over
 * someone else's outage. Dependencies live at /health/providers.
 */
export function GET() {
	return json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
