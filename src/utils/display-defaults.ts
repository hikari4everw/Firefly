// 显示设置面板的运行时默认值解析
//
// 解析优先级（后者被前者覆盖）：
//   1. display-defaults.json —— 通过设置面板「保存为默认」写入的覆盖项
//   2. 原配置文件（siteConfig / backgroundWallpaper / effectsConfig）—— 出厂值
//
// 运行时还有第三层 localStorage（用户的实时预览），那一层由 setting-utils.ts 处理。
// 本模块只负责「默认值」这一层，因此服务端渲染与客户端都能使用，保持同构。
//
// 设计要点：原配置文件始终保持出厂值不被改写，覆盖层只存「与出厂值不同」的差异项。
// 因此「恢复默认」只要清空覆盖文件即可，永远能回到出厂状态。

import { DEFAULT_THEME } from "@constants/constants";
import overridesJson from "@constants/display-defaults.json";
import { backgroundWallpaper, sakuraConfig, siteConfig } from "@/config";
import {
	DISPLAY_DEFAULT_SCHEMA,
	type DisplayDefaultKey,
	type RuntimeDisplaySettings,
} from "@/types/displayDefaults";

// 判断当前是否为移动端（与 setting-utils.ts 内联脚本的断点保持一致）
function isMobileViewport(): boolean {
	return typeof window === "undefined" ? false : window.innerWidth < 768;
}

// 把「布尔或分设备对象」形态的配置收敛成单一布尔值
// waves / gradient 的 enable 既可以是 boolean，也可以是 { desktop, mobile }
function resolveDeviceFlag(
	config: boolean | { desktop?: boolean; mobile?: boolean } | undefined,
	fallback: boolean,
): boolean {
	if (typeof config === "object") {
		return isMobileViewport()
			? (config.mobile ?? fallback)
			: (config.desktop ?? fallback);
	}
	return config ?? fallback;
}

// 出厂值：完全来自原配置文件，不含覆盖层
// 这是「恢复默认」的终点，也是判断某项是否属于差异项的基准
export function getFactoryDefaults(): Required<RuntimeDisplaySettings> {
	return {
		hue: siteConfig.themeColor.hue,
		// defaultMode 可选，未配置时回退到 DEFAULT_THEME（与 getDefaultTheme() 行为一致）
		theme: siteConfig.themeColor.defaultMode ?? DEFAULT_THEME,
		postListLayout: siteConfig.postListLayout.defaultMode || "list",
		cardBorderEnabled: siteConfig.card?.border ?? false,
		cardFollowThemeEnabled: siteConfig.card?.followTheme ?? false,
		wallpaperMode: backgroundWallpaper.mode,
		fullscreenLayout: backgroundWallpaper.fullscreen?.layout ?? "classic",
		overlayOpacity: backgroundWallpaper.overlay?.opacity ?? 0.8,
		overlayBlur: backgroundWallpaper.overlay?.blur ?? 0,
		overlayCardOpacity: backgroundWallpaper.overlay?.cardOpacity ?? 0.6,
		// 分设备开关的出厂值取当前设备，与原有 getDefault*() 行为一致
		wavesEnabled: resolveDeviceFlag(
			backgroundWallpaper.common?.waves?.enable,
			false,
		),
		gradientEnabled: resolveDeviceFlag(
			backgroundWallpaper.common?.gradient?.enable,
			true,
		),
		sakuraEnabled: sakuraConfig?.enable ?? false,
		bannerTitleEnabled: backgroundWallpaper.common?.homeText?.enable ?? true,
		bannerCarouselEnabled:
			backgroundWallpaper.common?.carousel?.enable ?? false,
	};
}

// 判断某个覆盖值是否合法：类型正确且落在允许范围内
// 读取与写入两侧共用 DISPLAY_DEFAULT_SCHEMA，避免规则漂移
function isValidOverrideValue(key: DisplayDefaultKey, value: unknown): boolean {
	const rule = DISPLAY_DEFAULT_SCHEMA[key];
	switch (rule.kind) {
		case "boolean":
			return typeof value === "boolean";
		case "number":
			return (
				typeof value === "number" &&
				Number.isFinite(value) &&
				value >= rule.min &&
				value <= rule.max
			);
		case "enum":
			return (
				typeof value === "string" &&
				(rule.values as readonly string[]).includes(value)
			);
		default:
			return false;
	}
}

