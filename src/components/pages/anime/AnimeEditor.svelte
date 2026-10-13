<script lang="ts">
import { onMount } from "svelte";
import type { AnimeArchive, AnimeDevState, AnimeDraft, AnimeDraftRecord, AnimeMode, AnimePlacement, AnimeTrashedVersion } from "@/types/anime";
import { ANIME_TIERS, addAnimeTier, animeVersionUrl, convertMode, getAnimeTiers, mergeImported, moveItem, normalizeLegacyDraft, prepareAnimeDraftForEditing, removeAnimeTier, renameAnimeTier } from "@/utils/anime-ranking";
import { getAnimeReviewCandidates } from "@/utils/anime-reviews";
import { selectAnimeWorkbench } from "@/utils/anime-selection";
import AnimeBoard from "./AnimeBoard.svelte";
let { posts, initialBoardId, initialVersionId, onready }: { posts: { id: string; title: string; draft: boolean; category?: string | null; series?: string; url: string; description?: string }[]; initialBoardId?: string; initialVersionId?: string; onready: () => void } = $props();
let archive = $state<AnimeArchive>({ boards: [], reviews: {} });
let records = $state<AnimeDraftRecord[]>([]);
let trash = $state<AnimeTrashedVersion[]>([]);
let versionRevisions = $state<Record<string, string>>({});
let draft = $state<AnimeDraft | null>(null);
let boardId = $state("");
let target = $state("");
let editingPublic = $state(false);
let revision = $state<string | null>(null);
let versionRevision = $state("");
let year = $state(new Date().getFullYear());
let quarter = $state(Math.floor(new Date().getMonth() / 3) * 3 + 1);
let label = $state("");
let subjectUrl = $state("");
let selectedId = $state<number | null>(null);
let postId = $state("");
let busy = $state(false);
let ready = $state(false);
let dirty = $state(false);
let message = $state("正在读取本机榜单…");
let error = $state(false);
let undo = $state<AnimeDraft[]>([]);
let boardEditor = $state<AnimeBoard>();
let pending = $state<{ title: string; action: () => void | Promise<void> } | null>(null);
let deleteId = $state("");
const versions = $derived(archive.boards.find((board) => board.id === boardId)?.versions || []);
const editable = $derived(target === "draft" || editingPublic);
const record = $derived(records.find((item) => item.boardId === boardId));
const currentVersion = $derived(versions.find((item) => item.id === target));
const reviewPosts = $derived(getAnimeReviewCandidates(posts.map((post) => ({ ...post, data: post })), archive.reviews[`${boardId}/${target}`] || ""));
const review = $derived(posts.find((post) => post.id === postId));
const selectedItem = $derived(editable ? draft?.items.find((item) => item.id === selectedId) : undefined);
const tiers = $derived(draft ? getAnimeTiers(draft) : []);
const boards = $derived([...new Set([...archive.boards.map((board) => board.id), ...records.map((item) => item.boardId), ...(boardId ? [boardId] : [])])].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
const deleted = $derived(trash.filter((item) => item.boardId === boardId));
const stateTitle = $derived(target === "draft" ? "正在编辑工作草稿" : target ? `正在${editingPublic ? "编辑" : "查看"}公开版本：${currentVersion?.label || label}` : "此季度暂无榜单内容");
const quarterTitle = (id: string) => { const [y, q] = id.split("-"); return `${y}年${q}月新番`; };
const date = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });

