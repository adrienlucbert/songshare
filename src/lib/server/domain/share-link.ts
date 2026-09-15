import { InvalidShareLinkError } from './errors';

export class ShareLink {
	private constructor(readonly url: URL) { }

	static parse(raw: string): ShareLink {
		const trimmed = raw?.trim() ?? '';
		if (!trimmed || !URL.canParse(trimmed)) {
			throw new InvalidShareLinkError(raw);
		}

		return new ShareLink(new URL(trimmed));
	}

	get host(): string {
		return this.url.hostname;
	}

	get segments(): string[] {
		return this.url.pathname.split('/').filter(Boolean);
	}

	toString(): string {
		return this.url.toString();
	}
}