// 规整任意来源的覆盖数据：丢弃未知键、类型错误与越界值
// 不抛错，保证配置文件被手工改坏时站点仍能正常回退出厂值
export function normalizeOverrides(input: unknown): RuntimeDisplaySettings {
	const result: RuntimeDisplaySettings = {};
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return result;
	}
	for (const key of Object.keys(
		DISPLAY_DEFAULT_SCHEMA,
	) as DisplayDefaultKey[]) {
		const value = (input as Record<string, unknown>)[key];
		if (value === undefined) continue;
		if (!isValidOverrideValue(key, value)) continue;
		// 逐键赋值以保留字面量类型，避免索引签名把值拓宽成联合类型
		switch (key) {
			case "hue":
				result.hue = value as number;
				break;
			case "theme":
				result.theme = value as RuntimeDisplaySettings["theme"];
				break;
			case "postListLayout":
				result.postListLayout =
					value as RuntimeDisplaySettings["postListLayout"];
				break;
			case "cardBorderEnabled":
				result.cardBorderEnabled = value as boolean;
				break;
			case "cardFollowThemeEnabled":
				result.cardFollowThemeEnabled = value as boolean;
				break;
			case "wallpaperMode":
				result.wallpaperMode = value as RuntimeDisplaySettings["wallpaperMode"];
				break;
			case "fullscreenLayout":
				result.fullscreenLayout =
					value as RuntimeDisplaySettings["fullscreenLayout"];
				break;
			case "overlayOpacity":
				result.overlayOpacity = value as number;
				break;
			case "overlayBlur":
				result.overlayBlur = value as number;
				break;
			case "overlayCardOpacity":
				result.overlayCardOpacity = value as number;
				break;
			case "wavesEnabled":
				result.wavesEnabled = value as boolean;
				break;
			case "gradientEnabled":
				result.gradientEnabled = value as boolean;
				break;
			case "sakuraEnabled":
				result.sakuraEnabled = value as boolean;
				break;
			case "bannerTitleEnabled":
				result.bannerTitleEnabled = value as boolean;
				break;
			case "bannerCarouselEnabled":
				result.bannerCarouselEnabled = value as boolean;
				break;
			default:
				break;
		}
	}
	return result;
}

// 当前生效的覆盖项（已规整）
export function readOverrides(): RuntimeDisplaySettings {
	return normalizeOverrides(overridesJson);
}

// 解析后的完整默认值：覆盖项优先，缺失的键回退出厂值
// 服务端渲染、内联脚本与设置面板都从这里取默认值，确保三处一致
export function resolveDisplayDefaults(): Required<RuntimeDisplaySettings> {
	return { ...getFactoryDefaults(), ...readOverrides() };
}

// 取单项解析后的默认值，供原有 getDefault*() 函数复用
export function resolveDisplayDefault<K extends DisplayDefaultKey>(
	key: K,
): NonNullable<RuntimeDisplaySettings[K]> {
	return resolveDisplayDefaults()[key];
}

// 只取覆盖层里显式保存的值，没有则返回 undefined
// 用于分设备开关（waves / gradient）：这类默认值要先让覆盖值优先，
// 未保存时再由调用方按当前设备从配置里解析，因此不能直接用带出厂回退的
// resolveDisplayDefault()（那样会让分设备的判断永远得不到执行）
export function getOverrideValue<K extends DisplayDefaultKey>(
	key: K,
): RuntimeDisplaySettings[K] {
	return readOverrides()[key];
}

// 保存时剪枝：剔除「与出厂值相同」的项，只保留真正的差异
// 这样手工把某项改回默认再保存，该键会自动从文件里消失，覆盖文件始终最小
export function pickOverrides(
	input: RuntimeDisplaySettings,
): RuntimeDisplaySettings {
	const factory = getFactoryDefaults();
	const normalized = normalizeOverrides(input);
	const result: RuntimeDisplaySettings = {};
	for (const key of Object.keys(normalized) as DisplayDefaultKey[]) {
		if (normalized[key] === factory[key]) continue;
		switch (key) {
			case "hue":
				result.hue = normalized.hue;
				break;
			case "theme":
				result.theme = normalized.theme;
				break;
			case "postListLayout":
				result.postListLayout = normalized.postListLayout;
				break;
			case "cardBorderEnabled":
				result.cardBorderEnabled = normalized.cardBorderEnabled;
				break;
			case "cardFollowThemeEnabled":
				result.cardFollowThemeEnabled = normalized.cardFollowThemeEnabled;
				break;
			case "wallpaperMode":
				result.wallpaperMode = normalized.wallpaperMode;
				break;
			case "fullscreenLayout":
				result.fullscreenLayout = normalized.fullscreenLayout;
				break;
			case "overlayOpacity":
				result.overlayOpacity = normalized.overlayOpacity;
				break;
			case "overlayBlur":
				result.overlayBlur = normalized.overlayBlur;
				break;
			case "overlayCardOpacity":
				result.overlayCardOpacity = normalized.overlayCardOpacity;
				break;
			case "wavesEnabled":
				result.wavesEnabled = normalized.wavesEnabled;
				break;
			case "gradientEnabled":
				result.gradientEnabled = normalized.gradientEnabled;
				break;
			case "sakuraEnabled":
				result.sakuraEnabled = normalized.sakuraEnabled;
				break;
			case "bannerTitleEnabled":
				result.bannerTitleEnabled = normalized.bannerTitleEnabled;
				break;
			case "bannerCarouselEnabled":
				result.bannerCarouselEnabled = normalized.bannerCarouselEnabled;
				break;
			default:
				break;
		}
	}
	return result;
}
