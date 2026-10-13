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

// 工作台也保留空季度；指定历史链接始终优先于同季度草稿。
export function selectAnimeWorkbench(
	archive: AnimeArchive,
	records: AnimeDraftRecord[],
	boardId?: string,
	versionId?: string,
): {
	boardId: string;
	target: string;
	version: AnimeSnapshot | undefined;
	record: AnimeDraftRecord | undefined;
} {
	const candidates = [
		...archive.boards,
		...records.map((record) => ({
			id: record.boardId,
			year: record.draft.year,
			quarter: record.draft.quarter,
		})),
	];
	const id =
		boardId ||
		candidates.sort((a, b) => b.year - a.year || b.quarter - a.quarter)[0]
			?.id ||
		"";
	const { record, version } = selectAnimeState(archive, records, id, versionId);
	return {
		boardId: id,
		record,
		version,
		target: versionId
			? version?.id || ""
			: record
				? "draft"
				: version?.id || "",
	};
}
