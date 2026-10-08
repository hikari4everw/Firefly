<script lang="ts">
import { onMount } from "svelte";
import {
	getSavedUiVisibility,
	UI_STYLE_FIELDS,
	UI_VISIBILITY_TARGETS,
	type UiVisibilitySettings,
	validateUiVisibility,
} from "@/utils/ui-visibility";
import {
	getUiPreview,
	previewUiVisibility,
} from "@/utils/ui-visibility-client";

const groups = [...new Set(UI_VISIBILITY_TARGETS.map((item) => item.group))];
let draft = $state<UiVisibilitySettings>(getSavedUiVisibility());
let saved = $state<UiVisibilitySettings>(getSavedUiVisibility());
let selectedTargets = $state<string[]>([]);
let saving = $state(false);
let previewing = $state(false);
let invalidDraft = $state(false);
let feedback = $state("");
let failed = $state(false);
let subtitleInputs = $state<Record<string, string>>({});
let previewRevision = 0;
const busy = $derived(saving || previewing);

function sorted(
	record: Record<string, unknown> | undefined,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(record || {}).sort(([a], [b]) => a.localeCompare(b)),
	);
}

function signature(settings: UiVisibilitySettings, id: string): string {
	const override = settings.overrides[id];
	return JSON.stringify({
		hidden: settings.hiddenTargets.includes(id),
		style: sorted(override?.style),
		content: sorted(override?.content),
	});
}

function status(id: string): string {
	if (signature(draft, id) !== signature(saved, id)) return "本地未保存";
	return signature(saved, id) ===
		signature({ hiddenTargets: [], overrides: {} }, id)
		? "原配置"
		: "已保存";
}

function cloneDraft(): UiVisibilitySettings {
	return JSON.parse(JSON.stringify(draft));
}

function compact(settings: UiVisibilitySettings, id: string): void {
	const override = settings.overrides[id];
	if (!override) return;
	if (!Object.keys(override.style || {}).length) delete override.style;
	if (!Object.keys(override.content || {}).length) delete override.content;
	if (!override.style && !override.content) delete settings.overrides[id];
}

async function preview(next: UiVisibilitySettings): Promise<void> {
	if (saving) return;
	const revision = ++previewRevision;
	draft = next;
	previewing = true;
	try {
		await previewUiVisibility(next);
		if (revision !== previewRevision) return;
		invalidDraft = false;
		failed = false;
		feedback = "已更新本地预览，尚未保存。";
	} catch (error) {
		if (revision !== previewRevision) return;
		invalidDraft = true;
		failed = true;
		feedback = `预览未应用，请修正输入：${error instanceof Error ? error.message : String(error)}`;
	} finally {
		if (revision === previewRevision) previewing = false;
	}
}

function changeSubtitles(id: string, key: string, input: string): void {
	subtitleInputs[`${id}:${key}`] = input;
	changeContent(
		id,
		key,
		input
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean),
	);
}

function changeHidden(id: string, hidden: boolean): void {
	const next = cloneDraft();
	next.hiddenTargets = hidden
		? [...new Set([...next.hiddenTargets, id])]
		: next.hiddenTargets.filter((item) => item !== id);
	void preview(next);
}

function changeStyle(id: string, key: string, input: string): void {
	const next = cloneDraft();
	next.overrides[id] ||= {};
	const override = next.overrides[id];
	override.style ||= {};
	const style = override.style;
	const definition = UI_STYLE_FIELDS[key];
	if (!input.trim()) delete style[key];
	else style[key] = definition.type === "number" ? Number(input) : input.trim();
	compact(next, id);
	void preview(next);
}

function changeContent(
	id: string,
	key: string,
	value: string | boolean | string[],
): void {
	const next = cloneDraft();
	const field = UI_VISIBILITY_TARGETS.find(
		(item) => item.id === id,
	)?.contentFields.find((item) => item.key === key);
	next.overrides[id] ||= {};
	const override = next.overrides[id];
	override.content ||= {};
	const content = override.content;
	if (JSON.stringify(value) === JSON.stringify(field?.value))
		delete content[key];
	else content[key] = value;
	compact(next, id);
	void preview(next);
}

function resetTarget(id: string): void {
	const next = cloneDraft();
	delete next.overrides[id];
	next.hiddenTargets = next.hiddenTargets.filter((item) => item !== id);
	for (const key of Object.keys(subtitleInputs))
		if (key.startsWith(`${id}:`)) delete subtitleInputs[key];
	void preview(next);
}

function resetAll(): void {
	subtitleInputs = {};
	void preview({ hiddenTargets: [], overrides: {} });
}

