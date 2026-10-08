import { announcementConfig } from "@/config/announcementConfig";
import { backgroundWallpaper } from "@/config/backgroundWallpaper";
import { navBarConfig } from "@/config/navBarConfig";
import { profileConfig } from "@/config/profileConfig";
import { sidebarLayoutConfig } from "@/config/sidebarConfig";
import savedVisibility from "@/constants/saved-ui-visibility.json";
import type { NavBarLink } from "@/types/navBarConfig";
import type {
	MobileBottomComponentConfig,
	WidgetComponentConfig,
} from "@/types/sidebarConfig";

export interface UiVisibilityTarget {
	id: string;
	label: string;
	group: string;
	selector: string;
	styleFields: string[];
	contentFields: UiContentField[];
	styleSelectors?: { surface: string; text?: string; icon?: string };
}

export interface UiContentField {
	key: string;
	label: string;
	type: "text" | "textarea" | "subtitles" | "url" | "icon" | "boolean";
	value: string | boolean | string[];
}

export interface UiTargetOverride {
	style?: Record<string, string | number>;
	content?: Record<string, string | boolean | string[]>;
}

export interface UiVisibilitySettings {
	hiddenTargets: string[];
	overrides: Record<string, UiTargetOverride>;
}

interface UiStyleField {
	label: string;
	type: "number" | "color" | "select";
	min?: number;
	max?: number;
	step?: number;
	options?: string[];
}

export const UI_STYLE_FIELDS: Record<string, UiStyleField> = {
	fontSize: { label: "字号", type: "number", min: 8, max: 128, step: 1 },
	fontWeight: { label: "字重", type: "number", min: 100, max: 900, step: 100 },
	lineHeight: { label: "行高", type: "number", min: 0.8, max: 3, step: 0.1 },
	color: { label: "文字颜色", type: "color" },
	textAlign: {
		label: "文字对齐",
		type: "select",
		options: ["left", "center", "right"],
	},
	iconSize: { label: "图标尺寸", type: "number", min: 8, max: 96, step: 1 },
	backgroundColor: { label: "背景颜色", type: "color" },
	backgroundOpacity: {
		label: "背景不透明度 (%)",
		type: "number",
		min: 0,
		max: 100,
		step: 1,
	},
	paddingX: { label: "左右内边距", type: "number", min: 0, max: 128, step: 1 },
	paddingY: { label: "上下内边距", type: "number", min: 0, max: 128, step: 1 },
	marginX: {
		label: "左右外边距",
		type: "number",
		min: -128,
		max: 128,
		step: 1,
	},
	marginTop: {
		label: "上外边距",
		type: "number",
		min: -128,
		max: 128,
		step: 1,
	},
	marginBottom: {
		label: "下外边距",
		type: "number",
		min: -128,
		max: 128,
		step: 1,
	},
	borderRadius: { label: "圆角", type: "number", min: 0, max: 128, step: 1 },
	opacity: {
		label: "整体不透明度 (%)",
		type: "number",
		min: 0,
		max: 100,
		step: 1,
	},
};

export const UI_DEBUG_ICON_PREFIXES: string[] = [
	"material-symbols",
	"fa7-brands",
	"fa7-regular",
	"fa7-solid",
	"simple-icons",
	"mdi",
	"mingcute",
	"svg-spinners",
];
const spacingFields = [
	"backgroundColor",
	"backgroundOpacity",
	"paddingX",
	"paddingY",
	"marginX",
	"marginTop",
	"marginBottom",
	"borderRadius",
	"opacity",
];
const buttonFields = ["fontSize", "iconSize", "color", ...spacingFields];
const titleFields = [
	"fontSize",
	"fontWeight",
	"lineHeight",
	"color",
	"textAlign",
	"marginTop",
	"marginBottom",
];
const cardFields = ["fontSize", "fontWeight", "color", ...spacingFields];

