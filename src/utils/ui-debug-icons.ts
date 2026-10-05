import { createRequire } from "node:module";
import type { IconifyJSON } from "@iconify/types";
import { getIconData, iconToHTML, iconToSVG, replaceIDs } from "@iconify/utils";
import { UI_DEBUG_ICON_PREFIXES } from "./ui-visibility";

const require = createRequire(import.meta.url);
const collections = new Map<string, IconifyJSON>();

function findIcon(name: string) {
	if (!/^[a-z0-9-]+:[a-z0-9-]+$/.test(name)) return null;
	const [prefix, icon] = name.split(":");
	if (!UI_DEBUG_ICON_PREFIXES.includes(prefix)) return null;
	let collection = collections.get(prefix);
	if (!collection) {
		collection = require(`@iconify-json/${prefix}/icons.json`) as IconifyJSON;
		collections.set(prefix, collection);
	}
	return getIconData(collection, icon);
}

export function uiDebugIconExists(name: string): boolean {
	return !!findIcon(name);
}

export function getUiDebugIconSvg(name: string): string | null {
	const data = findIcon(name);
	if (!data) return null;
	const svg = iconToSVG(data, { width: "1em", height: "1em" });
	return iconToHTML(replaceIDs(svg.body), svg.attributes);
}