function selectTarget(id: string, selected: boolean): void {
	selectedTargets = selected
		? [...new Set([...selectedTargets, id])]
		: selectedTargets.filter((item) => item !== id);
}

async function save(): Promise<void> {
	if (busy || !selectedTargets.length || invalidDraft) return;
	saving = true;
	feedback = "";
	try {
		const settings = validateUiVisibility(cloneDraft());
		const response = await fetch("/api/saved-ui-visibility.json", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ selectedTargets, settings }),
		});
		const result = await response.json();
		if (!response.ok || !result.ok) throw new Error(result.error || "保存失败");
		saved = validateUiVisibility(result.settings);
		const count = selectedTargets.length;
		selectedTargets = [];
		failed = false;
		feedback = `已保存 ${count} 个板块。其余修改仍仅用于本地预览；重新构建部署后，访客页面才会应用。`;
	} catch (error) {
		failed = true;
		feedback = `保存失败，已保留草稿和保存选择：${error instanceof Error ? error.message : String(error)}`;
	} finally {
		saving = false;
	}
}

onMount(() => {
	try {
		draft = getUiPreview();
	} catch (error) {
		failed = true;
		feedback = `无法读取本地预览存储：${error instanceof Error ? error.message : String(error)}`;
	}
	let mounted = true;
	void (async () => {
		try {
			const response = await fetch("/api/saved-ui-visibility.json", {
				cache: "no-store",
			});
			const result = await response.json();
			if (!response.ok || !result.ok)
				throw new Error(result.error || "读取失败");
			if (mounted) saved = validateUiVisibility(result.settings);
		} catch (error) {
			if (!mounted) return;
			failed = true;
			feedback = `无法读取磁盘已保存配置，已保留本地草稿：${error instanceof Error ? error.message : String(error)}`;
		}
	})();
	const onPreviewError = (event: Event): void => {
		invalidDraft = true;
		failed = true;
		feedback = `预览失败：${(event as CustomEvent<string>).detail}`;
	};
	document.addEventListener("firefly:ui-preview-error", onPreviewError);
	return () => {
		mounted = false;
		document.removeEventListener("firefly:ui-preview-error", onPreviewError);
	};
});
</script>

