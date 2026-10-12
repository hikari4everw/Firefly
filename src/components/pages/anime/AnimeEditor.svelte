<script lang="ts">
import { onMount } from "svelte";
import type { AnimeArchive, AnimeDraft, AnimeDraftRecord, AnimeMode, AnimePlacement } from "@/types/anime";
import { ANIME_TIERS, addAnimeTier, animeVersionUrl, convertMode, getAnimeTiers, mergeImported, moveItem, normalizeLegacyDraft, prepareAnimeDraftForEditing, removeAnimeTier, renameAnimeTier } from "@/utils/anime-ranking";
import { getAnimeReviewCandidates } from "@/utils/anime-reviews";
import { selectAnimeState } from "@/utils/anime-selection";
import AnimeBoard from "./AnimeBoard.svelte";
let { posts, initialBoardId, initialVersionId }: { posts: { id: string; title: string; draft: boolean; category?: string | null; series?: string }[]; initialBoardId?: string; initialVersionId?: string } = $props();
let archive = $state<AnimeArchive>({ boards: [], reviews: {} });
let records = $state<AnimeDraftRecord[]>([]);
let draft = $state<AnimeDraft | null>(null);
let boardId = $state("");
let revision = $state<string | null>(null);
let year = $state(new Date().getFullYear());
let quarter = $state(Math.floor(new Date().getMonth() / 3) * 3 + 1);
let label = $state("追番计划");
let subjectUrl = $state("");
let selectedId = $state<number | null>(null);
let selectedVersion = $state("");
let postId = $state("");
let busy = $state(false);
let supportsTierNames = $state(false);
let dirty = $state(false);
let message = $state("");
let error = $state(false);
let undo = $state<AnimeDraft[]>([]);
let boardEditor = $state<AnimeBoard>();
const versions = $derived(archive.boards.find((board) => board.id === boardId)?.versions || []);
const reviewPosts = $derived(getAnimeReviewCandidates(posts.map((post) => ({ ...post, data: post })), archive.reviews[`${boardId}/${selectedVersion}`] || ""));
const selectedItem = $derived(draft?.items.find((item) => item.id === selectedId));
const tiers = $derived(draft ? getAnimeTiers(draft) : []);
const boards = $derived([...new Map([...archive.boards.map((board) => [board.id, board.title] as const), ...records.map((record) => [record.boardId, record.draft.title] as const)]).entries()].sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true })));