async function api(body?: object) {
	const response = await fetch("/api/anime/", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "操作失败");
	return result;
}
async function refresh() {
	const state: AnimeDevState = await api();
	if (!state.features?.versionManagement) throw new Error("本机保存服务版本过旧，请重启 pnpm dev 后重试");
	archive = state.archive; records = state.drafts; trash = state.trash; versionRevisions = state.versionRevisions;
}
async function run(operation: () => Promise<void>) {
	if (busy) return;
	boardEditor?.commitTierName();
	busy = true; error = false; message = "处理中…";
	try { await operation(); } catch (e) { error = true; message = `${ready ? "操作失败" : "本机工作台加载失败，已保留公开内容"}：${e instanceof Error ? e.message : "请稍后重试"}`; }
	finally { busy = false; }
}
function load(id?: string, versionId?: string) {
	const selected = selectAnimeWorkbench(archive, records, id, versionId === "draft" ? undefined : versionId);
	boardId = selected.boardId; target = versionId === "draft" ? "draft" : selected.target;
	editingPublic = false; selectedId = null; undo = []; dirty = false; draft = null;
	revision = selected.record?.revision || null;
	versionRevision = versionRevisions[`${boardId}/${target}`] || "";
	if (target === "draft" && selected.record) {
		draft = normalizeLegacyDraft(structuredClone($state.snapshot(selected.record.draft)));
		const prepared = prepareAnimeDraftForEditing(draft);
		dirty = prepared !== draft; if (dirty) undo = [draft]; draft = prepared;
		label = selected.record.label || (draft.mode === "plan" ? "追番计划" : "中期评价");
	} else if (target && target !== "draft" && selected.version) {
		draft = normalizeLegacyDraft(structuredClone($state.snapshot(selected.version))); label = selected.version.label;
	}
	if (boardId) { const parts = boardId.split("-"); year = Number(parts[0]); quarter = Number(parts[1]); }
	postId = target === "draft" ? "" : archive.reviews[`${boardId}/${target}`] || "";
	message = dirty ? "旧草稿已调整为四档评价，差档作品退回待评价区；保存后生效" : ""; error = false;
}
function createDraft() {
	const source = versions.at(-1);
	draft = prepareAnimeDraftForEditing(source ? normalizeLegacyDraft(structuredClone($state.snapshot(source))) : { title: quarterTitle(boardId), year, quarter, mode: "plan", tiers: [...ANIME_TIERS.plan], items: [] });
	target = "draft"; revision = null; editingPublic = false; dirty = true; undo = []; selectedId = null; postId = "";
	label = draft.mode === "plan" ? "追番计划" : "中期评价";
	message = source ? "已基于最新公开版本创建工作草稿" : "已创建工作草稿，保存后保留在本机";
}
function requestTransition(title: string, action: () => void | Promise<void>) {
	if (busy || pending) return;
	boardEditor?.commitTierName();
	if (dirty) pending = { title, action };
	else void run(async () => { await action(); });
}
async function saveCurrent() {
	if (!draft) return;
	if (target === "draft") {
		const saved = await api({ action: "save", boardId, draft: $state.snapshot(draft), revision, label });
		revision = saved.revision;
	} else {
		await api({ action: "update", boardId, versionId: target, draft: $state.snapshot(draft), label, postId, versionRevision });
	}
	dirty = false; await refresh(); versionRevision = versionRevisions[`${boardId}/${target}`] || "";
	message = target === "draft" ? "工作草稿已保存到本机" : "此版本修改已保存，部署后同步到线上";
}
function resolvePending(save: boolean) {
	void run(async () => {
		if (!pending) return;
		if (save) await saveCurrent();
		const action = pending.action; pending = null; dirty = false; await action();
	});
}
async function publish() {
	if (!draft) return;
	let snapshot;
	if (target === "draft") {
		if (dirty || !revision) await saveCurrent();
		snapshot = await api({ action: "publish", boardId, revision, label });
	} else snapshot = await api({ action: "copy", boardId, versionId: target, draft: $state.snapshot(draft), label, postId, versionRevision });
	await refresh(); load(boardId, snapshot.id); message = "新公开版本已保存，部署后同步到线上";
}
function change(next: AnimeDraft) { if (!draft || busy || !editable) return; undo = [...undo.slice(-19), structuredClone($state.snapshot(draft))]; draft = next; dirty = true; }
function move(id: number, placement: AnimePlacement, before: number | null = null) { if (draft) change(moveItem(draft, id, placement, before)); }
function shift(direction: number) {
	if (!draft || !selectedItem) return;
	const group = draft.items.filter((item) => item.placement === selectedItem.placement);
	const index = group.findIndex((item) => item.id === selectedId);
	if (index + direction < 0 || index + direction >= group.length) return;
	move(selectedItem.id, selectedItem.placement, direction < 0 ? group[index - 1].id : group[index + 2]?.id ?? null);
}
function renameTier(index: number, name: string) {
	if (!draft || busy) return;
	try { const next = renameAnimeTier(draft, index, name); if (getAnimeTiers(next)[index] === tiers[index]) return; change(next); error = false; message = "栏目名称已修改，请保存当前内容"; }
	catch (e) { error = true; message = e instanceof Error ? e.message : "栏目名称无效"; }
}
function setMode(mode: AnimeMode) {
	if (!draft || mode === draft.mode) return;
	const custom = JSON.stringify(tiers) !== JSON.stringify(ANIME_TIERS[draft.mode]);
	if ((custom || draft.items.some((item) => item.placement !== "pool")) && !window.confirm("切换档位模式会恢复默认栏目，并把番剧放回待选区，随后重新排列。继续？")) return;
	change(convertMode(draft, mode)); if (target === "draft") label = mode === "plan" ? "追番计划" : "中期评价";
}
async function initialize() { await refresh(); load(initialBoardId, initialVersionId); ready = true; onready(); }
onMount(() => {
	void run(initialize);
	const beforeUnload = (event: BeforeUnloadEvent) => { boardEditor?.commitTierName(); if (dirty) { event.preventDefault(); event.returnValue = ""; } };
	const navigate = (event: MouseEvent) => {
		const anchor = (event.target as HTMLElement)?.closest("a");
		if (!anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || anchor.hasAttribute("download")) return;
		const url = new URL(anchor.href);
		if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) return;
		boardEditor?.commitTierName();
		if (dirty) { event.preventDefault(); event.stopImmediatePropagation(); requestTransition("离开追番工作台", () => { location.href = anchor.href; }); }
	};
	window.addEventListener("beforeunload", beforeUnload); document.addEventListener("click", navigate, true);
	return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", navigate, true); };
});
</script>

