import type { CollectionEntry } from "astro:content";
import path from "node:path";

export const isDynamicPublished = (
	entry: { data: { draft?: boolean } },
	production: boolean,
): boolean => !production || entry.data.draft !== true;

export const resolveDynamicImageSrc = (
	src: string,
	filePath: string,
	baseUrl: string,
): string => {
	if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(src)) return src;
	const split = src.search(/[?#]/);
	const pathname = split < 0 ? src : src.slice(0, split);
	const suffix = split < 0 ? "" : src.slice(split);
	const normalized = path.posix.normalize(filePath.replaceAll("\\", "/"));
	const marker = "src/content/dynamic/";
	const start = normalized.indexOf(marker);
	if (start < 0) return src;
	let decoded: string;
	try { decoded = decodeURIComponent(pathname); } catch { return src; }
	const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(normalized.slice(start)), decoded));
	if (!resolved.startsWith("public/")) return src;
	const encoded = resolved.slice(7).split("/").map(encodeURIComponent).join("/");
	return `${baseUrl.replace(/\/$/, "")}/${encoded}${suffix}`;
};

export const sortDynamics = (
	entries: CollectionEntry<"dynamic">[],
): CollectionEntry<"dynamic">[] =>
	entries.sort((a, b) => {
		// 置顶优先，然后按发布时间降序
		if (a.data.pinned && !b.data.pinned) return -1;
		if (!a.data.pinned && b.data.pinned) return 1;
		return b.data.published.getTime() - a.data.published.getTime();
	});

export const dynamicSlug = (id: string): string =>
	id.replace(/\.(md|mdx)$/i, "");

export const dynamicAnchor = (id: string): string =>
	`dynamic-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

export const dynamicPlainText = (entry: CollectionEntry<"dynamic">): string =>
	(entry.body || "")
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export const dynamicSearchText = (entry: CollectionEntry<"dynamic">): string =>
	[dynamicPlainText(entry), entry.data.location]
		.filter(Boolean)
		.join(" ")
		.toLocaleLowerCase();