async function api(body?: object) {
	const response = await fetch("/api/anime/", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "操作失败");
	return result;
}
async function refresh() { const state = await api(); archive = state.archive; records = state.drafts; supportsTierNames = state.features?.tierNames === true; }
async function run(operation: () => Promise<void>) {
	if (busy) return;
	boardEditor?.commitTierName();
	busy = true; error = false; message = "处理中…";
	try { await operation(); } catch (e) { error = true; message = e instanceof Error ? e.message : "操作失败"; }
	finally { busy = false; }
}
function allowSwitch() { return !dirty || window.confirm("当前草稿尚未保存，放弃这些调整？"); }
function load(id: string, versionId?: string) {
	const { record, version } = selectAnimeState(archive, records, id, versionId);
	boardId = id; revision = record?.revision || null;
	draft = record ? normalizeLegacyDraft(structuredClone($state.snapshot(record.draft))) : version ? normalizeLegacyDraft(version) : { title: `${year}年${quarter}月新番`, year, quarter, mode: "plan", tiers: [...ANIME_TIERS.plan], items: [] };
	const prepared = prepareAnimeDraftForEditing(draft);
	selectedId = null; dirty = prepared !== draft; undo = dirty ? [structuredClone($state.snapshot(draft))] : []; draft = prepared; label = draft.mode === "plan" ? "追番计划" : "中期评价";
	year = draft.year; quarter = draft.quarter;
	selectedVersion = version?.id || ""; updatePost(); message = !supportsTierNames ? "本机保存服务仍是旧版，请重启 pnpm dev 后保存，避免栏目名称丢失" : dirty ? "已调整为四档评价，原差档作品已退回待评价区；保存后生效" : record ? "已载入本机草稿" : "可以开始调整，保存后会建立本机草稿";
}
function change(next: AnimeDraft) { if (!draft || busy) return; undo = [...undo.slice(-19), structuredClone($state.snapshot(draft))]; draft = next; dirty = true; }
function move(id: number, placement: AnimePlacement, before: number | null = null) { if (draft) change(moveItem(draft, id, placement, before)); }
function shift(direction: number) {
	if (!draft || !selectedItem) return;
	const group = draft.items.filter((item) => item.placement === selectedItem.placement);
	const index = group.findIndex((item) => item.id === selectedId);
	if (index + direction < 0 || index + direction >= group.length) return;
	move(selectedItem.id, selectedItem.placement, direction < 0 ? group[index - 1].id : group[index + 2]?.id ?? null);
}
async function save() {
	if (!draft) return;
	if (!supportsTierNames) throw new Error("请重启 pnpm dev，加载支持栏目名称的本机保存服务");
	const record = await api({ action: "save", boardId, draft: $state.snapshot(draft), revision });
	revision = record.revision; dirty = false; await refresh();
}
function updatePost() { postId = archive.reviews[`${boardId}/${selectedVersion}`] || ""; }
function renameTier(index: number, name: string) {
	if (!draft || busy) return;
	try {
		const next = renameAnimeTier(draft, index, name);
		if (getAnimeTiers(next)[index] === tiers[index]) return;
		change(next); error = false; message = "栏目名称已修改，保存草稿后生效";
	} catch (e) {
		error = true; message = e instanceof Error ? e.message : "栏目名称无效";
	}
}
function setMode(mode: AnimeMode) {
	if (!draft || mode === draft.mode) return;
	const customTiers = JSON.stringify(tiers) !== JSON.stringify(ANIME_TIERS[draft.mode]);
	if ((customTiers || draft.items.some((item) => item.placement !== "pool")) && !window.confirm("切换档位模式会恢复默认栏目，并把番剧放回待选区，随后重新排列。继续？")) return;
	change(convertMode(draft, mode)); label = mode === "plan" ? "追番计划" : "中期评价";
}
onMount(() => {
	run(async () => { await refresh(); const { board, record } = selectAnimeState(archive, records, initialBoardId); const id = record?.boardId || board?.id; if (id) load(id, initialVersionId); else message = "先选择季度，创建一张追番榜单"; });
	const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
	const navigate = (event: MouseEvent) => { const anchor = (event.target as HTMLElement)?.closest("a"); if (dirty && anchor && anchor.target !== "_blank" && !allowSwitch()) { event.preventDefault(); event.stopImmediatePropagation(); } };
	window.addEventListener("beforeunload", beforeUnload); document.addEventListener("click", navigate, true);
	return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", navigate, true); };
});
</script>

