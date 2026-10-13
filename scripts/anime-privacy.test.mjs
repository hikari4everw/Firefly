import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { animeDevApi } from "./anime-dev-api.mjs";

const require = createRequire(import.meta.url);
const { createServer } = await import(
	pathToFileURL(require.resolve("vite", { paths: [require.resolve("astro")] }))
		.href
);

test("local saves use updated ranking validation without losing tier names", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-reload-"));
	const rankingFile = path.join(root, "src/utils/anime-ranking.ts");
	const source = `export const normalizeLegacyDraft = input => input;
export const createSnapshot = input => input;
export function validateDraft(input) { REJECT return input; }`;
	await mkdir(path.dirname(rankingFile), { recursive: true });
	await writeFile(rankingFile, source.replace("REJECT", ""));
	const server = await createServer({
		root, configFile: false, logLevel: "silent",
		plugins: [animeDevApi("https://example.invalid")],
		server: { host: "127.0.0.1", port: 0 },
		optimizeDeps: { noDiscovery: true },
	});
	try {
		await server.listen();
		const base = `http://127.0.0.1:${server.httpServer.address().port}`;
		const draft = { title: "测试", year: 2026, quarter: 10, mode: "review", tiers: ["自定义栏目"], items: [] };
		const save = (value, revision) => fetch(`${base}/api/anime`, {
			method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
			body: JSON.stringify({ action: "save", boardId: "2026-10", draft: value, revision }),
		});
		const saved = await (await save(draft, null)).json();
		assert.deepEqual(saved.draft.tiers, draft.tiers);
		const updated = new Promise((resolve) => server.watcher.on("change", file => {
			if (file.endsWith("/anime-ranking.ts")) resolve();
		}));
		await writeFile(rankingFile, source.replace("REJECT", 'if (input.tiers.includes("旧服务测试")) throw Object.assign(new Error("校验已更新"), { status: 400 });'));
		await Promise.race([updated, new Promise((_, reject) => setTimeout(() => reject(new Error("模块更新超时")), 3000))]);
		const rejected = await save({ ...draft, tiers: ["旧服务测试"] }, saved.revision);
		assert.equal(rejected.status, 400);
		assert.equal((await rejected.json()).error, "校验已更新");
		const next = await (await save({ ...draft, tiers: ["刷新后栏目"] }, saved.revision)).json();
		assert.deepEqual(next.draft.tiers, ["刷新后栏目"]);
		const state = await (await fetch(`${base}/api/anime`)).json();
		assert.deepEqual(state.drafts[0].draft.tiers, ["刷新后栏目"]);
		const disk = JSON.parse(await readFile(path.join(root, ".local/anime/2026-10.json"), "utf8"));
		assert.deepEqual(disk.draft.tiers, ["刷新后栏目"]);
	} finally {
		await server.close();
		await rm(root, { recursive: true, force: true });
	}
});

test("Vite cannot expose private drafts through static or raw imports", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-private-"));
	const file = path.join(root, ".local/anime/2026-4.json");
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, '{"private":"unpublished preference"}');
	const server = await createServer({
		root,
		configFile: false,
		logLevel: "silent",
		plugins: [animeDevApi("https://example.invalid")],
		server: { host: "127.0.0.1", port: 0 },
		optimizeDeps: { noDiscovery: true },
	});
	try {
		await server.listen();
		const base = `http://127.0.0.1:${server.httpServer.address().port}`;
		for (const url of [
			"/.local/anime/2026-4.json",
			`/@fs${file}`,
			`/@fs${file}?raw`,
			"/.local/anime/2026-4.json?import",
		]) {
			const response = await fetch(base + url, {
				headers: { Origin: "http://localhost:9999" },
			});
			const body = await response.text();
			assert.ok(
				response.status === 403 || response.status === 404,
				`${url}: HTTP ${response.status}`,
			);
			assert.ok(!body.includes("unpublished preference"));
		}
	} finally {
		await server.close();
		await rm(root, { recursive: true, force: true });
	}
});

test("saving public data refreshes SSR without reloading the workbench", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-hmr-"));
	const file = path.join(root, "src/data/anime.json");
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, '{"boards":[],"reviews":{}}');
	let observe;
	const observed = new Promise(resolve => { observe = resolve; });
	const server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [animeDevApi("https://example.invalid"), { name: "observe-anime-hot-update", enforce: "post", handleHotUpdate(ctx) { if (ctx.file.endsWith("/src/data/anime.json")) observe(ctx.modules.length); } }], server: { host: "127.0.0.1", port: 0 }, optimizeDeps: { noDiscovery: true } });
	try {
		await server.listen();
		const base = `http://127.0.0.1:${server.httpServer.address().port}`;
		await fetch(`${base}/src/data/anime.json?import`);
		assert.deepEqual((await server.ssrLoadModule("/src/data/anime.json")).default.boards, []);
		await writeFile(file, '{"boards":[{"id":"2026-10"}],"reviews":{}}');
		assert.equal(await Promise.race([observed, new Promise((_, reject) => setTimeout(() => reject(new Error("更新事件超时")), 3000))]), 0);
		assert.equal((await server.ssrLoadModule("/src/data/anime.json")).default.boards[0].id, "2026-10");
	} finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});