<div data-page-debug>
	<p class="mb-3 rounded-lg bg-(--btn-plain-bg-hover) p-3 text-xs leading-relaxed text-(--primary)">
		仅本地开发可见，访客看不到此工具。样式与内容修改可在本地预览；保存并重新构建部署后，访客页面才会应用。
	</p>
	<p class="mb-3 text-xs text-75">勾选“隐藏”后本地仍显示，方便继续调整；保存并部署后，正式网站全站隐藏。原配置未启用的功能不会被重新开启。只有勾选“保存此板块”的板块会写入配置，其余修改仅用于本地预览。</p>
	{#each groups as group}
		<fieldset class="mb-3">
			<legend class="mb-1 font-semibold text-sm text-90">{group}</legend>
			{#each UI_VISIBILITY_TARGETS.filter(item => item.group === group) as item (item.id)}
				<details class="debug-target">
					<summary class="py-2 cursor-pointer text-sm text-90">
						<span>{item.label}<span class="ml-2 text-xs text-50">{status(item.id)}</span></span>
						<span class="target-options">
						<label class="flex items-center gap-2 text-xs text-75">
							<input type="checkbox" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()} aria-label={`隐藏 ${item.label}`} checked={draft.hiddenTargets.includes(item.id)} disabled={saving} onchange={(event) => changeHidden(item.id, event.currentTarget.checked)} />隐藏
						</label>
						<label class="flex items-center gap-2 text-xs text-75">
							<input type="checkbox" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()} aria-label={`保存此板块 ${item.label}`} checked={selectedTargets.includes(item.id)} disabled={saving} onchange={(event) => selectTarget(item.id, event.currentTarget.checked)} />保存此板块
						</label>
						</span>
					</summary>
					{#if item.styleFields.length}
						<p class="mt-3 mb-1 text-xs text-50">样式：留空继承原配置</p>
						<div class="field-grid">
							{#each item.styleFields as key}
								{@const field = UI_STYLE_FIELDS[key]}
								<label class="field-label text-xs text-75">
									<span>{field.label}</span>
									{#if field.type === "select"}
										<select aria-label={`${item.label} ${field.label}`} disabled={saving} value={draft.overrides[item.id]?.style?.[key] ?? ""} onchange={(event) => changeStyle(item.id, key, event.currentTarget.value)}>
											<option value="">继承原配置</option>
											{#each field.options || [] as option}<option value={option}>{option}</option>{/each}
										</select>
									{:else if field.type === "number"}
										<input type="number" aria-label={`${item.label} ${field.label}`} disabled={saving} min={field.min} max={field.max} step={field.step ?? 1} placeholder="继承" value={draft.overrides[item.id]?.style?.[key] ?? ""} oninput={(event) => changeStyle(item.id, key, event.currentTarget.value)} />
									{:else}
										<input type="text" aria-label={`${item.label} ${field.label}`} disabled={saving} placeholder="继承（如 #ffffff）" value={draft.overrides[item.id]?.style?.[key] ?? ""} oninput={(event) => changeStyle(item.id, key, event.currentTarget.value)} />
									{/if}
								</label>
							{/each}
						</div>
					{/if}
					{#if item.contentFields.length}
						<p class="mt-3 mb-1 text-xs text-50">内容</p>
						<div class="content-fields">
							{#each item.contentFields as field}
								{@const value = draft.overrides[item.id]?.content?.[field.key] ?? field.value}
								<label class="field-label text-xs text-75">
									<span>{field.label}{field.type === "subtitles" ? "（每行一条）" : ""}</span>
									{#if field.type === "boolean"}
										<input type="checkbox" aria-label={`${item.label} ${field.label}`} disabled={saving} checked={!!value} onchange={(event) => changeContent(item.id, field.key, event.currentTarget.checked)} />
									{:else if field.type === "textarea" || field.type === "subtitles"}
										<textarea aria-label={`${item.label} ${field.label}`} disabled={saving} rows="3" value={field.type === "subtitles" ? subtitleInputs[`${item.id}:${field.key}`] ?? (Array.isArray(value) ? value.join("\n") : String(value)) : String(value)} oninput={(event) => field.type === "subtitles" ? changeSubtitles(item.id, field.key, event.currentTarget.value) : changeContent(item.id, field.key, event.currentTarget.value)}></textarea>
									{:else}
										<input type="text" aria-label={`${item.label} ${field.label}`} disabled={saving} value={String(value)} placeholder={field.type === "icon" ? "例如 mingcute:home-4-line" : field.type === "url" ? "/about/ 或 https://…" : ""} oninput={(event) => changeContent(item.id, field.key, event.currentTarget.value)} />
									{/if}
								</label>
							{/each}
						</div>
					{/if}
					<button class="btn-regular rounded-md py-1.5 px-2 mt-3 mb-2 text-xs" aria-label={`恢复原配置 ${item.label}`} disabled={saving} onclick={() => resetTarget(item.id)}>此板块恢复原配置（仅预览）</button>
				</details>
			{/each}
		</fieldset>
	{/each}
	<div class="sticky bottom-0 bg-(--card-bg) pt-3 pb-1 border-t border-black/5 dark:border-white/10">
		<div class="flex flex-wrap gap-2 mb-2">
			<button class="btn-regular rounded-md py-1.5 px-2 text-xs" disabled={saving} onclick={() => selectedTargets = UI_VISIBILITY_TARGETS.filter(item => signature(draft, item.id) !== signature(saved, item.id)).map(item => item.id)}>选择全部已修改板块</button>
			<button class="btn-regular rounded-md py-1.5 px-2 text-xs" disabled={saving || !selectedTargets.length} onclick={() => selectedTargets = []}>清空保存选择</button>
		</div>
		<div class="flex gap-2">
			<button class="flex-1 btn-regular rounded-md py-2 px-2 text-sm" disabled={busy || invalidDraft || !selectedTargets.length} onclick={save}>{saving ? "保存中…" : `保存所选板块（${selectedTargets.length}）`}</button>
			<button class="flex-1 btn-regular rounded-md py-2 px-2 text-sm" disabled={saving} onclick={resetAll}>全部恢复原配置</button>
		</div>
		{#if feedback}<p role="status" class="mt-2 text-xs leading-relaxed" class:text-red-500={failed} class:text-(--primary)={!failed}>{feedback}</p>{/if}
	</div>
</div>

<style>
.debug-target { border-bottom: 1px solid var(--line-divider); }
.target-options { display: inline-flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-left: 0.5rem; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
.content-fields { display: grid; gap: 0.6rem; }
.field-label { display: flex; flex-direction: column; gap: 0.25rem; }
.field-label input:not([type="checkbox"]), .field-label select, .field-label textarea { width: 100%; min-width: 0; padding: 0.4rem; border: 1px solid var(--line-divider); border-radius: 0.4rem; color: var(--text-90); background: var(--btn-plain-bg-hover); }
.field-label input[type="checkbox"] { align-self: flex-start; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
