<script lang="ts">
import type { AnimeDraft, AnimePlacement } from "@/types/anime";
import { ANIME_TIERS } from "@/utils/anime-ranking";
import AnimeCover from "./AnimeCover.svelte";
let { draft, editable = false, selectedId = null, onmove, onselect }:
	{ draft: AnimeDraft; editable?: boolean; selectedId?: number | null; onmove?: (id: number, placement: AnimePlacement, before: number | null) => void; onselect?: (id: number) => void } = $props();
let dragging = $state<number | null>(null);
const tiers = $derived(ANIME_TIERS[draft.mode]);
const itemsAt = (placement: string) => draft.items.filter((item) => item.placement === placement);
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

<div class="anime-workspace" class:has-pool={editable || itemsAt("pool").length > 0}>
<div class="anime-ranking" class:editing={editable}>
	{#each tiers as tier, index}
		<div class="tier-row" style="--tier-hue: {165 - index * 28}">
			<div class="tier-label"><strong>{tier}</strong><span>{itemsAt(`tier:${index}`).length}</span></div>
			<div class="tier-content" role="group" aria-label={tier} ondragover={(event) => { if (editable) event.preventDefault(); }} ondrop={(event) => drop(event, `tier:${index}`)}>
				{#each itemsAt(`tier:${index}`) as item (item.id)}
					<AnimeCover {item} {editable} selected={selectedId === item.id} {onselect} ondragstart={start} ondragend={() => dragging = null} ondrop={(event, id) => drop(event, `tier:${index}`, id)} />
				{/each}
				{#if itemsAt(`tier:${index}`).length === 0}<span class="tier-empty">{editable ? "拖入番剧" : "暂无"}</span>{/if}
			</div>
		</div>
	{/each}
</div>

{#if editable || itemsAt("pool").length > 0}
	<div class="anime-pool" role="group" aria-label="待选番剧" ondragover={(event) => { if (editable) event.preventDefault(); }} ondrop={(event) => drop(event, "pool")}>
		<h3>{draft.mode === "plan" ? "待选番剧" : "待评价"}<span>{itemsAt("pool").length}</span></h3>
		<div class="pool-covers">
			{#each itemsAt("pool") as item (item.id)}<AnimeCover {item} {editable} selected={selectedId === item.id} {onselect} ondragstart={start} ondragend={() => dragging = null} ondrop={(event, id) => drop(event, "pool", id)} />{/each}
			{#if itemsAt("pool").length === 0}<p class="tier-empty">{editable ? "导入季度番剧，或添加条目链接" : "全部已排列"}</p>{/if}
		</div>
	</div>
{/if}

</div>