<section class="anime-editor" aria-label="本机追番编辑器">
	<h3>本机编辑工作台</h3>
	<p class="anime-meta">调整草稿后保存为公开版本，再随网站部署发布。</p>
	<div class="anime-status" class:error role="status">{message}</div>
	<fieldset disabled={busy} style="min-width:0">
		<div class="anime-toolbar">
			<label>已有榜单<select aria-label="已有榜单" value={boardId} onchange={(event) => { if (allowSwitch()) load(event.currentTarget.value); }}><option value="" disabled>选择榜单</option>{#each boards as [id, title]}<option value={id}>{title}</option>{/each}</select></label>
			<div class="anime-actions"><input type="number" aria-label="新榜单年份" min="1900" max="2100" bind:value={year} style="width:6rem" /><select aria-label="新榜单季度" bind:value={quarter}>{#each [1,4,7,10] as month}<option value={month}>{month}月新番</option>{/each}</select><button class="action" onclick={() => { if (allowSwitch()) load(`${year}-${quarter}`); }}>创建／打开季度</button></div>
		</div>
		{#if draft}
			<div class="anime-editor-fields">
				<label>榜单名称<input value={draft.title} maxlength="100" oninput={(event) => { if (draft) { draft.title = event.currentTarget.value; dirty = true; } }} /></label>
				<label>档位模式<select value={draft.mode} onchange={(event) => { setMode(event.currentTarget.value as AnimeMode); event.currentTarget.value = draft!.mode; }}><option value="plan">追番计划 · 必追 / 想追 / 观望</option><option value="review">观看评价 · 神作 / 佳作 / 还行 / 拉</option></select></label>
			</div>
			<div class="anime-actions">
				<button class="action" onclick={() => run(async () => { const result = await api({action:"import", year:draft!.year, quarter:draft!.quarter}); busy = false; change(mergeImported(draft!, result.subjects)); busy = true; message = `导入完成，当前共 ${draft!.items.length} 部；已保留已有排序`; })}>导入当季番剧</button>
				<input aria-label="补充番剧链接" placeholder="Bangumi 条目链接" bind:value={subjectUrl} />
				<button class="action" disabled={!subjectUrl.trim()} onclick={() => run(async () => { const result = await api({action:"subject", url:subjectUrl}); busy = false; change(mergeImported(draft!, result.subjects)); busy = true; subjectUrl = ""; message = "已加入待选区"; })}>补充番剧</button>
			</div>
			<p class="anime-meta" style="margin-top:.8rem">从待选区拖动封面到档位，拖回待选区可暂时移出排名。点击封面也可调整位置和顺序。</p>
			<AnimeBoard bind:this={boardEditor} {draft} editable selectedId={selectedId} onselect={(id) => selectedId = id} onmove={move} ontierrename={renameTier} ontierremove={(index) => { if (draft) change(removeAnimeTier(draft, index)); }} ontieradd={() => { if (draft) change(addAnimeTier(draft)); }} />
			{#if selectedItem}
				<div class="anime-selection"><strong>{selectedItem.title}</strong><div class="anime-actions" style="margin-top:.7rem">
					<select aria-label="番剧目标位置" value={selectedItem.placement} onchange={(event) => move(selectedItem!.id, event.currentTarget.value as AnimePlacement)}><option value="pool">待选／待评价</option>{#each tiers as tier, index}<option value="tier:{index}">{tier}</option>{/each}</select>
					<button class="action" onclick={() => shift(-1)}>向前</button><button class="action" onclick={() => shift(1)}>向后</button><button class="action" onclick={() => { change({...draft!, items:draft!.items.filter((item) => item.id !== selectedId)}); selectedId = null; }}>移出榜单</button>
				</div></div>
			{/if}
			<div class="anime-actions" style="margin-top:1rem"><button class="action" disabled={!undo.length} onclick={() => { draft = undo.at(-1)!; undo = undo.slice(0,-1); dirty = true; }}>撤销调整</button><button class="action" disabled={!supportsTierNames} onclick={() => run(async () => { await save(); message = "草稿已保存到本机"; })}>保存草稿{dirty ? " · 未保存" : ""}</button><input aria-label="公开版本名称" maxlength="100" bind:value={label} placeholder="例如：追番计划、中期评价、完结评价" /><button class="action primary" disabled={!supportsTierNames} onclick={() => run(async () => { if (dirty || !revision) await save(); const snapshot = await api({action:"publish", boardId, revision, label}); await refresh(); selectedVersion = snapshot.id; updatePost(); message = "公开版本已保存到本机，部署后访客可见"; })}>保存为公开版本</button></div>
			{#if versions.length}
				<div class="anime-editor-fields"><label>历史版本<select bind:value={selectedVersion} onchange={updatePost}>{#each [...versions].reverse() as version}<option value={version.id}>{version.label} · {new Date(version.createdAt).toLocaleDateString("zh-CN")}</option>{/each}</select></label><label>关联点评文章<select bind:value={postId}><option value="">暂不关联</option>{#each reviewPosts as post}<option value={post.id}>{post.title}{post.draft ? "（文章草稿）" : ""}</option>{/each}</select></label></div>
				<div class="anime-actions"><a class="anime-pill" href={animeVersionUrl(boardId, selectedVersion)} target="_blank" rel="noopener">查看这个版本</a><button class="action" onclick={() => { if (!allowSwitch()) return; const snapshot = versions.find((version) => version.id === selectedVersion); if (snapshot) { change(prepareAnimeDraftForEditing(normalizeLegacyDraft(snapshot))); label = snapshot.label; message = "已复制为待保存草稿，旧版本保持不变"; } }}>复制为草稿</button><button class="action" onclick={() => run(async () => { await api({action:"review", boardId, versionId:selectedVersion, postId}); await refresh(); message = "点评关联已保存，部署后生效"; })}>保存点评关联</button></div>
			{/if}
		{/if}
	</fieldset>
</section>
