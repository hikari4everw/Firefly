import type {
	AnimeDraft,
	AnimeItem,
	AnimeMode,
	AnimePlacement,
	AnimeSnapshot,
	AnimeSubject,
} from "../types/anime";

export const ANIME_TIERS: Record<AnimeMode, string[]> = {
	plan: ["必追", "想追", "观望"],
	review: ["神作", "佳作", "还行", "拉"],
};

const LEGACY_REVIEW_TIERS = ["神作", "佳作", "还行", "及格", "差"];

export function getAnimeTiers(draft: AnimeDraft): string[] {
	return draft.tiers ?? ANIME_TIERS[draft.mode];
}

function validateTierNames(input: unknown): string[] {
	if (!Array.isArray(input) || input.length < 1 || input.length > 20)
		throw new Error("栏目数量须为1～20个");
	return input.map((name) => {
		if (typeof name !== "string" || !name.trim() || [...name.trim()].length > 30)
			throw new Error("栏目名称须为1～30字");
		return name.trim();
	});
}

export function validateDraft(input: unknown): AnimeDraft {
	const d = input as AnimeDraft;
	if (
		!d ||
		typeof d.title !== "string" ||
		!d.title.trim() ||
		d.title.length > 100 ||
		!Number.isInteger(d.year) ||
		d.year < 1900 ||
		d.year > 2100 ||
		![1, 4, 7, 10].includes(d.quarter) ||
		!(d.mode === "plan" || d.mode === "review") ||
		!Array.isArray(d.items) ||
		d.items.length > 1000
	)
		throw new Error("榜单内容或季度无效");
	const tiers = d.tiers === undefined ? undefined : validateTierNames(d.tiers);
	const ids = new Set<number>();
	for (const item of d.items) {
		if (
			!item ||
			!Number.isSafeInteger(item.id) ||
			item.id <= 0 ||
			ids.has(item.id) ||
			typeof item.title !== "string" ||
			!item.title.trim() ||
			item.title.length > 300 ||
			typeof item.cover !== "string" ||
			item.cover.length > 2000 ||
			(item.cover &&
				!/^https:\/\//.test(item.cover) &&
				!/^\/(?!\/)/.test(item.cover))
		)
			throw new Error("番剧信息无效或重复");
		validatePlacement(item.placement, d.mode, tiers);
		ids.add(item.id);
	}
	return {
		title: d.title.trim(),
		year: d.year,
		quarter: d.quarter,
		mode: d.mode,
		...(tiers ? { tiers } : {}),
		items: d.items.map(({ id, title, cover, placement }) => ({
			id,
			title: title.trim(),
			cover,
			placement,
		})),
	};
}

export function validatePlacement(
	value: string,
	mode: AnimeMode,
	tiers?: string[],
): asserts value is AnimePlacement {
	if (value === "pool") return;
	const match = /^tier:(\d+)$/.exec(value);
	if (!match || Number(match[1]) >= (tiers ?? ANIME_TIERS[mode]).length)
		throw new Error("只能放入有效档位或待选区");
}

/** 只用于读取旧记录；新保存的数据仍由 validateDraft 严格校验。 */
export function normalizeLegacyDraft(input: unknown): AnimeDraft {
	const draft = input as AnimeDraft;
	if (!draft || !Array.isArray(draft.items) || !(draft.mode in ANIME_TIERS))
		return validateDraft(input);
	const tiers = draft.tiers ?? (draft.mode === "review" ? LEGACY_REVIEW_TIERS : ANIME_TIERS.plan);
	return validateDraft({
		...draft,
		tiers,
		items: draft.items.map((item) => {
			const match = /^boundary:(\d+)$/.exec(item?.placement);
			if (!match || Number(match[1]) >= tiers.length - 1)
				return item;
			return { ...item, placement: `tier:${match[1]}` };
		}),
	});
}

