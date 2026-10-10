import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	AnimeArchive,
	AnimeDraftRecord,
	AnimeSnapshot,
} from "../src/types/anime";
import { selectAnimeState } from "../src/utils/anime-selection";

const snapshot = (
	year: number,
	quarter: number,
	id: string,
	createdAt: string,
): AnimeSnapshot => ({
	id,
	createdAt,
	title: `${year}-${quarter}`,
	year,
	quarter,
	mode: "plan",
	items: [],
	label: id,
});
const archive: AnimeArchive = {
	boards: [
		{
			id: "2026-10",
			year: 2026,
			quarter: 10,
			title: "Oct",
			versions: [
				snapshot(2026, 10, "old", "2026-10-01"),
				snapshot(2026, 10, "new", "2028-01-01"),
			],
		},
		{
			id: "2027-1",
			year: 2027,
			quarter: 1,
			title: "Jan",
			versions: [snapshot(2027, 1, "jan", "2027-01-01")],
		},
	],
	reviews: {},
};
const records: AnimeDraftRecord[] = [
	{
		boardId: "2027-4",
		revision: "draft-revision",
		draft: snapshot(2027, 4, "draft", "2027-04-01"),
	},
	{
		boardId: "2027-1",
		revision: "jan-revision",
		draft: { ...archive.boards[1].versions[0], title: "Jan draft" },
	},
];

test("latest existing quarter wins across years despite an older quarter's later save", () => {
	const result = selectAnimeState(archive, []);
	assert.equal(result.board?.id, "2027-1");
	assert.equal(result.version?.id, "jan");
	assert.equal(result.record, undefined);
});
test("editor includes draft-only quarters and prefers the quarter's saved draft", () => {
	assert.equal(selectAnimeState(archive, records).record?.boardId, "2027-4");
	const result = selectAnimeState(archive, records, "2027-1");
	assert.equal(result.record?.draft.title, "Jan draft");
	assert.equal(result.version?.id, "jan");
});
test("explicit quarter and history remain selected; invalid links never fall back", () => {
	assert.equal(
		selectAnimeState(archive, records, "2026-10", "old").version?.id,
		"old",
	);
	assert.equal(selectAnimeState(archive, [], "2026-10").version?.id, "new");
	assert.equal(
		selectAnimeState(archive, [], "2026-10", "missing").version,
		undefined,
	);
	assert.equal(selectAnimeState(archive, [], "2025-1").board, undefined);
});
test("empty state does not create a board and selection does not change source order", () => {
	assert.equal(
		selectAnimeState({ boards: [], reviews: {} }, []).board,
		undefined,
	);
	assert.equal(
		selectAnimeState({ boards: [], reviews: {} }, []).record,
		undefined,
	);
	selectAnimeState(archive, records);
	assert.deepEqual(
		archive.boards.map((x) => x.id),
		["2026-10", "2027-1"],
	);
});
