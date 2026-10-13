import { createHash, randomUUID } from "node:crypto";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
	createSnapshot,
	normalizeLegacyDraft,
	validateDraft,
} from "../src/utils/anime-ranking.ts";

function fail(message, status = 400) {
	throw Object.assign(new Error(message), { status });
}
function checkId(id) {
	if (!/^\d{4}-(1|4|7|10)$/.test(id)) fail("榜单标识无效");
}
async function readJson(file, fallback) {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return fallback;
		throw error;
	}
}
async function atomicWrite(file, data) {
	await mkdir(path.dirname(file), { recursive: true });
	const temp = `${file}.${randomUUID()}.tmp`;
	await writeFile(temp, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
	await rename(temp, file);
}

export function createAnimeStore(
	root,
	ranking = { createSnapshot, normalizeLegacyDraft, validateDraft },
) {
	const archiveFile = path.join(root, "src/data/anime.json");
	const draftDir = path.join(root, ".local/anime");
	const lockDir = path.join(draftDir, ".write-lock");
	const trashFile = path.join(root, ".local/anime-trash.json");
	let writes = Promise.resolve();
	const enqueue = (operation) => {
		const result = writes
			.catch(() => {})
			.then(async () => {
				await mkdir(draftDir, { recursive: true });
				try {
					await mkdir(lockDir);
				} catch (error) {
					if (error.code === "EEXIST")
						fail(
							"另一个工作台正在保存，请稍后重试；若持续失败，请按使用说明清理异常锁",
							409,
						);
					throw error;
				}
				try {
					return await operation();
				} finally {
					await rm(lockDir, { recursive: true });
				}
			});
		writes = result;
		return result;
	};
	const archive = () => readJson(archiveFile, { boards: [], reviews: {} });
	const draftFile = (id) => {
		checkId(id);
		return path.join(draftDir, `${id}.json`);
	};
	const getDraft = async (id) => {
		const record = await readJson(draftFile(id), null);
		return record
			? { ...record, draft: ranking.normalizeLegacyDraft(record.draft) }
			: null;
	};
	const versionKey = (id, versionId) => `${id}/${versionId}`;
	const fingerprint = (data, id, snapshot) =>
		createHash("sha256")
			.update(
				JSON.stringify({
					snapshot,
					postId: data.reviews[versionKey(id, snapshot.id)] || "",
				}),
			)
			.digest("hex");
	const findVersion = (data, id, versionId, expectedRevision) => {
		checkId(id);
		const board = data.boards.find((item) => item.id === id);
		const snapshot = board?.versions.find((item) => item.id === versionId);
		if (!snapshot) fail("公开版本不存在，可能已在其他窗口移入回收站", 409);
		if (fingerprint(data, id, snapshot) !== expectedRevision)
			fail("公开版本或点评已在其他窗口更新，请重新载入后再保存", 409);
		return { board, snapshot };
	};
	const setPost = (data, id, versionId, postId) => {
		if (
			typeof postId !== "string" ||
			postId.length > 300 ||
			[...postId].some((char) => char.charCodeAt(0) < 32)
		)
			fail("文章标识无效");
		const key = versionKey(id, versionId);
		if (postId) data.reviews[key] = postId;
		else delete data.reviews[key];
	};
	const validateLabel = (label) => {
		if (typeof label !== "string" || !label.trim() || label.length > 100)
			fail("请填写 1～100 字的版本名称");
		return label.trim();
	};
	const versionInput = (id, input) => {
		const draft = ranking.validateDraft(input);
		if (id !== `${draft.year}-${draft.quarter}`) fail("季度与榜单标识不一致");
		return draft;
	};

	return {
		async state() {
			await writes.catch(() => {});
			let files = [];
			try {
				files = await readdir(draftDir);
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
			}
			const data = await archive();
			const versionRevisions = Object.fromEntries(
				data.boards.flatMap((board) =>
					board.versions.map((snapshot) => [
						versionKey(board.id, snapshot.id),
						fingerprint(data, board.id, snapshot),
					]),
				),
			);
			const trash = (await readJson(trashFile, [])).filter(
				(item) =>
					!data.boards
						.find((board) => board.id === item.boardId)
						?.versions.some((snapshot) => snapshot.id === item.snapshot.id),
			);
			return {
				features: { tierNames: true, versionManagement: true },
				archive: data,
				versionRevisions,
				trash,
				drafts: await Promise.all(
					files
						.filter((file) => /^\d{4}-(1|4|7|10)\.json$/.test(file))
						.map((file) => getDraft(file.slice(0, -5))),
				),
			};
		},
		saveDraft(id, input, expectedRevision, label) {
			return enqueue(async () => {
				checkId(id);
				const draft = ranking.validateDraft(input);
				if (id !== `${draft.year}-${draft.quarter}`)
					fail("季度与榜单标识不一致");
				const current = await getDraft(id);
				if ((current?.revision ?? null) !== expectedRevision)
					fail("草稿已在其他窗口更新，请重新载入后再保存", 409);
				const record = {
					boardId: id,
					revision: randomUUID(),
					draft,
					label: validateLabel(
						label ??
							current?.label ??
							(draft.mode === "plan" ? "追番计划" : "中期评价"),
					),
				};
				await atomicWrite(draftFile(id), record);
				return record;
			});
		},
		publish(id, expectedRevision, label) {
			return enqueue(async () => {
				const record = await getDraft(id);
				if (!record || record.revision !== expectedRevision)
					fail("请先保存当前草稿，再创建公开版本", 409);
				const data = await archive();
				let board = data.boards.find((item) => item.id === id);
				if (
					board?.versions.some(
						(version) => version.id === `v-${record.revision}`,
					)
				)
					fail("这份草稿已经保存为公开版本；调整并保存草稿后可创建新版本", 409);
				const snapshot = ranking.createSnapshot(
					record.draft,
					validateLabel(label),
					`v-${record.revision}`,
					new Date().toISOString(),
				);
				if (!board) {
					board = {
						id,
						title: record.draft.title,
						year: record.draft.year,
						quarter: record.draft.quarter,
						versions: [],
					};
					data.boards.push(board);
				}
				board.title = record.draft.title;
				board.versions.push(snapshot);
				await atomicWrite(archiveFile, data);
				return snapshot;
			});
		},
		updateVersion(id, versionId, input, label, postId, expectedRevision) {
			return enqueue(async () => {
				const data = await archive();
				const { board, snapshot } = findVersion(
					data,
					id,
					versionId,
					expectedRevision,
				);
				const updated = {
					...ranking.createSnapshot(
						versionInput(id, input),
						validateLabel(label),
						snapshot.id,
						snapshot.createdAt,
					),
					updatedAt: new Date().toISOString(),
				};
				setPost(data, id, versionId, postId);
				board.versions[board.versions.indexOf(snapshot)] = updated;
				await atomicWrite(archiveFile, data);
				return updated;
			});
		},
		copyVersion(id, versionId, input, label, postId, expectedRevision) {
			return enqueue(async () => {
				const data = await archive();
				const { board } = findVersion(data, id, versionId, expectedRevision);
				const snapshot = ranking.createSnapshot(
					versionInput(id, input),
					validateLabel(label),
					`v-${randomUUID()}`,
					new Date().toISOString(),
				);
				setPost(data, id, snapshot.id, postId);
				board.versions.push(snapshot);
				await atomicWrite(archiveFile, data);
				return snapshot;
			});
		},
		setReview(id, versionId, postId, expectedRevision) {
			return enqueue(async () => {
				const data = await archive();
				findVersion(data, id, versionId, expectedRevision);
				setPost(data, id, versionId, postId);
				await atomicWrite(archiveFile, data);
			});
		},
		trashVersion(id, versionId, expectedRevision) {
			return enqueue(async () => {
				const data = await archive();
				const { board, snapshot } = findVersion(
					data,
					id,
					versionId,
					expectedRevision,
				);
				const index = board.versions.indexOf(snapshot);
				const trash = (await readJson(trashFile, [])).filter(
					(item) => !(item.boardId === id && item.snapshot.id === versionId),
				);
				const previousOrder =
					trash.find((item) => item.boardId === id && item.order)?.order || [];
				const order = [
					...new Set([
						...previousOrder,
						...board.versions.map((version) => version.id),
					]),
				];
				trash.push({
					order,
					boardId: id,
					boardTitle: board.title,
					year: board.year,
					quarter: board.quarter,
					snapshot,
					postId: data.reviews[versionKey(id, versionId)] || "",
					deletedAt: new Date().toISOString(),
				});
				await atomicWrite(trashFile, trash);
				board.versions.splice(index, 1);
				delete data.reviews[versionKey(id, versionId)];
				await atomicWrite(archiveFile, data);
			});
		},
		restoreVersion(id, versionId) {
			return enqueue(async () => {
				checkId(id);
				const trash = await readJson(trashFile, []);
				const entry = trash.find(
					(item) => item.boardId === id && item.snapshot.id === versionId,
				);
				if (!entry) fail("已删除版本不存在");
				const data = await archive();
				let board = data.boards.find((item) => item.id === id);
				if (!board) {
					board = {
						id,
						title: entry.boardTitle,
						year: entry.year,
						quarter: entry.quarter,
						versions: [],
					};
					data.boards.push(board);
				}
				if (board.versions.some((snapshot) => snapshot.id === versionId))
					fail("版本已恢复，请重新载入", 409);
				const position = entry.order.indexOf(versionId);
				const next = board.versions.findIndex(
					(snapshot) =>
						!entry.order.includes(snapshot.id) ||
						entry.order.indexOf(snapshot.id) > position,
				);
				const index = next >= 0 ? next : board.versions.length;
				board.versions.splice(index, 0, entry.snapshot);
				setPost(data, id, versionId, entry.postId);
				await atomicWrite(archiveFile, data);
				try {
					await atomicWrite(
						trashFile,
						trash.filter((item) => item !== entry),
					);
				} catch {
					return {
						snapshot: entry.snapshot,
						warning: "版本已恢复，私有备份清理失败；该备份不会重复显示",
					};
				}
				return { snapshot: entry.snapshot };
			});
		},
	};
}

export function isLocalRequest(req) {
	const address = req.socket.remoteAddress;
	if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
	const host = req.headers.host || "";
	if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	if (req.method === "POST" && req.headers.origin !== `http://${host}`)
		return false;
	return !req.headers.origin || req.headers.origin === `http://${host}`;
}

function subjectFromApi(subject) {
	return {
		id: subject.id,
		title: subject.name_cn || subject.name || `番剧 ${subject.id}`,
		cover: subject.images?.common || subject.images?.medium || "",
	};
}
export async function importQuarter(
	apiUrl,
	year,
	quarter,
	fetcher = fetch,
	limit = 50,
) {
	validateDraft({ title: "导入", year, quarter, mode: "plan", items: [] });
	const start = `${year}-${String(quarter).padStart(2, "0")}-01`;
	const end =
		quarter === 10
			? `${year + 1}-01-01`
			: `${year}-${String(quarter + 3).padStart(2, "0")}-01`;
	const subjects = new Map();
	const pages = new Set();
	let offset = 0;
	let expectedTotal = 0;
	while (offset < 1000) {
		const response = await fetcher(
			`${apiUrl}/v0/search/subjects?limit=${limit}&offset=${offset}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"User-Agent":
						"Hikari4everSite/AnimeRanking (https://hikari4ever.com)",
				},
				body: JSON.stringify({
					keyword: "",
					sort: "heat",
					filter: {
						type: [2],
						meta_tags: ["日本", "TV"],
						air_date: [`>=${start}`, `<${end}`],
						nsfw: false,
					},
				}),
				signal: AbortSignal.timeout(20000),
			},
		);
		if (!response.ok)
			fail(`番剧导入失败（${response.status}），请稍后重试`, 502);
		const result = await response.json();
		if (!Array.isArray(result.data)) fail("番剧接口返回格式异常", 502);
		if (Number.isInteger(result.offset) && result.offset !== offset)
			fail("番剧分页偏移异常，请稍后重试", 502);
		if (!Number.isInteger(result.total) || result.total < 0)
			fail("番剧接口总数异常，未导入不完整清单", 502);
		expectedTotal = Math.max(expectedTotal, result.total);
		if (!result.data.length) {
			if (offset < expectedTotal)
				fail("番剧分页提前结束，未导入不完整清单", 502);
			return [...subjects.values()];
		}
		const signature = result.data
			.map((subject) => subject.id)
			.sort((a, b) => a - b)
			.join(",");
		if (pages.has(signature)) fail("番剧接口返回重复页，未导入不完整清单", 502);
		pages.add(signature);
		for (const subject of result.data)
			if (subject.platform === "TV")
				subjects.set(subject.id, subjectFromApi(subject));
		offset += result.data.length;
		if (offset >= expectedTotal) return [...subjects.values()];
	}
	fail("番剧数量超过1000，请缩小范围", 502);
}

export function animeDevApi(apiUrl) {
	return {
		name: "firefly-anime-dev-api",
		apply: "serve",
		handleHotUpdate(context) {
			if (
				context.file !==
				path.join(context.server.config.root, "src/data/anime.json")
			)
				return;
			// 工作台自行刷新数据；只失效 SSR 缓存，避免保存后整页重载丢失选择。
			for (const module of context.modules)
				context.server.moduleGraph.invalidateModule(module);
			return [];
		},
		config(config) {
			return {
				server: {
					fs: {
						deny: [
							...(config.server?.fs?.deny || [
								".env",
								".env.*",
								"*.{crt,pem,key,p12,pfx,cer,der}",
								".npmrc",
								".yarnrc.yml",
								"**/.git/**",
							]),
							"**/.local/**",
						],
					},
				},
			};
		},
		configureServer(server) {
			// Vite invalidates this SSR module when its validation changes; keep one write queue.
			let ranking = { createSnapshot, normalizeLegacyDraft, validateDraft };
			const store = createAnimeStore(server.config.root, {
				createSnapshot: (...args) => ranking.createSnapshot(...args),
				normalizeLegacyDraft: (...args) =>
					ranking.normalizeLegacyDraft(...args),
				validateDraft: (...args) => ranking.validateDraft(...args),
			});
			server.middlewares.use(async (req, res, next) => {
				if ((req.url || "").split("?")[0].replace(/\/$/, "") !== "/api/anime")
					return next();
				const send = (status, body) => {
					res.statusCode = status;
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					res.setHeader("Cache-Control", "no-store");
					res.end(JSON.stringify(body));
				};
				if (!isLocalRequest(req))
					return send(403, { error: "仅允许本机同源访问" });
				try {
					ranking = await server.ssrLoadModule("/src/utils/anime-ranking.ts");
					if (req.method === "GET") return send(200, await store.state());
					if (req.method !== "POST")
						return send(405, { error: "仅支持 GET / POST" });
					if (!req.headers["content-type"]?.startsWith("application/json"))
						return send(415, { error: "请求必须为 JSON" });
					const chunks = [];
					let bytes = 0;
					for await (const chunk of req) {
						bytes += Buffer.byteLength(chunk);
						if (bytes > 2 * 1024 * 1024)
							return send(413, { error: "榜单过大" });
						chunks.push(chunk);
					}
					let body;
					try {
						body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
					} catch {
						fail("请求格式无效");
					}
					if (!body || typeof body !== "object") fail("请求格式无效");
					if (body.action === "save")
						return send(
							200,
							await store.saveDraft(
								body.boardId,
								body.draft,
								body.revision,
								body.label,
							),
						);
					if (body.action === "publish")
						return send(
							200,
							await store.publish(body.boardId, body.revision, body.label),
						);
					if (body.action === "review") {
						await store.setReview(
							body.boardId,
							body.versionId,
							body.postId,
							body.versionRevision,
						);
						return send(200, { ok: true });
					}
					if (body.action === "update" || body.action === "copy")
						return send(
							200,
							await store[
								body.action === "update" ? "updateVersion" : "copyVersion"
							](
								body.boardId,
								body.versionId,
								body.draft,
								body.label,
								body.postId,
								body.versionRevision,
							),
						);
					if (body.action === "trash") {
						await store.trashVersion(
							body.boardId,
							body.versionId,
							body.versionRevision,
						);
						return send(200, { ok: true });
					}
					if (body.action === "restore")
						return send(
							200,
							await store.restoreVersion(body.boardId, body.versionId),
						);
					if (body.action === "import")
						return send(200, {
							subjects: await importQuarter(apiUrl, body.year, body.quarter),
						});
					if (body.action === "subject") {
						const url = new URL(body.url);
						const match = /^\/subject\/(\d+)\/?$/.exec(url.pathname);
						if (
							!["bgm.tv", "bangumi.tv", "bangumi.vip"].includes(url.hostname) ||
							!match
						)
							fail("请填写 Bangumi 番剧条目链接");
						const response = await fetch(`${apiUrl}/v0/subjects/${match[1]}`, {
							headers: { "User-Agent": "Hikari4everSite/AnimeRanking" },
							signal: AbortSignal.timeout(20000),
						});
						if (!response.ok) fail(`读取番剧失败（${response.status}）`, 502);
						const subject = await response.json();
						if (subject.type !== 2) fail("只能添加动画条目");
						return send(200, { subjects: [subjectFromApi(subject)] });
					}
					fail("操作不存在");
				} catch (error) {
					send(error.status || 500, { error: error.message || "保存失败" });
				}
			});
		},
	};
}
