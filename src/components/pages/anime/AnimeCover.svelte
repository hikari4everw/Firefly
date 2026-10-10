<script lang="ts">
import type { AnimeItem } from "@/types/anime";
let { item, editable = false, selected = false, onselect, ondragstart, ondragend, ondrop }:
	{ item: AnimeItem; editable?: boolean; selected?: boolean; onselect?: (id: number) => void; ondragstart?: (event: DragEvent, id: number) => void; ondragend?: () => void; ondrop?: (event: DragEvent, id: number) => void } = $props();
let failed = $state(false);
</script>

{#snippet cover()}
	{#if item.cover && !failed}<img src={item.cover} alt={item.title} loading="lazy" draggable="false" referrerpolicy="no-referrer" onerror={() => failed = true} />
	{:else}<span class="cover-fallback">{item.title}</span>{/if}
	<span class="cover-name">{item.title}</span>
{/snippet}

{#if editable}
	<button type="button" class:selected class="anime-cover" title={item.title} aria-label="调整 {item.title}" draggable="true" onclick={() => onselect?.(item.id)} ondragstart={(event) => ondragstart?.(event, item.id)} ondragend={() => ondragend?.()} ondrop={(event) => { event.stopPropagation(); ondrop?.(event, item.id); }}>{@render cover()}</button>
{:else}
	<a class="anime-cover" href="https://bgm.tv/subject/{item.id}" target="_blank" rel="noopener noreferrer" title={item.title}>{@render cover()}</a>
{/if}