<section class="anime-editor" aria-label="本机追番工作台">
	<h3>本机追番工作台</h3>
	<p class="anime-meta">草稿仅保存在本机；公开版本的新增、修改和删除，在下次部署后同步到线上。</p>
	{#if message}<div class="anime-status" class:error role="status">{message}</div>{/if}
	{#if !ready && error}<button class="action" onclick={() => run(initialize)}>重新加载工作台</button>{/if}
	{#if ready}
	<fieldset disabled={busy || !!pending || !!deleteId} style="min-width:0">
		<div class="anime-toolbar">
			<label>季度<select aria-label="季度" value={boardId} onchange={(event) => { const id = event.currentTarget.value; event.currentTarget.value = boardId; requestTransition(`切换至${quarterTitle(id)}`, () => load(id)); }}><option value="" disabled>选择季度</option>{#each boards as id}<option value={id}>{quarterTitle(id)}</option>{/each}</select></label>
			<div class="anime-actions"><label>年份<input type="number" aria-label="新季度年份" min="1900" max="2100" bind:value={year} style="width:6rem" /></label><label>新番季度<select aria-label="新季度月份" bind:value={quarter}>{#each [1,4,7,10] as month}<option value={month}>{month}月</option>{/each}</select></label><button class="action" onclick={() => { const id = `${year}-${quarter}`; requestTransition(`打开${quarterTitle(id)}`, () => load(id)); }}>创建／打开季度</button></div>
		</div>
		{#if boardId}
		<nav class="anime-workbench-versions" aria-label="工作台版本列表">
			{#if record || target === "draft"}<button class="anime-pill version-choice" class:active={target === "draft"} aria-pressed={target === "draft"} onclick={() => requestTransition("切换至工作草稿", () => load(boardId, "draft"))}><strong>工作草稿</strong><span class="anime-meta">仅本机可见</span></button>{/if}
			{#each [...versions].reverse() as version}<button class="anime-pill version-choice" class:active={target === version.id} aria-pressed={target === version.id} onclick={() => requestTransition(`切换至${version.label}`, () => load(boardId, version.id))}><strong>{version.label}</strong><span class="anime-meta">创建于 {date(version.createdAt)}</span>{#if version.updatedAt}<span class="anime-meta">修改于 {date(version.updatedAt)}</span>{/if}</button>{/each}
		</nav>
		<div class="anime-current-heading"><h3>{quarterTitle(boardId)}</h3><p><strong>{stateTitle}</strong>{dirty ? " · 有未保存修改" : ""}</p>{#if draft}<span class="anime-meta">{draft.items.filter((item) => item.placement !== "pool").length} 部已排名 · 共 {draft.items.length} 部</span>{/if}</div>
		<div class="anime-actions">
			{#if target && target !== "draft"}
				{#if !editingPublic}<button class="action primary" onclick={() => { editingPublic = true; message = "正在编辑此公开版本，保存修改将覆盖这个版本；也可另存为新版本"; }}>编辑此版本</button><button class="action" onclick={() => { deleteId = target; }}>移入回收站</button>{:else}<button class="action" onclick={() => requestTransition("结束编辑并查看此版本", () => load(boardId, target))}>结束编辑</button>{/if}
				<a class="anime-pill" href={`${animeVersionUrl(boardId, target)}?preview=1`} target="_blank" rel="noopener">公开预览 ↗</a>
			{/if}
			{#if !record && target !== "draft"}<button class="action" onclick={() => requestTransition("创建工作草稿", createDraft)}>创建工作草稿</button>{/if}
		</div>
		{#if draft}
			{#if editable}
			<div class="anime-editor-fields">
				<label>{target === "draft" ? "拟发布版本名称" : "当前版本名称"}<input aria-label="版本名称" value={label} maxlength="100" oninput={(event) => { label = event.currentTarget.value; dirty = true; }} /></label>
				<label>档位模式<select value={draft.mode} onchange={(event) => { setMode(event.currentTarget.value as AnimeMode); event.currentTarget.value = draft!.mode; }}><option value="plan">追番计划 · 必追 / 想追 / 观望</option><option value="review">观看评价 · 神作 / 佳作 / 还行 / 拉</option></select></label>
				{#if target !== "draft"}<label>关联点评文章<select value={postId} onchange={(event) => { postId = event.currentTarget.value; dirty = true; }}><option value="">暂不关联</option>{#each reviewPosts as post}<option value={post.id}>{post.title}{post.draft ? "（文章草稿）" : ""}</option>{/each}</select></label>{/if}
			</div>
			<div class="anime-actions">
				<button class="action" onclick={() => run(async () => { const result = await api({action:"import", year:draft!.year, quarter:draft!.quarter}); busy = false; change(mergeImported(draft!, result.subjects)); busy = true; message = `导入完成，当前共 ${draft!.items.length} 部；已保留已有排序`; })}>导入当季番剧</button>
				<input aria-label="补充番剧链接" placeholder="Bangumi 条目链接" bind:value={subjectUrl} />
				<button class="action" disabled={!subjectUrl.trim()} onclick={() => run(async () => { const result = await api({action:"subject", url:subjectUrl}); busy = false; change(mergeImported(draft!, result.subjects)); busy = true; subjectUrl = ""; message = "已加入待选区"; })}>补充番剧</button>
			</div>
			<p class="anime-meta" style="margin-top:.8rem">拖动封面或点击调整位置；点击栏目名称可修改。</p>
			{/if}
			{#key `${boardId}/${target}/${editable}`}
			<AnimeBoard bind:this={boardEditor} {draft} {editable} {selectedId} onselect={(id) => selectedId = id} onmove={move} ontierrename={renameTier} ontierremove={(index) => { if (draft) change(removeAnimeTier(draft, index)); }} ontieradd={() => { if (draft) change(addAnimeTier(draft)); }} />
			{/key}
			{#if selectedItem}
				<div class="anime-selection"><strong>{selectedItem.title}</strong><div class="anime-actions" style="margin-top:.7rem"><select aria-label="番剧目标位置" value={selectedItem.placement} onchange={(event) => move(selectedItem!.id, event.currentTarget.value as AnimePlacement)}><option value="pool">待选／待评价</option>{#each tiers as tier, index}<option value="tier:{index}">{tier}</option>{/each}</select><button class="action" onclick={() => shift(-1)}>向前</button><button class="action" onclick={() => shift(1)}>向后</button><button class="action" onclick={() => { change({...draft!, items:draft!.items.filter((item) => item.id !== selectedId)}); selectedId = null; }}>移出榜单</button></div></div>
			{/if}
			{#if editable}<div class="anime-actions anime-save-actions"><button class="action" disabled={!undo.length} onclick={() => { draft = undo.at(-1)!; undo = undo.slice(0,-1); dirty = true; }}>撤销调整</button><button class="action primary" onclick={() => run(saveCurrent)}>{target === "draft" ? "保存草稿" : "保存此版本修改"}</button><button class="action" onclick={() => run(publish)}>{target === "draft" ? "保存为新公开版本" : "另存为新版本"}</button></div>{/if}
			{#if target !== "draft"}<aside class="anime-review-card" aria-label="所选版本点评"><h3>此版本的点评</h3>{#if review}<p>{review.title}{review.draft ? "（文章草稿）" : ""}</p>{#if review.description}<p>{review.description}</p>{/if}<a class="anime-pill" href={review.url}>进入文章 →</a>{:else}<p class="anime-meta">{postId ? "关联文章暂不可用。" : "尚未关联点评文章，可编辑此版本后选择。"}</p>{/if}</aside>{/if}
		{/if}
		{#if deleted.length}<details class="anime-trash"><summary>已删除版本（{deleted.length}）</summary>{#each deleted as entry}<div class="anime-trash-entry"><div><strong>{entry.snapshot.label}</strong><p class="anime-meta">删除于 {date(entry.deletedAt)}</p></div><button class="action" onclick={() => requestTransition(`恢复${entry.snapshot.label}`, async () => { const result = await api({action:"restore", boardId, versionId:entry.snapshot.id}); await refresh(); load(boardId, entry.snapshot.id); message = result.warning || "版本已恢复，部署后同步到线上"; })}>恢复</button></div>{/each}</details>{/if}
		{/if}
	</fieldset>
	{/if}
	{#if pending}<div class="anime-confirm" role="dialog" aria-modal="true" aria-label="未保存修改"><h3>有未保存修改</h3><p>即将{pending.title}。请先处理当前内容。</p><div class="anime-actions"><button class="action primary" disabled={busy} onclick={() => resolvePending(true)}>保存并切换</button><button class="action" disabled={busy} onclick={() => resolvePending(false)}>放弃修改并切换</button><button class="action" disabled={busy} onclick={() => { pending = null; }}>取消</button></div></div>{/if}
	{#if deleteId}<div class="anime-confirm" role="dialog" aria-modal="true" aria-label="移入回收站确认"><h3>移入回收站</h3><p>将「{quarterTitle(boardId)} · {versions.find((version) => version.id === deleteId)?.label}」移入回收站？作品、栏目和点评关联可恢复，文章不会删除。</p><div class="anime-actions"><button class="action primary" disabled={busy} onclick={() => run(async () => { await api({action:"trash", boardId, versionId:deleteId, versionRevision}); deleteId = ""; await refresh(); load(boardId); message = "版本已移入回收站，部署后同步到线上"; })}>确认移入回收站</button><button class="action" disabled={busy} onclick={() => deleteId = ""}>取消</button></div></div>{/if}
</section>