function contentField(
	key: string,
	label: string,
	type: UiContentField["type"],
	value: UiContentField["value"],
): UiContentField {
	return { key, label, type, value };
}

function linkFields(
	link: { name: string; url: string; icon?: string; showName?: boolean },
	prefix = "",
): UiContentField[] {
	const key = (name: string) =>
		prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name;
	return [
		contentField(key("name"), "链接名称", "text", link.name),
		contentField(key("url"), "链接地址", "url", link.url),
		contentField(key("icon"), "图标", "icon", link.icon ?? ""),
		contentField(
			key("showName"),
			"显示名称",
			"boolean",
			link.showName ?? false,
		),
	];
}

export const UI_VISIBILITY_STORAGE_KEY = "firefly-ui-visibility-preview";

export function getNavVisibilityId(link: NavBarLink): string {
	return `nav-${encodeURIComponent(link.url === "#" ? link.icon || link.name : link.url)}`;
}

export function getHomeLinkVisibilityId(name: string): string {
	return `home-link-${encodeURIComponent(name)}`;
}

export function getWidgetVisibilityId(
	side: "left" | "right" | "bottom",
	component: { type: string },
): string {
	const components =
		side === "bottom"
			? sidebarLayoutConfig.mobileBottomComponents
			: sidebarLayoutConfig[`${side}Components`];
	const matches = components.filter((item) => item.type === component.type);
	const suffix =
		matches.length > 1
			? `-${matches.indexOf(component as (typeof matches)[number]) + 1}`
			: "";
	return `sidebar-${side}-${component.type}${suffix}`;
}

function target(
	id: string,
	label: string,
	group: string,
	selector = `[data-ui-target="${id}"]`,
): UiVisibilityTarget {
	let styleFields = buttonFields;
	let contentFields: UiContentField[] = [];
	let surface = selector;
	let text = selector;
	const fieldText = (base: string, field: string) =>
		base
			.split(",")
			.map((part) => `${part.trim()} [data-ui-field="${field}"]`)
			.join(",");
	if (id === "home-title" || id === "home-subtitle") {
		styleFields = titleFields;
		const home = backgroundWallpaper.common?.homeText;
		const subtitles = home?.subtitle ?? [];
		contentFields =
			id === "home-title"
				? [contentField("text", "标题文字", "text", home?.title ?? "")]
				: [
						contentField(
							"subtitles",
							"副标题（每行一句）",
							"subtitles",
							Array.isArray(subtitles) ? subtitles : [subtitles],
						),
					];
	} else if (id.startsWith("home-link-")) {
		const link = backgroundWallpaper.common?.homeText?.links?.find(
			(item) => getHomeLinkVisibilityId(item.name) === id,
		);
		if (link) contentFields = linkFields(link);
		text = fieldText(selector, "name");
	} else if (id.startsWith("nav-")) {
		const link = navBarConfig.links
			.flatMap((item) => [item, ...(item.children ?? [])])
			.find((item) => getNavVisibilityId(item) === id);
		if (link)
			contentFields = linkFields(link).filter(
				(field) =>
					field.key !== "showName" &&
					(!link.children?.length || field.key !== "url"),
			);
		surface = `${selector} > .dropdown-trigger, ${selector} > a, ${selector} > .mobile-menu-item, ${selector} > .mobile-dropdown > .mobile-menu-item, a${selector}`;
		text = fieldText(surface, "name");
	} else if (id.startsWith("sidebar-")) {
		styleFields = cardFields;
		surface = `${selector} .card-base`;
		const widget = (["left", "right", "bottom"] as const)
			.flatMap((side) => {
				const components =
					side === "bottom"
						? sidebarLayoutConfig.mobileBottomComponents
						: sidebarLayoutConfig[`${side}Components`];
				return components.map((component) => ({
					component,
					id: getWidgetVisibilityId(side, component),
				}));
			})
			.find((item) => item.id === id)?.component;
		contentFields = getWidgetContentFields(widget);
		text = fieldText(selector, widget?.type === "profile" ? "name" : "title");
	} else if (id === "footer" || id === "category-bar") {
		styleFields = [...cardFields, "lineHeight", "textAlign"];
		if (id === "category-bar") surface = "#category-bar";
		text =
			id === "footer"
				? `.site-footer [data-ui-field="copyrightName"], .site-footer [data-ui-field="note"], .site-footer [data-ui-copyright]`
				: `${selector} a, ${selector} button`;
		if (id === "footer")
			contentFields = [
				contentField("copyrightName", "版权名称", "text", profileConfig.name),
				contentField("note", "附加文字", "textarea", ""),
			];
	} else {
		styleFields = buttonFields.filter((key) => key !== "fontSize");
		const buttonSurfaces: Record<string, string> = {
			search: "#search-bar, #search-switch",
			"navbar-music": "#music-player-switch",
			"navbar-theme": "#scheme-switch",
			"immersive-toc": "#immersive-toc-toggle-btn",
		};
		surface = buttonSurfaces[id] ?? selector;
		text = surface;
	}
	const icon = surface
		.split(",")
		.map((part) => `${part.trim()} svg`)
		.join(",");
	return {
		id,
		label,
		group,
		selector,
		styleFields: [...styleFields],
		contentFields,
		styleSelectors: { surface, text, icon },
	};
}

