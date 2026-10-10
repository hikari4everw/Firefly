import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	createAnimeStore,
	importQuarter,
	isLocalRequest,
} from "./anime-dev-api.mjs";

const draft = {
	title: "4月新番",
	year: 2026,
	quarter: 4,
	mode: "plan",
	items: [{ id: 1, title: "A", cover: "", placement: "tier:0" }],
};
test("rejects stale and concurrent saves without losing the winner", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-store-"));
	try {
		const store = createAnimeStore(root);
		const saved = await store.saveDraft("2026-4", draft, null);
		const results = await Promise.allSettled([
			store.saveDraft("2026-4", { ...draft, title: "first" }, saved.revision),
			store.saveDraft("2026-4", { ...draft, title: "second" }, saved.revision),
		]);
		assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
		assert.equal((await store.state()).drafts[0].draft.title, "first");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("publishes snapshots once and keeps drafts out of archive; review mapping is separate", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-store-"));
	try {
		const store = createAnimeStore(root);
		const saved = await store.saveDraft("2026-4", draft, null);
		const snapshot = await store.publish("2026-4", saved.revision, "追番计划");
		await assert.rejects(store.publish("2026-4", saved.revision, "duplicate"));
		await store.saveDraft(
			"2026-4",
			{ ...draft, title: "new draft" },
			saved.revision,
		);
		await store.setReview("2026-4", snapshot.id, "testing");
		const archive = JSON.parse(
			await readFile(path.join(root, "src/data/anime.json"), "utf8"),
		);
		assert.equal(archive.boards[0].versions[0].title, "4月新番");
		assert.equal(archive.reviews[`2026-4/${snapshot.id}`], "testing");
		assert.equal("drafts" in archive, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("invalid draft cannot alter disk; board paths cannot escape storage", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-store-"));
	try {
		const store = createAnimeStore(root);
		await assert.rejects(store.saveDraft("../../escape", draft, null));
		await assert.rejects(
			store.saveDraft(
				"2026-4",
				{ ...draft, items: [{ ...draft.items[0], placement: "boundary:2" }] },
				null,
			),
		);
		assert.equal((await store.state()).drafts.length, 0);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("request guard blocks remote, cross-origin and DNS-rebinding hosts", () => {
	const req = (address: string, host: string, origin?: string) => ({
		socket: { remoteAddress: address },
		headers: { host, origin },
		method: "POST",
	});
	assert.equal(
		isLocalRequest(req("127.0.0.1", "localhost:4321", "http://localhost:4321")),
		true,
	);
	assert.equal(
		isLocalRequest(
			req("192.168.1.1", "localhost:4321", "http://localhost:4321"),
		),
		false,
	);
	assert.equal(
		isLocalRequest(req("127.0.0.1", "localhost:4321", "https://evil.test")),
		false,
	);
	assert.equal(
		isLocalRequest(req("127.0.0.1", "evil.test:4321", "http://evil.test:4321")),
		false,
	);
	assert.equal(isLocalRequest(req("127.0.0.1", "localhost:4321")), false);
});
test("quarter import handles Q4 rollover, pagination and duplicate results", async () => {
	const calls: { url: string; body: { filter: { air_date: string[] } } }[] = [];
	const fetcher = async (_url: string, options: RequestInit) => {
		calls.push({ url: _url, body: JSON.parse(String(options.body)) });
		return new Response(
			JSON.stringify({
				total: 3,
				data:
					calls.length === 1
						? [
								{ id: 1, name_cn: "A", images: {}, platform: "TV" },
								{ id: 2, name: "B", images: {}, platform: "TV" },
							]
						: [{ id: 2, name: "B", images: {}, platform: "TV" }],
			}),
		);
	};
	const result = await importQuarter(
		"https://api.example",
		2026,
		10,
		fetcher,
		2,
	);
	assert.deepEqual(calls[0].body.filter.air_date, [
		">=2026-10-01",
		"<2027-01-01",
	]);
	assert.match(calls[1].url, /offset=2/);
	assert.deepEqual(
		result.map((x) => x.id),
		[1, 2],
	);
});
test("failed quarter import rejects instead of returning incomplete data", async () => {
	await assert.rejects(
		importQuarter(
			"https://api.example",
			2026,
			4,
			async () => new Response("fail", { status: 503 }),
		),
		/503/,
	);
});

test("dev API serves normalized trailing-slash paths as JSON", async () => {
	const { animeDevApi } = await import("./anime-dev-api.mjs");
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-route-"));
	try {
		let handler: (
			req: unknown,
			res: unknown,
			next: () => void,
		) => Promise<void> = async () => {};
		animeDevApi("https://api.example").configureServer({
			config: { root },
			middlewares: {
				use(fn: typeof handler) {
					handler = fn;
				},
			},
		});
		for (const url of ["/api/anime", "/api/anime/"]) {
			let status = 0;
			let response = "";
			let delegated = false;
			const res = {
				set statusCode(value: number) {
					status = value;
				},
				setHeader() {},
				end(body: string) {
					response = body;
				},
			};
			await handler(
				{
					url,
					method: "GET",
					socket: { remoteAddress: "127.0.0.1" },
					headers: { host: "localhost:4321" },
				},
				res,
				() => {
					delegated = true;
				},
			);
			assert.equal(delegated, false, url);
			assert.equal(status, 200);
			assert.deepEqual(JSON.parse(response), {
				archive: { boards: [], reviews: {} },
				drafts: [],
			});
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("separate editors cannot overwrite the same draft revision", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "anime-store-"));
	try {
		const first = createAnimeStore(root);
		const second = createAnimeStore(root);
		const saved = await first.saveDraft("2026-4", draft, null);
		const results = await Promise.allSettled([
			first.saveDraft(
				"2026-4",
				{ ...draft, title: "first editor" },
				saved.revision,
			),
			second.saveDraft(
				"2026-4",
				{ ...draft, title: "second editor" },
				saved.revision,
			),
		]);
		assert.equal(
			results.filter((result) => result.status === "fulfilled").length,
			1,
		);
		const current = (await second.state()).drafts[0];
		assert.notEqual(current.revision, saved.revision);
		await second.saveDraft(
			"2026-4",
			{ ...draft, title: "after lock release" },
			current.revision,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("clamped page sizes advance by received rows and retrieve all subjects", async () => {
	const offsets: number[] = [];
	const result = await importQuarter(
		"https://api.example",
		2026,
		10,
		async (url) => {
			const offset = Number(new URL(url).searchParams.get("offset"));
			offsets.push(offset);
			return Response.json({
				total: 136,
				limit: 20,
				offset,
				data: Array.from({ length: Math.min(20, 136 - offset) }, (_, i) => ({
					id: offset + i + 1,
					name: "Anime",
					images: {},
					platform: "TV",
				})),
			});
		},
	);
	assert.equal(result.length, 136);
	assert.deepEqual(offsets, [0, 20, 40, 60, 80, 100, 120]);
});

test("incomplete empty pages, repeated pages, and later failures reject imports", async () => {
	for (const failure of ["empty", "repeat", "http"]) {
		let calls = 0;
		await assert.rejects(
			importQuarter("https://api.example", 2026, 4, async () => {
				calls++;
				if (calls > 1 && failure === "http")
					return new Response("fail", { status: 503 });
				return Response.json({
					total: 40,
					data:
						calls > 1 && failure === "empty"
							? []
							: Array.from({ length: 20 }, (_, i) => ({
									id: i + 1,
									name: "Anime",
									images: {},
									platform: "TV",
								})),
				});
			}),
		);
		assert.ok(calls >= 2);
	}
});

test("invalid or shrinking totals cannot return a partial import", async () => {
	for (const failure of ["missing", "invalid", "shrink"]) {
		let calls = 0;
		await assert.rejects(
			importQuarter("https://api.example", 2026, 10, async () => {
				calls++;
				if (calls === 1)
					return Response.json({
						total: 60,
						data: Array.from({ length: 20 }, (_, i) => ({
							id: i + 1,
							name: "Anime",
						})),
					});
				if (failure === "shrink" && calls === 2)
					return Response.json({
						total: 40,
						data: Array.from({ length: 20 }, (_, i) => ({
							id: i + 21,
							name: "Anime",
						})),
					});
				return Response.json({
					...(failure === "missing"
						? {}
						: { total: failure === "invalid" ? "60" : 60 }),
					data: [],
				});
			}),
		);
	}
});

test("quarter imports request Japanese metadata filtering", async () => {
	await importQuarter("https://api.example", 2026, 4, async (_url, options) => {
		assert.ok(typeof options?.body === "string");
		assert.deepEqual(JSON.parse(options.body).filter.meta_tags, ["日本", "TV"]);
		return Response.json({ total: 0, data: [] });
	});
});

test("quarter import excludes non-TV results and advances using all received rows", async () => {
	const offsets: number[] = [];
	const result = await importQuarter(
		"https://api.example",
		2026,
		4,
		async (url) => {
			const offset = Number(new URL(url).searchParams.get("offset"));
			offsets.push(offset);
			return Response.json({
				total: 5,
				offset,
				data:
					offset === 0
						? [
								{ id: 1, name: "Movie", platform: "剧场版" },
								{ id: 2, name: "TV", platform: "TV" },
								{ id: 3, name: "OVA", platform: "OVA" },
							]
						: [
								{ id: 4, name: "Web", platform: "WEB" },
								{ id: 5, name: "TV2", platform: "TV" },
							],
			});
		},
	);
	assert.deepEqual(offsets, [0, 3]);
	assert.deepEqual(
		result.map((x) => x.id),
		[2, 5],
	);
});
