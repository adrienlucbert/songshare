let blockedUntil = 0;

const FALLBACK_SECONDS = 5;

export function noteRateLimit(response: Response): void {
	const asked = Number(response.headers.get('retry-after'));
	const seconds = Number.isFinite(asked) && asked > 0 ? asked : FALLBACK_SECONDS;

	blockedUntil = Math.max(blockedUntil, Date.now() + seconds * 1000);
}

export function rateLimitedFor(): number {
	const remaining = blockedUntil - Date.now();

	return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function forgetRateLimit(): void {
	blockedUntil = 0;
}
