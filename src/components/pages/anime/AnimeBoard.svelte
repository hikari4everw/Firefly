<script lang="ts">
import { tick } from "svelte";
import type { AnimeDraft, AnimePlacement } from "@/types/anime";
import { getAnimeTiers, searchAnimePool } from "@/utils/anime-ranking";
import AnimeCover from "./AnimeCover.svelte";
let { draft, editable = false, selectedId = null, onmove, onselect, ontierrename, ontierremove, ontieradd }:
	{ draft: AnimeDraft; editable?: boolean; selectedId?: number | null; onmove?: (id: number, placement: AnimePlacement, before: number | null) => void; onselect?: (id: number) => void; ontierrename?: (index: number, name: string) => void; ontierremove?: (index: number) => void; ontieradd?: () => void } = $props();
let dragging = $state<number | null>(null);
let query = $state("");
let editingTier = $state<number | null>(null);
let tierName = $state("");
let nameInput: HTMLInputElement;
const tiers = $derived(getAnimeTiers(draft));
const pool = $derived(searchAnimePool(draft, query));
const itemsAt = (placement: string) => draft.items.filter((item) => item.placement === placement);
async function editTier(index: number) {
	editingTier = index; tierName = tiers[index];
	await tick(); nameInput?.focus(); nameInput?.select();
}
export function commitTierName(): void {
	if (editingTier === null) return;
	const index = editingTier;
	editingTier = null;
	ontierrename?.(index, tierName);
}
function start(event: DragEvent, id: number) {
	dragging = id;
	if (event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(id)); }
}
function drop(event: DragEvent, placement: AnimePlacement, before: number | null = null) {
	event.preventDefault();
	if (editable && dragging !== null) onmove?.(dragging, placement, before);
	dragging = null;
}
</script>

<div class="anime-workspace" class:has-pool={editable}>
<div class="anime-ranking" class:editing={editable}>
	{#each tiers as tier, index}
		<div class="tier-row" style="--tier-hue: {165 - index * 28}">
			<div class="tier-label">
				{#if editable}
					{#if editingTier === index}
						<input class="tier-name-input" aria-label={`栏目${index + 1}名称`} bind:this={nameInput} bind:value={tierName} onblur={commitTierName} onkeydown={(event) => { if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); commitTierName(); } }} />
					{:else}
						<button class="tier-name-button" aria-label={`修改栏目${index + 1}名称：${tier}`} onclick={() => editTier(index)}><strong>{tier}</strong></button>
					{/if}
					<button class="tier-delete" aria-label={`删除栏目${index + 1}：${tier}`} disabled={tiers.length <= 1} onclick={() => ontierremove?.(index)}>×</button>
				{:else}<strong>{tier}</strong>{/if}
				<span>{itemsAt(`tier:${index}`).length}</span>
			</div>
			<div class="tier-content" role="group" aria-label={tier} ondragover={(event) => { if (editable) event.preventDefault(); }} ondrop={(event) => drop(event, `tier:${index}`)}>
				{#each itemsAt(`tier:${index}`) as item (item.id)}
					<AnimeCover {item} {editable} selected={selectedId === item.id} {onselect} ondragstart={start} ondragend={() => dragging = null} ondrop={(event, id) => drop(event, `tier:${index}`, id)} />
				{/each}
				{#if itemsAt(`tier:${index}`).length === 0}<span class="tier-empty">{editable ? "拖入番剧" : "暂无"}</span>{/if}
			</div>
		</div>
	{/each}
	{#if editable}<button class="tier-add" disabled={tiers.length >= 20} onclick={ontieradd}>＋新增栏目</button>{/if}
</div>

{#if editable}
	<div class="anime-pool" role="group" aria-label="待选番剧" ondragover={(event) => event.preventDefault()} ondrop={(event) => drop(event, "pool")}>
		<h3>{draft.mode === "plan" ? "待选番剧" : "待评价"}<span>{query.trim() ? `${pool.length} / ${itemsAt("pool").length}` : pool.length}</span></h3>
		<div class="anime-pool-search"><input type="search" aria-label="搜索番剧名称" placeholder="搜索番剧名称" bind:value={query} />{#if query}<button class="action" aria-label="清空番剧搜索" onclick={() => query = ""}>清空</button>{/if}</div>
		<div class="pool-covers">
			{#each pool as item (item.id)}<AnimeCover {item} {editable} selected={selectedId === item.id} {onselect} ondragstart={start} ondragend={() => dragging = null} ondrop={(event, id) => drop(event, "pool", id)} />{/each}
			{#if pool.length === 0}<p class="tier-empty">{query.trim() ? "没有匹配的番剧" : "导入季度番剧，或添加条目链接"}</p>{/if}
		</div>
	</div>
{/if}

</div>
