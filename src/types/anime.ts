export type AnimeMode = "plan" | "review";
export type AnimePlacement = "pool" | `tier:${number}`;
export type AnimeSubject = { id: number; title: string; cover: string };
export type AnimeItem = AnimeSubject & { placement: AnimePlacement };
export type AnimeDraft = {
	title: string;
	year: number;
	quarter: number;
	mode: AnimeMode;
	tiers?: string[];
	items: AnimeItem[];
};
export type AnimeSnapshot = AnimeDraft & {
	id: string;
	label: string;
	createdAt: string;
	updatedAt?: string;
};
export type AnimeBoard = {
	id: string;
	title: string;
	year: number;
	quarter: number;
	versions: AnimeSnapshot[];
};
export type AnimeArchive = {
	boards: AnimeBoard[];
	reviews: Record<string, string>;
};
export type AnimeDraftRecord = {
	boardId: string;
	revision: string;
	label?: string;
	draft: AnimeDraft;
};

export type AnimeTrashedVersion = {
	boardId: string;
	boardTitle: string;
	year: number;
	quarter: number;
	snapshot: AnimeSnapshot;
	postId: string;
	deletedAt: string;
	order: string[];
};
export type AnimeDevState = {
	features: { tierNames: boolean; versionManagement: boolean };
	archive: AnimeArchive;
	drafts: AnimeDraftRecord[];
	versionRevisions: Record<string, string>;
	trash: AnimeTrashedVersion[];
};