const widgetLabels: Record<string, string> = {
	profile: "个人资料",
	announcement: "公告",
	music: "音乐",
	categories: "分类",
	tags: "标签",
	sidebarToc: "文章目录",
	advertisement: "广告",
	stats: "站点统计",
	calendar: "日历",
	siteInfo: "站点信息",
	dynamic: "最新动态",
	spine: "看板娘",
};

function getWidgetContentFields(
	widget?: WidgetComponentConfig | MobileBottomComponentConfig,
): UiContentField[] {
	if (!widget) return [];
	if (widget.type === "profile")
		return [
			contentField("name", "姓名", "text", profileConfig.name),
			contentField("bio", "个人简介", "textarea", profileConfig.bio ?? ""),
			...profileConfig.links.flatMap((link, index) =>
				linkFields(link, `link${index}`),
			),
		];
	const title =
		widget.type === "announcement"
			? announcementConfig.title || widgetLabels.announcement
			: widget.specificConfig?.ad?.title ||
				widgetLabels[widget.type] ||
				widget.type;
	const fields = [
		contentField("title", "模块标题", "text", title),
		contentField("showTitle", "显示标题", "boolean", widget.showTitle ?? true),
	];
	if (widget.type === "announcement")
		fields.push(
			contentField("body", "公告正文", "textarea", announcementConfig.content),
			contentField(
				"linkText",
				"链接文字",
				"text",
				announcementConfig.link?.text ?? "",
			),
			contentField(
				"linkUrl",
				"链接地址",
				"url",
				announcementConfig.link?.url ?? "",
			),
		);
	return fields;
}

