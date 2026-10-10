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
	review: ["神作", "佳作", "还行", "及格", "差"],
};

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
		validatePlacement(item.placement, d.mode);
		ids.add(item.id);
	}
	return {
		title: d.title.trim(),
		year: d.year,
		quarter: d.quarter,
		mode: d.mode,
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
): asserts value is AnimePlacement {
	if (value === "pool") return;
	const match = /^tier:(\d+)$/.exec(value);
	if (!match || Number(match[1]) >= ANIME_TIERS[mode].length)
		throw new Error("只能放入有效档位或待选区");
}

/** 只用于读取旧记录；新保存的数据仍由 validateDraft 严格校验。 */
export function normalizeLegacyDraft(input: unknown): AnimeDraft {
	const draft = input as AnimeDraft;
	if (!draft || !Array.isArray(draft.items) || !(draft.mode in ANIME_TIERS))
		return validateDraft(input);
	return validateDraft({
		...draft,
		items: draft.items.map((item) => {
			const match = /^boundary:(\d+)$/.exec(item?.placement);
			if (!match || Number(match[1]) >= ANIME_TIERS[draft.mode].length - 1)
				return item;
			return { ...item, placement: `tier:${match[1]}` };
		}),
	});
}

export function moveItem(
	draft: AnimeDraft,
	id: number,
	placement: AnimePlacement,
	beforeId: number | null,
): AnimeDraft {
	validatePlacement(placement, draft.mode);
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
	return mode === draft.mode
		? draft
		: {
				...draft,
				mode,
				items: draft.items.map((item) => ({ ...item, placement: "pool" })),
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