export function prepareAnimeDraftForEditing(draft: AnimeDraft): AnimeDraft {
	if (draft.mode !== "review" || JSON.stringify(getAnimeTiers(draft)) !== JSON.stringify(LEGACY_REVIEW_TIERS)) return draft;
	return { ...draft, tiers: [...ANIME_TIERS.review], items: draft.items.map((item) => ({ ...item, placement: item.placement === "tier:4" ? "pool" : item.placement })) };
}

export function searchAnimePool(draft: AnimeDraft, query: string): AnimeItem[] {
	const name = query.trim().toLocaleLowerCase();
	return draft.items.filter((item) => item.placement === "pool" && item.title.toLocaleLowerCase().includes(name));
}

export function moveItem(
	draft: AnimeDraft,
	id: number,
	placement: AnimePlacement,
	beforeId: number | null,
): AnimeDraft {
	validatePlacement(placement, draft.mode, draft.tiers);
	const item = draft.items.find((entry) => entry.id === id);
	if (!item) throw new Error("番剧不存在");
	if (beforeId === id) return draft;
	const items = draft.items
		.filter((entry) => entry.id !== id)
		.map((entry) => ({ ...entry }));
	const before = items.findIndex(
		(entry) => entry.id === beforeId && entry.placement === placement,
	);
	items.splice(before < 0 ? items.length : before, 0, { ...item, placement });
	return { ...draft, items };
}

export function convertMode(draft: AnimeDraft, mode: AnimeMode): AnimeDraft {
	if (mode === draft.mode) return draft;
	const { tiers: _tiers, ...rest } = draft;
	return { ...rest, mode, tiers: [...ANIME_TIERS[mode]], items: draft.items.map((item) => ({ ...item, placement: "pool" })) };
}

export function addAnimeTier(draft: AnimeDraft): AnimeDraft {
	return { ...draft, tiers: validateTierNames([...getAnimeTiers(draft), "新栏目"]) };
}

function validateTierIndex(draft: AnimeDraft, index: number): void {
	if (!Number.isInteger(index) || index < 0 || index >= getAnimeTiers(draft).length)
		throw new Error("栏目不存在");
}

export function renameAnimeTier(draft: AnimeDraft, index: number, name: string): AnimeDraft {
	validateTierIndex(draft, index);
	const tiers = [...getAnimeTiers(draft)];
	tiers[index] = name;
	return { ...draft, tiers: validateTierNames(tiers) };
}

export function removeAnimeTier(draft: AnimeDraft, index: number): AnimeDraft {
	validateTierIndex(draft, index);
	const tiers = getAnimeTiers(draft);
	if (tiers.length === 1) throw new Error("至少保留一个栏目");
	return {
		...draft,
		tiers: tiers.filter((_, i) => i !== index),
		items: draft.items.map((item) => {
			if (item.placement === "pool") return item;
			const tier = Number(item.placement.slice(5));
			const placement: AnimePlacement = tier === index ? "pool" : tier > index ? `tier:${tier - 1}` : item.placement;
			return { ...item, placement };
		}),
	};
}

export function mergeImported(
	draft: AnimeDraft,
	subjects: AnimeSubject[],
): AnimeDraft {
	const ids = new Set(draft.items.map((item) => item.id));
	const additions: AnimeItem[] = [];
	for (const subject of subjects) {
		if (ids.has(subject.id)) continue;
		ids.add(subject.id);
		additions.push({ ...subject, placement: "pool" });
	}
	return validateDraft({ ...draft, items: [...draft.items, ...additions] });
}

export function createSnapshot(
	draft: AnimeDraft,
	label: string,
	id: string,
	createdAt: string,
): AnimeSnapshot {
	if (!label.trim() || label.length > 100)
		throw new Error("请填写版本名称（最多100字）");
	return { ...validateDraft(draft), id, label: label.trim(), createdAt };
}

export function animeVersionUrl(boardId: string, versionId: string): string {
	return `/anime/${encodeURIComponent(boardId)}/${encodeURIComponent(versionId)}/`;
}
