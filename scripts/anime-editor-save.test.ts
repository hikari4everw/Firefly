import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import {
	normalizeLegacyDraft,
	prepareAnimeDraftForEditing,
} from "../src/utils/anime-ranking";
import { selectAnimeWorkbench } from "../src/utils/anime-selection";
import { createAnimeStore } from "./anime-dev-api.mjs";

test("save refresh keeps the public content and its conflict digest from the same read", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-editor-save-"));
	const store = createAnimeStore(root);
	try {
		const original = {
			title: "榜单",
			year: 2026,
			quarter: 10,
			mode: "review",
			tiers: ["A"],
			items: [],
		};
		const record = await store.saveDraft("2026-10", original, null, "A");
		const version = await store.publish("2026-10", record.revision, "A");
		const state = await store.state();
		let insertOtherWindow = true;
		const context = vm.createContext({
			archive: state.archive,
			records: state.drafts,
			trash: state.trash,
			versionRevisions: state.versionRevisions,
			boardId: "2026-10",
			target: version.id,
			editingPublic: true,
			draft: original,
			label: "A",
			postId: "A-post",
			revision: record.revision,
			versionRevision: state.versionRevisions[`2026-10/${version.id}`],
			dirty: true,
			selectedId: null,
			undo: [],
			year: 2026,
			quarter: 10,
			error: false,
			message: "",
			structuredClone,
			$state: { snapshot: structuredClone },
			normalizeLegacyDraft,
			prepareAnimeDraftForEditing,
			selectAnimeWorkbench,
			async api(body?: {
				action: string;
				draft: typeof original;
				label: string;
				postId: string;
				versionRevision: string;
			}) {
				if (body)
					return store.updateVersion(
						"2026-10",
						version.id,
						body.draft,
						body.label,
						body.postId,
						body.versionRevision,
					);
				if (insertOtherWindow) {
					insertOtherWindow = false;
					const fresh = await store.state();
					await store.updateVersion(
						"2026-10",
						version.id,
						{ ...original, tiers: ["B"] },
						"B",
						"B-post",
						fresh.versionRevisions[`2026-10/${version.id}`],
					);
				}
				return store.state();
			},
		});
		const source = (
			await readFile(
				new URL(
					"../src/components/pages/anime/AnimeEditor.svelte",
					import.meta.url,
				),
				"utf8",
			)
		)
			.split('<script lang="ts">')[1]
			.split("</script>")[0];
		const parsed = ts.createSourceFile(
			"editor.ts",
			source,
			ts.ScriptTarget.Latest,
			true,
		);
		const functions = parsed.statements
			.filter(
				(item) =>
					ts.isFunctionDeclaration(item) &&
					["load", "refresh", "saveCurrent"].includes(item.name?.text || ""),
			)
			.map((item) => item.getText(parsed))
			.join("\n");
		vm.runInContext(
			ts.transpileModule(functions, {
				compilerOptions: { target: ts.ScriptTarget.ES2022 },
			}).outputText,
			context,
		);
		await vm.runInContext("saveCurrent()", context);
		assert.deepEqual(Array.from(context.draft.tiers), ["B"]);
		assert.equal(context.label, "B");
		assert.equal(context.postId, "B-post");
		assert.equal(context.editingPublic, true);
		context.label = "B修订";
		await vm.runInContext("saveCurrent()", context);
		const updated = await store.state();
		assert.deepEqual(updated.archive.boards[0].versions[0].tiers, ["B"]);
		assert.equal(updated.archive.reviews[`2026-10/${version.id}`], "B-post");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
