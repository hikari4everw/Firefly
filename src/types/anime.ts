export type AnimeMode = "plan" | "review";
export type AnimePlacement = "pool" | `tier:${number}`;
export type AnimeSubject = { id: number; title: string; cover: string };
export type AnimeItem = AnimeSubject & { placement: AnimePlacement };
export type AnimeDraft = {
	title: string;
	year: number;
	quarter: number;
	mode: AnimeMode;
	items: AnimeItem[];
};
export type AnimeSnapshot = AnimeDraft & {
	id: string;
	label: string;
	createdAt: string;
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
	draft: AnimeDraft;
};
