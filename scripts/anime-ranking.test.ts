import assert from "node:assert/strict";
import { test } from "node:test";
import * as ranking from "../src/utils/anime-ranking.ts";

const draft = () => ({
	title: "4月新番",
	year: 2026,
	quarter: 4,
	mode: "plan",
	items: [
		{ id: 1, title: "A", cover: "", placement: "pool" },
		{ id: 2, title: "B", cover: "", placement: "tier:0" },
		{ id: 3, title: "C", cover: "", placement: "tier:0" },
	],
});
test("moves a cover to a tier once and preserves insertion order", () => {
	const value = ranking.validateDraft(draft());
	const moved = ranking.moveItem(value, 1, "tier:1", null);
	assert.equal(moved.items.find((x) => x.id === 1)?.placement, "tier:1");
	const reordered = ranking.moveItem(moved, 3, "tier:0", 2);
	assert.deepEqual(
		reordered.items.filter((x) => x.placement === "tier:0").map((x) => x.id),
		[3, 2],
	);
	assert.deepEqual(
		value.items.map((x) => x.id),
		[1, 2, 3],
	);
});
test("rejects impossible boundaries and duplicate subjects", () => {
	assert.throws(() =>
		ranking.validateDraft({
			...draft(),
			items: [{ id: 1, title: "A", cover: "", placement: "boundary:2" }],
		}),
	);
	assert.throws(() =>
		ranking.validateDraft({
			...draft(),
			items: [draft().items[0], draft().items[0]],
		}),
	);
	assert.throws(() =>
		ranking.validateDraft({
			...draft(),
			items: [{ ...draft().items[0], cover: "javascript:alert(1)" }],
		}),
	);
});
test("plan to review preserves subjects and resets their tiers", () => {
	const next = ranking.convertMode(ranking.validateDraft(draft()), "review");
	assert.equal(next.mode, "review");
	assert.deepEqual(
		next.items.map((x) => x.placement),
		["pool", "pool", "pool"],
	);
});
test("reimport adds only new subjects without overwriting rankings", () => {
	const next = ranking.mergeImported(ranking.validateDraft(draft()), [
		{ id: 2, title: "Changed", cover: "" },
		{ id: 4, title: "D", cover: "" },
	]);
	assert.equal(next.items.length, 4);
	assert.equal(next.items.find((x) => x.id === 2)?.title, "B");
	assert.equal(next.items.find((x) => x.id === 4)?.placement, "pool");
});
test("snapshot does not change when its source draft changes", () => {
	const value = ranking.validateDraft(draft());
	const snapshot = ranking.createSnapshot(
		value,
		"追番计划",
		"v1",
		"2026-10-09T12:00:00Z",
	);
	value.items[0].title = "Changed";
	assert.equal(snapshot.items[0].title, "A");
	assert.equal(snapshot.label, "追番计划");
});

test("new placements reject boundaries; legacy reads preserve order in upper tiers", () => {
	const legacy = {
		...draft(),
		items: [
			{ id: 1, title: "A", cover: "", placement: "boundary:0" },
			...draft().items.slice(1),
		],
	};
	assert.throws(() => ranking.validateDraft(legacy));
	const normalized = ranking.normalizeLegacyDraft(legacy);
	assert.deepEqual(
		normalized.items.map((x) => x.id),
		[1, 2, 3],
	);
	assert.deepEqual(
		normalized.items.map((x) => x.placement),
		["tier:0", "tier:0", "tier:0"],
	);
	assert.equal(legacy.items[0].placement, "boundary:0");
	assert.throws(() =>
		ranking.normalizeLegacyDraft({
			...legacy,
			items: [{ ...legacy.items[0], placement: "boundary:2" }],
		}),
	);
});
