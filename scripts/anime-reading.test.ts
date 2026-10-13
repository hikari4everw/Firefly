import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnimeDraft } from "../src/types/anime";
import * as ranking from "../src/utils/anime-ranking";
import * as reviews from "../src/utils/anime-reviews";

const legacy = (): AnimeDraft => ({ title: "验收", year: 2026, quarter: 10, mode: "review", items: [
	{ id: 1, title: "Alpha 动画", cover: "", placement: "tier:0" },
	{ id: 2, title: "ALPHA season 2", cover: "", placement: "pool" },
	{ id: 3, title: "中文动画", cover: "", placement: "pool" },
	{ id: 4, title: "末栏", cover: "", placement: "tier:4" },
] });

test("new review defaults have four tiers while old snapshots keep five", () => {
	assert.deepEqual(ranking.ANIME_TIERS.review, ["神作", "佳作", "还行", "拉"]);
	const old = ranking.normalizeLegacyDraft(legacy());
	assert.deepEqual(ranking.getAnimeTiers(old), ["神作", "佳作", "还行", "及格", "差"]);
	assert.equal(old.items[3].placement, "tier:4");
});

test("editor upgrades only the old default review tiers without changing historical data", () => {
	const old = ranking.normalizeLegacyDraft(legacy());
	const current = ranking.prepareAnimeDraftForEditing(old);
	assert.deepEqual(current.tiers, ["神作", "佳作", "还行", "拉"]);
	assert.equal(current.items[3].placement, "pool");
	assert.deepEqual(current.items.map(x => x.id), old.items.map(x => x.id));
	assert.equal(old.items[3].placement, "tier:4");
	assert.equal(ranking.getAnimeTiers(old).length, 5);
	const custom = { ...old, tiers: ["A", "B", "C", "D", "E"] };
	assert.deepEqual(ranking.prepareAnimeDraftForEditing(custom), custom);
	const fresh = ranking.convertMode({ ...old, mode: "plan", items: [] }, "review");
	assert.deepEqual(ranking.getAnimeTiers(fresh), ranking.ANIME_TIERS.review);
});

test("pool search is partial, case insensitive, trimmed and never changes source order", () => {
	const value = legacy();
	assert.deepEqual(ranking.searchAnimePool(value, "  alpha ").map(x => x.id), [2]);
	assert.deepEqual(ranking.searchAnimePool(value, "动画").map(x => x.id), [3]);
	assert.deepEqual(ranking.searchAnimePool(value, " ").map(x => x.id), [2, 3]);
	assert.deepEqual(ranking.searchAnimePool(value, "无结果"), []);
	const moved = ranking.moveItem(ranking.normalizeLegacyDraft(value), 2, "tier:0", 1);
	assert.deepEqual(ranking.searchAnimePool(moved, "alpha"), []);
	assert.deepEqual(value.items.map(x => x.id), [1, 2, 3, 4]);
});

test("only ACG tracking posts are new review candidates; the current existing link remains available", () => {
	const posts = [
		{ id: "matching", data: { category: "ACG", series: "追番", draft: false, password: "" } },
		{ id: "other-series", data: { category: "ACG", series: "游戏", draft: false, password: "" } },
		{ id: "other-category", data: { category: "日常", series: "追番", draft: false, password: "" } },
		{ id: "draft", data: { category: "ACG", series: "追番", draft: true, password: "" } },
	];
	assert.deepEqual(reviews.getAnimeReviewCandidates(posts, "other-series").map(x => x.id), ["matching", "other-series", "draft"]);
});

test("draft and encrypted review bodies never enter public rendering", () => {
	assert.equal(reviews.canRenderAnimeReviewBody({ draft: false, password: "" }, true), true);
	assert.equal(reviews.canRenderAnimeReviewBody({ draft: true, password: "" }, true), false);
	assert.equal(reviews.canRenderAnimeReviewBody({ draft: true, password: "" }, false), true);
	assert.equal(reviews.canRenderAnimeReviewBody({ draft: false, password: "secret" }, false), false);
	assert.equal(reviews.canRenderAnimeReviewBody({ draft: false, password: "secret" }, true), false);
});