// 固定入口使用已有 ID；重复出现在桌面/手机上的导航项共用同一个标识。
export const UI_VISIBILITY_TARGETS: UiVisibilityTarget[] = [
	target(
		"home-title",
		"首页主标题",
		"首页",
		".banner-home-text-overlay .banner-title",
	),
	target("home-subtitle", "首页副标题", "首页", "#banner-subtitle"),
	...(backgroundWallpaper.common?.homeText?.links ?? []).map((link) =>
		target(getHomeLinkVisibilityId(link.name), link.name, "首页"),
	),
	...navBarConfig.links.flatMap((link) => [
		target(getNavVisibilityId(link), link.name, "导航菜单"),
		...(link.children ?? []).map((child) =>
			target(
				getNavVisibilityId(child),
				`${link.name} · ${child.name}`,
				"导航菜单",
			),
		),
	]),
	target(
		"search",
		"搜索",
		"导航按钮",
		"#search-bar, #search-switch, #search-panel",
	),
	target(
		"navbar-music",
		"音乐按钮及面板",
		"导航按钮",
		"#music-player-switch, #music-nav-panel",
	),
	target("navbar-video", "背景视频按钮", "导航按钮", "#bg-player-toggle"),
	target(
		"navbar-theme",
		"主题切换按钮及面板",
		"导航按钮",
		"#scheme-switch, #theme-mode-panel",
	),
	...(["left", "right", "bottom"] as const).flatMap((side) => {
		const components =
			side === "bottom"
				? sidebarLayoutConfig.mobileBottomComponents
				: sidebarLayoutConfig[`${side}Components`];
		const sideLabel = { left: "左侧", right: "右侧", bottom: "手机底部" }[side];
		return components.map((comp) =>
			target(
				getWidgetVisibilityId(side, comp),
				`${sideLabel} · ${widgetLabels[comp.type] ?? comp.type}${components.filter((item) => item.type === comp.type).length > 1 ? ` ${components.filter((item) => item.type === comp.type).indexOf(comp) + 1}` : ""}`,
				"侧栏模块",
			),
		);
	}),
	target("category-bar", "文章分类栏", "页面区域", "#category-bar-wrapper"),
	target("footer", "页脚", "页面区域", ".site-footer"),
	target("floating-toc", "悬浮目录", "悬浮工具", "#floating-toc-wrapper"),
	target("immersive-reading", "沉浸阅读", "悬浮工具", "#immersive-reading-btn"),
	target(
		"immersive-toc",
		"沉浸阅读目录",
		"悬浮工具",
		"#immersive-toc-toggle-btn, #immersive-toc",
	),
	target("back-to-comment", "跳转评论", "悬浮工具", "#back-to-comment-btn"),
	target("back-to-home", "返回首页", "悬浮工具", "#back-to-home-btn"),
	target("back-to-top", "回到顶部", "悬浮工具", "#back-to-top-btn"),
	target("spine-model", "Spine 看板娘", "悬浮工具", "#spine-model-container"),
	target("live2d", "Live2D 看板娘", "悬浮工具", "#l2d-widget-container"),
	target("scroll-down", "首页向下箭头", "悬浮工具", "#scroll-down-indicator"),
];

function record(input: unknown, label: string): Record<string, unknown> {
	if (!input || typeof input !== "object" || Array.isArray(input))
		throw new Error(`${label}必须是 JSON 对象`);
	return input as Record<string, unknown>;
}

function validateUrl(value: string): boolean {
	if (
		value.includes("\\") ||
		Array.from(value).some(
			(char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
		) ||
		value.startsWith("//")
	)
		return false;
	if (!value) return true;
	if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
		try {
			const url = new URL(value);
			return (
				(["http:", "https:"].includes(url.protocol) && !!url.hostname) ||
				(url.protocol === "mailto:" && !!url.pathname)
			);
		} catch {
			return false;
		}
	}
	return value.startsWith("/") || value.startsWith("#");
}

