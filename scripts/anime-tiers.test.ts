import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnimeDraft } from "../src/types/anime";
import * as ranking from "../src/utils/anime-ranking";

const draft = (): AnimeDraft => ({
	title: "4月新番", year: 2026, quarter: 4, mode: "plan",
	items: [
		{ id: 1, title: "A", cover: "", placement: "tier:0" },
		{ id: 2, title: "B", cover: "", placement: "tier:1" },
		{ id: 3, title: "C", cover: "", placement: "tier:1" },
		{ id: 4, title: "D", cover: "", placement: "tier:2" },
		{ id: 5, title: "E", cover: "", placement: "pool" },
	],
});

test("tier edits remain available while the board title is being edited", () => {
	const value = { ...draft(), title: "" };
	assert.equal(ranking.addAnimeTier(value).tiers?.length, 4);
	assert.equal(ranking.renameAnimeTier(value, 0, "首选").tiers?.[0], "首选");
	assert.equal(ranking.removeAnimeTier(value, 0).tiers?.length, 2);
	assert.throws(() => ranking.validateDraft(value));
});

test("legacy drafts retain their default tiers and do not acquire stored custom tiers", () => {
	const value = ranking.validateDraft(draft());
	assert.deepEqual(ranking.getAnimeTiers(value), ["必追", "想追", "观望"]);
	assert.equal(value.tiers, undefined);
});

test("custom tiers determine valid placements and survive validation and import", () => {
	const value = ranking.validateDraft({ ...draft(), tiers: [" A ", "B", "C", "D"] });
	assert.deepEqual(value.tiers, ["A", "B", "C", "D"]);
	const moved = ranking.moveItem(value, 5, "tier:3", null);
	assert.equal(moved.items.at(-1)?.placement, "tier:3");
	assert.deepEqual(ranking.mergeImported(moved, [{ id: 6, title: "F", cover: "" }]).tiers, value.tiers);
	assert.throws(() => ranking.moveItem(value, 5, "tier:4", null));
	assert.throws(() => ranking.validateDraft({ ...value, tiers: ["A" ] }));
});

test("tier names and count are validated", () => {
	for (const tiers of [[], Array(21).fill("A"), [""], ["  "], ["A".repeat(31)], [null], "A"]) {
		assert.throws(() => ranking.validateDraft({ ...draft(), items: [], tiers }));
	}
	assert.equal(ranking.validateDraft({ ...draft(), items: [], tiers: Array(20).fill("A") }).tiers?.length, 20);
});

test("adding and renaming tiers creates independent undoable drafts", () => {
	const original = draft();
	const added = ranking.addAnimeTier(original);
	assert.deepEqual(added.tiers, ["必追", "想追", "观望", "新栏目"]);
	const renamed = ranking.renameAnimeTier(added, 3, "  暂停观看  ");
	assert.equal(renamed.tiers?.[3], "暂停观看");
	assert.equal(added.tiers?.[3], "新栏目");
	assert.equal(original.tiers, undefined);
	assert.deepEqual(renamed.items, original.items);
	assert.throws(() => ranking.renameAnimeTier(added, 3, " "));
	assert.throws(() => ranking.renameAnimeTier(added, 8, "A"));
	assert.throws(() => ranking.addAnimeTier({ ...original, tiers: Array(20).fill("A") }));
});

for (const index of [0, 1, 2]) {
	test(`deleting tier ${index} preserves every subject and adjusts later placements`, () => {
		const original = draft();
		const next = ranking.removeAnimeTier(original, index);
		assert.deepEqual(next.items.map((item) => item.id), [1, 2, 3, 4, 5]);
		for (let i = 0; i < original.items.length; i++) {
			const placement = original.items[i].placement;
			const tier = placement === "pool" ? -1 : Number(placement.slice(5));
			const expected = tier === index ? "pool" : tier > index ? `tier:${tier - 1}` : placement;
			assert.equal(next.items[i].placement, expected);
		}
		assert.deepEqual(next.tiers, ranking.ANIME_TIERS.plan.filter((_, i) => i !== index));
		assert.equal(original.items[1].placement, "tier:1");
		ranking.validateDraft(next);
	});
}

test("the last tier cannot be deleted and invalid indexes are rejected", () => {
	assert.throws(() => ranking.removeAnimeTier({ ...draft(), items: [], tiers: ["A"] }, 0));
	for (const index of [-1, 0.5, 3]) assert.throws(() => ranking.removeAnimeTier(draft(), index));
});

test("switching mode resets custom names and all placements", () => {
	const next = ranking.convertMode({ ...draft(), tiers: ["A", "B", "C"] }, "review");
	assert.deepEqual(ranking.getAnimeTiers(next), ranking.ANIME_TIERS.review);
	assert.ok(next.items.every((item) => item.placement === "pool"));
});

test("public snapshots copy their own tier names and remain unchanged after editing", () => {
	const value = ranking.validateDraft({ ...draft(), tiers: ["A", "B", "C"] });
	const snapshot = ranking.createSnapshot(value, "中期", "v1", "2026-10-12T00:00:00Z");
	value.tiers![0] = "Changed";
	assert.deepEqual(snapshot.tiers, ["A", "B", "C"]);
	const next = ranking.removeAnimeTier(snapshot, 1);
	assert.deepEqual(snapshot.tiers, ["A", "B", "C"]);
	assert.equal(next.tiers?.length, 2);
});

test("legacy boundaries normalize against the actual custom tier count", () => {
	const next = ranking.normalizeLegacyDraft({ ...draft(), tiers: ["A", "B", "C", "D"], items: [{ id: 1, title: "A", cover: "", placement: "boundary:2" }] });
	assert.equal(next.items[0].placement, "tier:2");
	assert.deepEqual(next.tiers, ["A", "B", "C", "D"]);
});
