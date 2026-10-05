<script lang="ts">
import { onMount } from "svelte";
import { previewUiVisibility } from "@/utils/ui-visibility-client";
import { getSavedUiVisibility, UI_VISIBILITY_TARGETS, validateUiVisibility } from "@/utils/ui-visibility";

const groups = [...new Set(UI_VISIBILITY_TARGETS.map(item => item.group))];
let hiddenTargets = $state<string[]>(getSavedUiVisibility().hiddenTargets);
let saving = $state(false);
let feedback = $state("");
let failed = $state(false);

onMount(() => {
	hiddenTargets = (document.documentElement.getAttribute("data-ui-hidden") || "").split(" ").filter(Boolean);
});

function preview(next: string[]): void {
	try {
		previewUiVisibility(next);
		hiddenTargets = next;
		failed = false;
		feedback = "已更新本地预览，尚未保存。";
	} catch (error) {
		failed = true;
		feedback = `预览失败：${error instanceof Error ? error.message : String(error)}`;
	}
}

async function save(): Promise<void> {
	if (saving) return;
	saving = true;
	feedback = "";
	try {
		const response = await fetch("/api/saved-ui-visibility.json", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ hiddenTargets }),
		});
		const result = await response.json();
		if (!response.ok || !result.ok) throw new Error(result.error || "保存失败");
		validateUiVisibility(result.settings);
		failed = false;
		feedback = "隐藏配置已保存。重新构建部署后，访客页面才会应用。";
	} catch (error) {
		failed = true;
		feedback = `保存失败，已保留当前选择：${error instanceof Error ? error.message : String(error)}`;
	} finally {
		saving = false;
	}
}
</script>

<div data-page-debug>
	<p class="mb-3 rounded-lg bg-(--btn-plain-bg-hover) p-3 text-xs leading-relaxed text-(--primary)">
		仅本地开发可见，访客看不到此工具。勾选仅用于本地预览；保存并重新构建部署后，访客页面才会应用。
	</p>
	<p class="mb-3 text-xs text-75">勾选表示隐藏，全站生效；原配置未启用的功能不会被重新开启。</p>
	{#each groups as group}
		<fieldset class="mb-3">
			<legend class="mb-1 font-semibold text-sm text-90">{group}</legend>
			{#each UI_VISIBILITY_TARGETS.filter(item => item.group === group) as item (item.id)}
				<label class="flex items-center gap-2 py-1.5 text-sm text-75 cursor-pointer">
					<input type="checkbox" checked={hiddenTargets.includes(item.id)} disabled={saving} onchange={(event) => preview(event.currentTarget.checked ? [...hiddenTargets, item.id] : hiddenTargets.filter(id => id !== item.id))} />
					<span>{item.label}</span>
				</label>
			{/each}
		</fieldset>
	{/each}
	<div class="sticky bottom-0 bg-(--card-bg) pt-3 pb-1 border-t border-black/5 dark:border-white/10">
		<div class="flex gap-2">
			<button class="flex-1 btn-regular rounded-md py-2 px-2 text-sm" disabled={saving} onclick={save}>{saving ? "保存中…" : "保存隐藏配置"}</button>
			<button class="flex-1 btn-regular rounded-md py-2 px-2 text-sm" disabled={saving} onclick={() => preview([])}>恢复原配置</button>
		</div>
		{#if feedback}<p role="status" class="mt-2 text-xs leading-relaxed" class:text-red-500={failed} class:text-(--primary)={!failed}>{feedback}</p>{/if}
	</div>
</div>
