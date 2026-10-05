import { MAILTO_ONCLICK_SCRIPT } from "@/utils/email-utils";
import {
	updateMainGridCols,
	updateSidebarComponentsVisibility,
} from "@/utils/grid-layout-utils";
import {
	getSavedUiVisibility,
	getUiStyleCss,
	UI_VISIBILITY_STORAGE_KEY,
	UI_VISIBILITY_TARGETS,
	type UiVisibilitySettings,
	validateUiVisibility,
} from "@/utils/ui-visibility";
import { url } from "@/utils/url-utils";

let initialized = false;
let swupRegistered = false;
let previewRevision = 0;
const iconCache = new Map<string, Promise<string>>();

export function getUiPreview(): UiVisibilitySettings {
	const stored = localStorage.getItem(UI_VISIBILITY_STORAGE_KEY);
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			return validateUiVisibility(
				Array.isArray(parsed) ? { hiddenTargets: parsed } : parsed,
			);
		} catch {
			// 旧草稿或无效草稿不能阻止开发页面加载。
		}
	}
	return getSavedUiVisibility();
}

async function getIcon(name: string): Promise<string> {
	if (!name) return "";
	let pending = iconCache.get(name);
	if (!pending) {
		pending = (async () => {
			const response = await fetch(
				`/api/ui-debug-icon.json?name=${encodeURIComponent(name)}`,
			);
			const result = await response.json();
			if (!response.ok || !result.ok || typeof result.svg !== "string")
				throw new Error(result.error || `图标不可用：${name}`);
			return result.svg;
		})();
		iconCache.set(name, pending);
	}
	try {
		return await pending;
	} catch (error) {
		iconCache.delete(name);
		throw error;
	}
}

function ownedNodes(root: HTMLElement, selector: string): HTMLElement[] {
	return [root, ...root.querySelectorAll<HTMLElement>(selector)].filter(
		(node) =>
			node.matches(selector) && node.closest("[data-ui-target]") === root,
	);
}

function baseValue(
	root: HTMLElement,
	key: string,
	fallback: string | boolean | string[],
): string | boolean | string[] {
	const node = ownedNodes(
		root,
		`[data-ui-field="${key}"][data-ui-base-value]`,
	)[0];
	if (!node?.dataset.uiBaseValue) return fallback;
	try {
		return JSON.parse(node.dataset.uiBaseValue);
	} catch {
		return fallback;
	}
}

