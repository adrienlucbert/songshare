export class DomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class InvalidShareLinkError extends DomainError {
	constructor(raw: string) {
		super(`Not a usable link: ${raw}`);
	}
}
