export type SharedLink = {
	id: string;
	url: string;
};

export interface SharedLinkRepository {
	share(url: string): Promise<SharedLink>;
	find(id: string): Promise<SharedLink | null>;
}
