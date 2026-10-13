import type {
	AnimeDevState,
	AnimeDraftRecord,
	AnimeSnapshot,
	AnimeSubject,
} from "../src/types/anime";
export function createAnimeStore(root: string): {
	state(): Promise<AnimeDevState>;
	saveDraft(
		id: string,
		draft: unknown,
		revision: string | null,
		label?: string,
	): Promise<AnimeDraftRecord>;
	publish(id: string, revision: string, label: string): Promise<AnimeSnapshot>;
	setReview(
		id: string,
		versionId: string,
		postId: string,
		versionRevision: string,
	): Promise<void>;
	updateVersion(
		id: string,
		versionId: string,
		draft: unknown,
		label: string,
		postId: string,
		versionRevision: string,
	): Promise<AnimeSnapshot>;
	copyVersion(
		id: string,
		versionId: string,
		draft: unknown,
		label: string,
		postId: string,
		versionRevision: string,
	): Promise<AnimeSnapshot>;
	trashVersion(
		id: string,
		versionId: string,
		versionRevision: string,
	): Promise<void>;
	restoreVersion(
		id: string,
		versionId: string,
	): Promise<{ snapshot: AnimeSnapshot; warning?: string }>;
};
export function isLocalRequest(request: {
	socket: { remoteAddress?: string };
	headers: { host?: string; origin?: string; "sec-fetch-site"?: string };
	method?: string;
}): boolean;
export function importQuarter(
	apiUrl: string,
	year: number,
	quarter: number,
	fetcher?: (url: string, options: RequestInit) => Promise<Response>,
	limit?: number,
): Promise<AnimeSubject[]>;
export function animeDevApi(apiUrl: string): {
	name: string;
	apply: "serve";
	config(config: { server?: { fs?: { deny?: string[] } } }): {
		server: { fs: { deny: string[] } };
	};
	configureServer(server: unknown): void;
};
