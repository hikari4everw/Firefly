import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