function updateLink(link: HTMLElement, rawValue: string): void {
	if (!(link instanceof HTMLAnchorElement)) return;
	const value = rawValue.replace(/^(?:https?|mailto):/i, (protocol) =>
		protocol.toLowerCase(),
	);
	const internal = value.startsWith("/") && !value.startsWith("//");
	const mail = value.startsWith("mailto:");
	const href = mail ? "#" : internal ? url(value) : value;
	link.setAttribute("href", href);
	if (mail) {
		const bytes = new TextEncoder().encode(value.slice(7));
		link.dataset.encodedEmail = btoa(
			Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
		);
		link.setAttribute("onclick", MAILTO_ONCLICK_SCRIPT);
	} else {
		link.removeAttribute("data-encoded-email");
		if (link.getAttribute("onclick") === MAILTO_ONCLICK_SCRIPT)
			link.removeAttribute("onclick");
	}
	if (internal) {
		link.removeAttribute("target");
		if (
			link.classList.contains("mobile-menu-item") ||
			link.hasAttribute("data-nav-href")
		)
			link.dataset.navHref = href;
	} else {
		link.removeAttribute("data-nav-href");
		if (!mail && /^https?:|^\/\//.test(value)) link.target = "_blank";
		else link.removeAttribute("target");
	}
	const rel = new Set(
		(link.getAttribute("rel") || "").split(/\s+/).filter(Boolean),
	);
	for (const token of ["noopener", "noreferrer"]) {
		if (link.target === "_blank") rel.add(token);
		else rel.delete(token);
	}
	if (rel.size) link.rel = [...rel].join(" ");
	else link.removeAttribute("rel");
}

async function prepareIcons(
	settings: UiVisibilitySettings,
	validateDraft = false,
): Promise<Map<string, string>> {
	const names = new Set<string>();
	for (const target of UI_VISIBILITY_TARGETS) {
		for (const field of target.contentFields) {
			if (field.type !== "icon") continue;
			const value =
				settings.overrides[target.id]?.content?.[field.key] ?? field.value;
			if (typeof value !== "string" || !value) continue;
			// 所有图标草稿都验证，包括当前页面未渲染的板块。
			if (
				(validateDraft &&
					settings.overrides[target.id]?.content?.[field.key] !== undefined) ||
				Array.from(
					document.querySelectorAll<HTMLElement>(target.selector),
				).some((root) =>
					ownedNodes(
						root,
						`[data-ui-kind="icon"][data-ui-field="${field.key}"]`,
					).some((node) => (node.dataset.uiIconName ?? field.value) !== value),
				)
			)
				names.add(value);
		}
	}
	return new Map(
		await Promise.all(
			[...names].map(async (name) => [name, await getIcon(name)] as const),
		),
	);
}

function applySettings(
	settings: UiVisibilitySettings,
	icons: Map<string, string>,
): void {
	document.documentElement.setAttribute(
		"data-ui-hidden",
		settings.hiddenTargets.join(" "),
	);
	const css = getUiStyleCss(settings);
	const savedStyle = document.getElementById("ui-saved-style");
	if (savedStyle) savedStyle.textContent = css;
	let previewStyle = document.getElementById("ui-debug-preview-style");
	if (!previewStyle) {
		previewStyle = document.createElement("style");
		previewStyle.id = "ui-debug-preview-style";
		document.head.append(previewStyle);
	}
	previewStyle.textContent = css;
	let subtitlesChanged = false;
	for (const target of UI_VISIBILITY_TARGETS) {
		for (const root of document.querySelectorAll<HTMLElement>(
			target.selector,
		)) {
			for (const field of target.contentFields) {
				const value =
					settings.overrides[target.id]?.content?.[field.key] ??
					baseValue(root, field.key, field.value);
				if (field.type === "subtitles" && Array.isArray(value)) {
					const serialized = JSON.stringify(value);
					if (root.dataset.subtitles !== serialized) {
						root.dataset.subtitles = serialized;
						const writer = root.querySelector<HTMLElement>("[data-text]");
						if (writer) writer.dataset.text = serialized;
						else
							for (const node of ownedNodes(
								root,
								`[data-ui-field="${field.key}"]`,
							))
								node.textContent = value[0] || "";
						subtitlesChanged = true;
					}
					continue;
				}
				if (field.type === "boolean") {
					for (const label of ownedNodes(
						root,
						`[data-ui-show-name-field="${field.key}"]`,
					)) {
						label.hidden = !value;
						label.classList.toggle("hidden", !value);
						const link = label.closest("a");
						if (link?.classList.contains("banner-link"))
							link.classList.toggle("banner-link-text", !!value);
						else if (link) {
							link.classList.toggle("w-10", !value);
							link.classList.toggle("px-3", !!value);
							link.classList.toggle("gap-2", !!value);
						}
					}
					if (field.key === "showTitle") {
						const visible =
							!!value &&
							ownedNodes(root, '[data-ui-field="title"]').some(
								(node) => !!node.textContent?.trim(),
							);
						for (const title of ownedNodes(root, "[data-ui-title]")) {
							title.hidden = !visible;
							title.classList.toggle("hidden", !visible);
						}
						for (const content of ownedNodes(
							root,
							'[data-ui-content-padding="true"]',
						))
							content.classList.toggle("pt-4", !visible);
					}
					continue;
				}
				if (typeof value !== "string") continue;
				if (field.type === "url") {
					for (const link of ownedNodes(
						root,
						`[data-ui-url-field="${field.key}"]`,
					))
						updateLink(link, value);
					continue;
				}
				for (const node of ownedNodes(root, `[data-ui-field="${field.key}"]`)) {
					if (field.type === "icon") {
						if (
							!node.matches('[data-ui-kind="icon"]') ||
							(node.dataset.uiIconName ?? field.value) === value
						)
							continue;
						const old = node.querySelector("svg");
						if (old?.getAttribute("class"))
							node.dataset.uiIconClass = old.getAttribute("class") || "";
						if (old?.getAttribute("style"))
							node.dataset.uiIconStyle = old.getAttribute("style") || "";
						const svg = value
							? new DOMParser().parseFromString(
									icons.get(value) || "",
									"image/svg+xml",
								).documentElement
							: null;
						if (svg && svg.localName !== "svg") continue;
						if (svg) {
							if (node.dataset.uiIconClass)
								svg.setAttribute("class", node.dataset.uiIconClass);
							if (node.dataset.uiIconStyle)
								svg.setAttribute("style", node.dataset.uiIconStyle);
							svg.setAttribute("aria-hidden", "true");
							old ? old.replaceWith(svg) : node.append(svg);
						} else old?.remove();
						node.dataset.uiIconName = value;
					} else if (node.textContent !== value) node.textContent = value;
				}
				for (const link of ownedNodes(
					root,
					`[data-ui-name-field="${field.key}"]`,
				)) {
					link.setAttribute("aria-label", value);
					link.setAttribute("title", value);
				}
			}
		}
	}
	if (subtitlesChanged)
		document.dispatchEvent(new CustomEvent("firefly:ui-content-change"));
	updateMainGridCols();
	updateSidebarComponentsVisibility();
}

export async function previewUiVisibility(
	input: UiVisibilitySettings | string[],
): Promise<void> {
	const revision = ++previewRevision;
	const settings = validateUiVisibility(
		Array.isArray(input) ? { ...getUiPreview(), hiddenTargets: input } : input,
	);
	const icons = await prepareIcons(settings, true);
	if (revision !== previewRevision) return;
	// 校验与图标加载完成后才写存储，失败时保留完整旧草稿和页面。
	localStorage.setItem(UI_VISIBILITY_STORAGE_KEY, JSON.stringify(settings));
	applySettings(settings, icons);
}

export async function applyUiPreview(): Promise<void> {
	const settings = getUiPreview();
	const icons = await prepareIcons(settings);
	// 切页期间用户可能更新草稿，较慢的旧图标请求不能覆盖新预览。
	if (JSON.stringify(getUiPreview()) !== JSON.stringify(settings)) return;
	applySettings(settings, icons);
}

export function initializeUiPreview(): void {
	if (initialized) return;
	initialized = true;
	const apply = (): void => {
		void applyUiPreview().catch((error) => {
			document.dispatchEvent(
				new CustomEvent("firefly:ui-preview-error", {
					detail: error instanceof Error ? error.message : String(error),
				}),
			);
		});
	};
	const registerSwup = (): void => {
		if (!swupRegistered && window.swup) {
			window.swup.hooks.on("page:view", apply);
			swupRegistered = true;
		}
	};
	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", apply, { once: true });
	else apply();
	registerSwup();
	document.addEventListener("swup:enable", registerSwup);
}
