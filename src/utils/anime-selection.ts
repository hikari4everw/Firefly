import type {
	AnimeArchive,
	AnimeBoard,
	AnimeDraftRecord,
	AnimeSnapshot,
} from "../types/anime";

export function selectAnimeState(
	archive: AnimeArchive,
	records: AnimeDraftRecord[] = [],
	boardId?: string,
	versionId?: string,
): {
	board: AnimeBoard | undefined;
	version: AnimeSnapshot | undefined;
	record: AnimeDraftRecord | undefined;
} {
	const candidates = [
		...archive.boards.filter((x) => x.versions.length),
		...records.map((x) => ({
			id: x.boardId,
			year: x.draft.year,
			quarter: x.draft.quarter,
		})),
	];
	const id =
		boardId ||
		candidates.sort((a, b) => b.year - a.year || b.quarter - a.quarter)[0]?.id;
	const board = archive.boards.find((x) => x.id === id);
	return {
		board,
		record: records.find((x) => x.boardId === id),
		version: versionId
			? board?.versions.find((x) => x.id === versionId)
			: board?.versions.at(-1),
	};
}