export function validateUiVisibility(
	input: unknown,
	iconExists?: (name: string) => boolean,
): UiVisibilitySettings {
	const data = record(input, "配置");
	if (
		Object.keys(data).some(
			(key) => key !== "hiddenTargets" && key !== "overrides",
		) ||
		!Array.isArray(data.hiddenTargets)
	)
		throw new Error("配置只接受 hiddenTargets 数组和 overrides 对象");
	const targets = new Map(UI_VISIBILITY_TARGETS.map((item) => [item.id, item]));
	if (
		data.hiddenTargets.some((id) => typeof id !== "string" || !targets.has(id))
	)
		throw new Error("包含未知或非法的隐藏目标");
	const overrides: Record<string, UiTargetOverride> = {};
	for (const [id, raw] of Object.entries(
		data.overrides === undefined ? {} : record(data.overrides, "overrides"),
	)) {
		const item = targets.get(id);
		if (!item) throw new Error(`未知目标：${id}`);
		const source = record(raw, id);
		if (Object.keys(source).some((key) => key !== "style" && key !== "content"))
			throw new Error(`${id} 包含未知覆盖字段`);
		const override: UiTargetOverride = {};
		if (source.style !== undefined) {
			const style: Record<string, string | number> = {};
			for (const [key, value] of Object.entries(
				record(source.style, `${id}.style`),
			)) {
				const field = UI_STYLE_FIELDS[key];
				if (!field || !item.styleFields.includes(key))
					throw new Error(`${id} 不支持样式 ${key}`);
				if (field.type === "number") {
					if (
						typeof value !== "number" ||
						!Number.isFinite(value) ||
						(field.min !== undefined && value < field.min) ||
						(field.max !== undefined && value > field.max) ||
						(key === "fontWeight" && value % 100 !== 0)
					)
						throw new Error(`${key} 数值非法或越界`);
				} else if (
					typeof value !== "string" ||
					(field.type === "color"
						? !/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value)
						: !field.options?.includes(value))
				)
					throw new Error(`${key} 取值非法`);
				style[key] = value as string | number;
			}
			if (Object.keys(style).length) override.style = style;
		}
		if (source.content !== undefined) {
			const content: Record<string, string | boolean | string[]> = {};
			for (const [key, value] of Object.entries(
				record(source.content, `${id}.content`),
			)) {
				const field = item.contentFields.find((field) => field.key === key);
				if (!field) throw new Error(`${id} 不支持内容 ${key}`);
				if (field.type === "boolean") {
					if (typeof value !== "boolean")
						throw new Error(`${key} 必须是布尔值`);
				} else if (field.type === "subtitles") {
					if (
						!Array.isArray(value) ||
						value.length > 100 ||
						value.some(
							(text) => typeof text !== "string" || text.length > 10000,
						)
					)
						throw new Error(`${key} 必须是文字数组`);
				} else {
					if (typeof value !== "string" || value.length > 10000)
						throw new Error(`${key} 必须是文字且长度不超过 10000`);
					if (field.type === "url" && !validateUrl(value))
						throw new Error(`${key} 链接非法`);
					if (
						field.type === "icon" &&
						value &&
						(!/^[a-z0-9-]+:[a-z0-9-]+$/.test(value) ||
							!UI_DEBUG_ICON_PREFIXES.includes(value.split(":")[0]) ||
							(iconExists && !iconExists(value)))
					)
						throw new Error(`${key} 图标不存在或格式非法`);
				}
				content[key] = Array.isArray(value)
					? [...value]
					: (value as string | boolean);
			}
			if (Object.keys(content).length) override.content = content;
		}
		if (override.style || override.content) overrides[id] = override;
	}
	return {
		hiddenTargets: [...new Set(data.hiddenTargets as string[])],
		overrides,
	};
}

export function mergeUiVisibility(
	current: unknown,
	draft: unknown,
	selectedTargets: string[],
): UiVisibilitySettings {
	const saved = validateUiVisibility(current);
	const settings = validateUiVisibility(draft);
	const ids = new Set(UI_VISIBILITY_TARGETS.map((item) => item.id));
	if (
		!Array.isArray(selectedTargets) ||
		!selectedTargets.length ||
		selectedTargets.some((id) => typeof id !== "string" || !ids.has(id))
	)
		throw new Error("请选择至少一个合法板块");
	const selected = new Set(selectedTargets);
	const hiddenTargets = [
		...saved.hiddenTargets.filter((id) => !selected.has(id)),
		...settings.hiddenTargets.filter((id) => selected.has(id)),
	];
	const overrides = { ...saved.overrides };
	for (const id of selected) {
		delete overrides[id];
		if (settings.overrides[id]) overrides[id] = settings.overrides[id];
	}
	return { hiddenTargets, overrides };
}

export function getUiContent<T extends string | boolean | string[]>(
	id: string,
	key: string,
	fallback: T,
): T {
	const value = getSavedUiVisibility().overrides[id]?.content?.[key];
	return (value === undefined ? fallback : value) as T;
}

