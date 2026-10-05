import { navBarConfig } from "@/config/navBarConfig";
import { sidebarLayoutConfig } from "@/config/sidebarConfig";
import { backgroundWallpaper } from "@/config/backgroundWallpaper";
import savedVisibility from "@/constants/saved-ui-visibility.json";
import type { NavBarLink } from "@/types/navBarConfig";

export interface UiVisibilityTarget {
	id: string;
	label: string;
	group: string;
	selector: string;
}

export interface UiVisibilitySettings {
	hiddenTargets: string[];
}

export const UI_VISIBILITY_STORAGE_KEY = "firefly-ui-visibility-preview";

export function getNavVisibilityId(link: NavBarLink): string {
	return `nav-${encodeURIComponent(link.url === "#" ? (link.icon || link.name) : link.url)}`;
}

export function getHomeLinkVisibilityId(name: string): string {
	return `home-link-${encodeURIComponent(name)}`;
}

export function getWidgetVisibilityId(side: "left" | "right" | "bottom", component: { type: string }): string {
	const components = side === "bottom" ? sidebarLayoutConfig.mobileBottomComponents : sidebarLayoutConfig[`${side}Components`];
	const matches = components.filter(item => item.type === component.type);
	const suffix = matches.length > 1 ? `-${matches.indexOf(component as typeof matches[number]) + 1}` : "";
	return `sidebar-${side}-${component.type}${suffix}`;
}

function target(id: string, label: string, group: string, selector = `[data-ui-target="${id}"]`): UiVisibilityTarget {
	return { id, label, group, selector };
}

const widgetLabels: Record<string, string> = {
	profile: "个人资料", announcement: "公告", music: "音乐", categories: "分类",
	tags: "标签", sidebarToc: "文章目录", advertisement: "广告", stats: "站点统计",
	calendar: "日历", siteInfo: "站点信息", dynamic: "最新动态", spine: "看板娘",
};

// 固定入口使用已有 ID；重复出现在桌面/手机上的导航项共用同一个标识。
export const UI_VISIBILITY_TARGETS: UiVisibilityTarget[] = [
	target("home-title", "首页主标题", "首页", ".banner-home-text-overlay .banner-title"),
	target("home-subtitle", "首页副标题", "首页", "#banner-subtitle"),
	...(backgroundWallpaper.common?.homeText?.links ?? []).map(link =>
		target(getHomeLinkVisibilityId(link.name), link.name, "首页")),
	...navBarConfig.links.flatMap(link => [
		target(getNavVisibilityId(link), link.name, "导航菜单"),
		...(link.children ?? []).map(child => target(getNavVisibilityId(child), `${link.name} · ${child.name}`, "导航菜单")),
	]),
	target("search", "搜索", "导航按钮", "#search-bar, #search-switch, #search-panel"),
	target("navbar-music", "音乐按钮及面板", "导航按钮", "#music-player-switch, #music-nav-panel"),
	target("navbar-video", "背景视频按钮", "导航按钮", "#bg-player-toggle"),
	target("navbar-theme", "主题切换按钮及面板", "导航按钮", "#scheme-switch, #theme-mode-panel"),
	...(["left", "right", "bottom"] as const).flatMap(side => {
		const components = side === "bottom" ? sidebarLayoutConfig.mobileBottomComponents : sidebarLayoutConfig[`${side}Components`];
		const sideLabel = { left: "左侧", right: "右侧", bottom: "手机底部" }[side];
		return components.map(comp => target(getWidgetVisibilityId(side, comp), `${sideLabel} · ${widgetLabels[comp.type] ?? comp.type}${components.filter(item => item.type === comp.type).length > 1 ? ` ${components.filter(item => item.type === comp.type).indexOf(comp) + 1}` : ""}`, "侧栏模块"));
	}),
	target("category-bar", "文章分类栏", "页面区域", "#category-bar-wrapper"),
	target("footer", "页脚", "页面区域", ".site-footer"),
	target("floating-toc", "悬浮目录", "悬浮工具", "#floating-toc-wrapper"),
	target("immersive-reading", "沉浸阅读", "悬浮工具", "#immersive-reading-btn"),
	target("immersive-toc", "沉浸阅读目录", "悬浮工具", "#immersive-toc-toggle-btn, #immersive-toc"),
	target("back-to-comment", "跳转评论", "悬浮工具", "#back-to-comment-btn"),
	target("back-to-home", "返回首页", "悬浮工具", "#back-to-home-btn"),
	target("back-to-top", "回到顶部", "悬浮工具", "#back-to-top-btn"),
	target("spine-model", "Spine 看板娘", "悬浮工具", "#spine-model-container"),
	target("live2d", "Live2D 看板娘", "悬浮工具", "#l2d-widget-container"),
	target("scroll-down", "首页向下箭头", "悬浮工具", "#scroll-down-indicator"),
];

export function validateUiVisibility(input: unknown): UiVisibilitySettings {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("配置必须是 JSON 对象");
	const data = input as Record<string, unknown>;
	if (Object.keys(data).some(key => key !== "hiddenTargets") || !Array.isArray(data.hiddenTargets)) throw new Error("配置只接受 hiddenTargets 数组");
	const validIds = new Set(UI_VISIBILITY_TARGETS.map(item => item.id));
	if (data.hiddenTargets.some(id => typeof id !== "string" || !validIds.has(id))) throw new Error("包含未知或非法的隐藏目标");
	return { hiddenTargets: [...new Set(data.hiddenTargets as string[])] };
}

export function getSavedUiVisibility(): UiVisibilitySettings {
	try {
		return validateUiVisibility(savedVisibility);
	} catch {
		return { hiddenTargets: [] };
	}
}

export function isUiTargetHidden(id: string): boolean {
	const runtime = typeof document === "undefined" ? null : document.documentElement.getAttribute("data-ui-hidden");
	return (runtime === null ? getSavedUiVisibility().hiddenTargets : runtime.split(" ")).includes(id);
}

// 所有规则都在共享布局中生成，Swup 换入的节点无需重新扫描或逐个修改样式。
export function getUiVisibilityCss(): string {
	return UI_VISIBILITY_TARGETS.map(item => {
		const selectors = item.selector.split(",").map(selector => `html[data-ui-hidden~="${item.id}"] ${selector.trim()}`);
		return `${selectors.join(",")} { display: none !important; }`;
	}).join("\n");
}
