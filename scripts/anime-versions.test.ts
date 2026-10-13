import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createAnimeStore } from "./anime-dev-api.mjs";

const draft = {
	title: "原有自定义标题",
	year: 2026,
	quarter: 10,
	mode: "review",
	tiers: ["神作", "佳作", "还行", "及格", "差"],
	items: [{ id: 1, title: "测试番剧", cover: "", placement: "tier:4" }],
};
async function fixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-versions-"));
	const store = createAnimeStore(root);
	const firstDraft = await store.saveDraft("2026-10", draft, null, "中期评价");
	const first = await store.publish("2026-10", firstDraft.revision, "中期评价");
	const secondDraft = await store.saveDraft(
		"2026-10",
		{ ...draft, items: [] },
		firstDraft.revision,
		"完结评价",
	);
	const second = await store.publish(
		"2026-10",
		secondDraft.revision,
		"完结评价",
	);
	return { root, store, first, second, secondDraft };
}
async function digest(store: ReturnType<typeof createAnimeStore>, id: string) {
	return (await store.state()).versionRevisions[`2026-10/${id}`];
}

test("draft version names survive reload and publishing", async () => {
	const { root, store, secondDraft } = await fixture();
	try {
		assert.equal(
			(await createAnimeStore(root).state()).drafts[0].label,
			"完结评价",
		);
		await store.saveDraft("2026-10", draft, secondDraft.revision, "最终感想");
		assert.equal((await store.state()).drafts[0].label, "最终感想");
		await assert.rejects(store.saveDraft("2026-10", draft, null, "  "));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("updating history keeps identity, creation order, old tiers, draft and other snapshots", async () => {
	const { root, store, first, second, secondDraft } = await fixture();
	try {
		const updated = await store.updateVersion(
			"2026-10",
			first.id,
			draft,
			"修正中期评价",
			"review-post",
			await digest(store, first.id),
		);
		assert.equal(updated.id, first.id);
		assert.equal(updated.createdAt, first.createdAt);
		assert.ok(updated.updatedAt);
		assert.deepEqual(updated.tiers, draft.tiers);
		assert.equal(updated.items[0].placement, "tier:4");
		const state = await store.state();
		assert.deepEqual(
			state.archive.boards[0].versions.map((x) => x.id),
			[first.id, second.id],
		);
		assert.deepEqual(state.archive.boards[0].versions[1], second);
		assert.deepEqual(state.drafts[0], secondDraft);
		assert.equal(state.archive.reviews[`2026-10/${first.id}`], "review-post");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("version updates, deletion and review changes reject stale content including changed association", async () => {
	const { root, store, first } = await fixture();
	try {
		const old = await digest(store, first.id);
		await store.setReview("2026-10", first.id, "new-review", old);
		await assert.rejects(
			store.updateVersion("2026-10", first.id, draft, "覆盖", "", old),
			/其他窗口|更新/,
		);
		await assert.rejects(
			store.trashVersion("2026-10", first.id, old),
			/其他窗口|更新/,
		);
		await assert.rejects(
			store.setReview("2026-10", first.id, "", old),
			/其他窗口|更新/,
		);
		assert.equal(
			(await store.state()).archive.reviews[`2026-10/${first.id}`],
			"new-review",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("save as new version preserves source, association and saved draft", async () => {
	const { root, store, first, secondDraft } = await fixture();
	try {
		const created = await store.copyVersion(
			"2026-10",
			first.id,
			{ ...draft, tiers: ["最爱"], items: [] },
			"重新评价",
			"another-review",
			await digest(store, first.id),
		);
		const state = await store.state();
		assert.notEqual(created.id, first.id);
		assert.equal(state.archive.boards[0].versions.at(-1)?.id, created.id);
		assert.deepEqual(state.archive.boards[0].versions[0], first);
		assert.deepEqual(state.drafts[0], secondDraft);
		assert.equal(
			state.archive.reviews[`2026-10/${created.id}`],
			"another-review",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("trash and restore preserve snapshot, post association and original ordering", async () => {
	const { root, store, first, second, secondDraft } = await fixture();
	try {
		await store.setReview(
			"2026-10",
			first.id,
			"legacy-review",
			await digest(store, first.id),
		);
		await store.trashVersion(
			"2026-10",
			first.id,
			await digest(store, first.id),
		);
		let state = await store.state();
		assert.deepEqual(
			state.archive.boards[0].versions.map((x) => x.id),
			[second.id],
		);
		assert.equal(state.archive.reviews[`2026-10/${first.id}`], undefined);
		assert.equal(state.trash[0].snapshot.id, first.id);
		assert.equal(state.trash[0].postId, "legacy-review");
		await createAnimeStore(root).restoreVersion("2026-10", first.id);
		state = await store.state();
		assert.deepEqual(state.archive.boards[0].versions, [first, second]);
		assert.equal(state.archive.reviews[`2026-10/${first.id}`], "legacy-review");
		assert.equal(state.trash.length, 0);
		assert.deepEqual(state.drafts[0], secondDraft);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("deleting the final version keeps its quarter and draft manageable", async () => {
	const { root, store, first, second } = await fixture();
	try {
		await store.trashVersion(
			"2026-10",
			first.id,
			await digest(store, first.id),
		);
		await store.trashVersion(
			"2026-10",
			second.id,
			await digest(store, second.id),
		);
		const state = await store.state();
		assert.equal(state.archive.boards[0].versions.length, 0);
		assert.equal(state.archive.boards[0].title, draft.title);
		assert.equal(state.drafts.length, 1);
		await store.restoreVersion("2026-10", first.id);
		await store.restoreVersion("2026-10", second.id);
		assert.deepEqual(
			(await store.state()).archive.boards[0].versions.map((x) => x.id),
			[first.id, second.id],
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("failed archive removal leaves a recoverable private backup hidden while the version is still live", async () => {
	const { root, store, first } = await fixture();
	const dir = path.join(root, "src/data");
	try {
		await chmod(dir, 0o500);
		await assert.rejects(
			store.trashVersion("2026-10", first.id, await digest(store, first.id)),
		);
		await chmod(dir, 0o700);
		assert.ok(
			(await store.state()).archive.boards[0].versions.some(
				(x) => x.id === first.id,
			),
		);
		assert.equal((await store.state()).trash.length, 0);
		const backup = JSON.parse(
			await readFile(path.join(root, ".local/anime-trash.json"), "utf8"),
		);
		assert.equal(backup[0].snapshot.id, first.id);
	} finally {
		await chmod(dir, 0o700);
		await rm(root, { recursive: true, force: true });
	}
});

test("failed backup cannot delete public data; failed restore cleanup does not lose the restored version", async () => {
	const { root, store, first } = await fixture();
	const dir = path.join(root, ".local");
	try {
		await chmod(dir, 0o500);
		await assert.rejects(
			store.trashVersion("2026-10", first.id, await digest(store, first.id)),
		);
		await chmod(dir, 0o700);
		assert.equal((await store.state()).trash.length, 0);
		await store.trashVersion(
			"2026-10",
			first.id,
			await digest(store, first.id),
		);
		await chmod(dir, 0o500);
		const result = await store.restoreVersion("2026-10", first.id);
		await chmod(dir, 0o700);
		assert.ok(result.warning);
		assert.equal((await store.state()).trash.length, 0);
		assert.deepEqual(
			(await store.state()).archive.boards[0].versions[0],
			first,
		);
	} finally {
		await chmod(dir, 0o700);
		await rm(root, { recursive: true, force: true });
	}
});

test("invalid update cannot change quarter, insert unsafe names or alter disk", async () => {
	const { root, store, first } = await fixture();
	try {
		const original = await readFile(
			path.join(root, "src/data/anime.json"),
			"utf8",
		);
		for (const invalid of [
			{ ...draft, year: 2027 },
			{ ...draft, tiers: [] },
		]) {
			await assert.rejects(
				store.updateVersion(
					"2026-10",
					first.id,
					invalid,
					"修正",
					"",
					await digest(store, first.id),
				),
			);
		}
		await assert.rejects(
			store.updateVersion(
				"2026-10",
				first.id,
				draft,
				" ",
				"",
				await digest(store, first.id),
			),
		);
		assert.equal(
			await readFile(path.join(root, "src/data/anime.json"), "utf8"),
			original,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("restoring several versions in arbitrary order retains creation order even with equal timestamps", async () => {
	const { root, store, first, second, secondDraft } = await fixture();
	try {
		const nextDraft = await store.saveDraft(
			"2026-10",
			draft,
			secondDraft.revision,
			"第三个版本",
		);
		const third = await store.publish(
			"2026-10",
			nextDraft.revision,
			"第三个版本",
		);
		const file = path.join(root, "src/data/anime.json");
		const data = JSON.parse(await readFile(file, "utf8"));
		for (const version of data.boards[0].versions)
			version.createdAt = "2026-10-01T00:00:00.000Z";
		await writeFile(file, JSON.stringify(data));
		for (const version of [second, first, third])
			await store.trashVersion(
				"2026-10",
				version.id,
				await digest(store, version.id),
			);
		for (const version of [second, third, first])
			await store.restoreVersion("2026-10", version.id);
		assert.deepEqual(
			(await store.state()).archive.boards[0].versions.map((x) => x.id),
			[first.id, second.id, third.id],
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("failed restoration archive write leaves backup available and no public version", async () => {
	const { root, store, first } = await fixture();
	const dir = path.join(root, "src/data");
	try {
		await store.trashVersion(
			"2026-10",
			first.id,
			await digest(store, first.id),
		);
		await chmod(dir, 0o500);
		await assert.rejects(store.restoreVersion("2026-10", first.id));
		assert.equal((await store.state()).trash[0].snapshot.id, first.id);
		assert.ok(
			!(await store.state()).archive.boards[0].versions.some(
				(x) => x.id === first.id,
			),
		);
	} finally {
		await chmod(dir, 0o700);
		await rm(root, { recursive: true, force: true });
	}
});

test("two windows cannot update a public snapshot using the same digest", async () => {
	const { root, store, first } = await fixture();
	try {
		const revision = await digest(store, first.id);
		const results = await Promise.allSettled([
			store.updateVersion("2026-10", first.id, draft, "窗口一", "", revision),
			createAnimeStore(root).updateVersion(
				"2026-10",
				first.id,
				draft,
				"窗口二",
				"",
				revision,
			),
		]);
		assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
		assert.notEqual(await digest(store, first.id), revision);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("deleted edited snapshots cannot be replaced by republishing an unchanged draft", async () => {
	const { root, store, second, secondDraft } = await fixture();
	try {
		const edited = await store.updateVersion(
			"2026-10",
			second.id,
			{ ...draft, tiers: ["自定义"], items: [] },
			"修订",
			"review",
			await digest(store, second.id),
		);
		await store.trashVersion(
			"2026-10",
			second.id,
			await digest(store, second.id),
		);
		await assert.rejects(
			store.publish("2026-10", secondDraft.revision, "重复发布"),
		);
		const fresh = await store.saveDraft(
			"2026-10",
			secondDraft.draft,
			secondDraft.revision,
			"新版本",
		);
		const created = await store.publish("2026-10", fresh.revision, "新版本");
		assert.notEqual(created.id, second.id);
		assert.deepEqual((await store.state()).trash[0].snapshot, edited);
		await store.restoreVersion("2026-10", second.id);
		const state = await store.state();
		assert.deepEqual(state.archive.boards[0].versions.at(-2), edited);
		assert.equal(state.archive.reviews[`2026-10/${second.id}`], "review");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("interleaved publication deletion and restoration retain the full creation order", async () => {
	const { root, store, first, second, secondDraft } = await fixture();
	let revision = secondDraft.revision;
	async function publish(label: string) {
		const saved = await store.saveDraft("2026-10", draft, revision, label);
		revision = saved.revision;
		return store.publish("2026-10", revision, label);
	}
	try {
		const third = await publish("C");
		await store.trashVersion(
			"2026-10",
			second.id,
			await digest(store, second.id),
		);
		const fourth = await publish("D");
		await store.trashVersion(
			"2026-10",
			fourth.id,
			await digest(store, fourth.id),
		);
		const fifth = await publish("E");
		await store.trashVersion(
			"2026-10",
			fifth.id,
			await digest(store, fifth.id),
		);
		for (const item of [fourth, fifth, second])
			await store.restoreVersion("2026-10", item.id);
		assert.deepEqual(
			(await store.state()).archive.boards[0].versions.map((item) => item.id),
			[first.id, second.id, third.id, fourth.id, fifth.id],
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