export function getUiStyleCss(settings: UiVisibilitySettings): string {
	const validated = validateUiVisibility(settings);
	const rules: string[] = [];
	const css = (selector: string, declarations: string[]) => {
		if (declarations.length)
			rules.push(
				`${selector}{${declarations.map((value) => `${value} !important`).join(";")};}`,
			);
	};
	for (const item of UI_VISIBILITY_TARGETS) {
		const style = validated.overrides[item.id]?.style;
		if (!style) continue;
		const selectors = item.styleSelectors ?? {
			surface: item.selector,
			text: item.selector,
			icon: item.selector,
		};
		const surface: string[] = [];
		const text: string[] = [];
		const icon: string[] = [];
		for (const [key, value] of Object.entries(style)) {
			if (
				["fontSize", "fontWeight", "lineHeight", "color", "textAlign"].includes(
					key,
				)
			) {
				const properties: Record<string, string> = {
					fontSize: "font-size",
					fontWeight: "font-weight",
					lineHeight: "line-height",
					color: "color",
					textAlign: "text-align",
				};
				const property = properties[key];
				text.push(`${property}:${value}${key === "fontSize" ? "px" : ""}`);
				if (key === "color") icon.push(`color:${value}`);
			} else if (key === "iconSize")
				icon.push(
					`width:${value}px`,
					`height:${value}px`,
					`font-size:${value}px`,
				);
			else if (key === "opacity")
				surface.push(`opacity:${Number(value) / 100}`);
			else if (key === "paddingX" || key === "paddingY" || key === "marginX") {
				const property = key === "marginX" ? "margin" : "padding";
				for (const side of key === "paddingY"
					? ["top", "bottom"]
					: ["left", "right"])
					surface.push(`${property}-${side}:${value}px`);
			} else if (
				key === "marginTop" ||
				key === "marginBottom" ||
				key === "borderRadius"
			)
				surface.push(
					`${{ marginTop: "margin-top", marginBottom: "margin-bottom", borderRadius: "border-radius" }[key]}:${value}px`,
				);
		}
		if (
			style.backgroundColor !== undefined ||
			style.backgroundOpacity !== undefined
		) {
			const color = style.backgroundColor ?? "var(--card-bg)";
			surface.push(
				`background-color:${style.backgroundOpacity === undefined ? color : `color-mix(in srgb, ${color} ${style.backgroundOpacity}%, transparent)`}`,
			);
		}
		css(selectors.surface, surface);
		css(selectors.text ?? selectors.surface, text);
		css(selectors.icon ?? selectors.surface, icon);
	}
	// properties 是现有最早的层；important 规则在层间按反向顺序优先。
	return rules.length ? `@layer properties {${rules.join("\n")}}` : "";
}

export function getSavedUiVisibility(): UiVisibilitySettings {
	try {
		return validateUiVisibility(savedVisibility);
	} catch {
		return { hiddenTargets: [], overrides: {} };
	}
}

export function isUiTargetHidden(id: string): boolean {
	// 本地保留板块便于继续编辑，隐藏配置只作用于构建后的正式页面。
	if (import.meta.env?.DEV === true) return false;
	const runtime =
		typeof document === "undefined"
			? null
			: document.documentElement.getAttribute("data-ui-hidden");
	return (
		runtime === null ? getSavedUiVisibility().hiddenTargets : runtime.split(" ")
	).includes(id);
}

// 所有规则都在共享布局中生成，Swup 换入的节点无需重新扫描或逐个修改样式。
export function getUiVisibilityCss(): string {
	if (import.meta.env?.DEV === true) return "";
	return UI_VISIBILITY_TARGETS.map((item) => {
		const selectors = item.selector
			.split(",")
			.map(
				(selector) => `html[data-ui-hidden~="${item.id}"] ${selector.trim()}`,
			);
		return `${selectors.join(",")} { display: none !important; }`;
	}).join("\n");
}
