// 显示设置面板「保存当前样式」用到的类型与校验规则
//
// 这里的 15 个键是显示设置面板中「运行时可调」的参数，与 localStorage 的键一一对应。
// 它们和 displaySettingsConfig.ts 里的 *Switchable 开关是两回事：
//   - 本文件描述的是「用户能调的值」，可在运行时修改并写回 saved-display-settings.json
//   - displaySettingsConfig.ts 描述的是「面板显示哪些控件」，属于编译期配置，不可运行时修改
//
// 术语约定：
//   - 保存的样式：你在面板上点「保存当前样式」写入 saved-display-settings.json 的值
//   - 出厂值：siteConfig.ts / backgroundWallpaper.ts / effectsConfig.ts 里的原始配置值
//   - 默认值：运行时按 localStorage → 保存的样式 → 出厂值 解析后的生效值
//
// 保存的样式只存「与出厂值不同」的差异项，因此「恢复出厂设置」只要清空该文件即可，
// 原配置文件永远不会被改写，出厂值始终可靠。

import type {
	FullscreenWallpaperLayout,
	LIGHT_DARK_MODE,
	WALLPAPER_MODE,
} from "@/types/config";

// 主题模式，取值与 constants.ts 的 LIGHT_MODE / DARK_MODE / SYSTEM_MODE 一致
// 直接复用 LIGHT_DARK_MODE，与 siteConfig.themeColor.defaultMode 的类型保持同源
export type DisplayTheme = LIGHT_DARK_MODE;

// 文章列表布局模式，与 siteConfig.postListLayout.defaultMode 取值一致
export type DisplayListLayout = "list" | "grid";

// 单键的值类型表。作为 RuntimeDisplaySettings 与校验规则的唯一事实来源，
// 新增可保存项时只需在这里加一行，类型、键名列表、校验规则会同步生效。
export type DisplaySettingValue = {
	hue: number;
	theme: DisplayTheme;
	postListLayout: DisplayListLayout;
	cardBorderEnabled: boolean;
	cardFollowThemeEnabled: boolean;
	wallpaperMode: WALLPAPER_MODE;
	fullscreenLayout: FullscreenWallpaperLayout;
	overlayOpacity: number;
	overlayBlur: number;
	overlayCardOpacity: number;
	wavesEnabled: boolean;
	gradientEnabled: boolean;
	sakuraEnabled: boolean;
	bannerTitleEnabled: boolean;
	bannerCarouselEnabled: boolean;
};

// 所有可保存键的联合类型，即 DisplaySettingValue 的键名
export type DisplaySettingKey = keyof DisplaySettingValue;

// 保存的样式文件结构：任意子集，未出现的键表示「使用出厂值」
export type RuntimeDisplaySettings = Partial<DisplaySettingValue>;

// 数值范围约束，读取与写入两侧共用，避免两处规则漂移
export type DisplaySettingNumberRange = {
	min: number;
	max: number;
};

// 单键的校验规则
export type DisplaySettingRule =
	| { kind: "number"; min: number; max: number }
	| { kind: "boolean" }
	| { kind: "enum"; values: readonly string[] };

// 键 → 校验规则映射
export type DisplaySettingSchema = {
	[K in DisplaySettingKey]: DisplaySettingRule;
};

// 保存的样式文件的校验规则表
// 读取时用于剔除非法值，写入接口用同一张表校验请求体
// 显式标注类型是为了满足 --isolatedDeclarations（项目的 type-check 要求）
export const SAVED_SETTINGS_SCHEMA: DisplaySettingSchema = {
	hue: { kind: "number", min: 0, max: 360 },
	theme: { kind: "enum", values: ["light", "dark", "system"] },
	postListLayout: { kind: "enum", values: ["list", "grid"] },
	cardBorderEnabled: { kind: "boolean" },
	cardFollowThemeEnabled: { kind: "boolean" },
	wallpaperMode: {
		kind: "enum",
		values: ["banner", "fullscreen", "overlay", "none"],
	},
	fullscreenLayout: { kind: "enum", values: ["classic", "hero"] },
	overlayOpacity: { kind: "number", min: 0, max: 1 },
	overlayBlur: { kind: "number", min: 0, max: 20 },
	overlayCardOpacity: { kind: "number", min: 0, max: 1 },
	wavesEnabled: { kind: "boolean" },
	gradientEnabled: { kind: "boolean" },
	sakuraEnabled: { kind: "boolean" },
	bannerTitleEnabled: { kind: "boolean" },
	bannerCarouselEnabled: { kind: "boolean" },
};

// 可保存键的列表，由校验规则表派生，保证两者永不脱节
// 用于「恢复出厂设置」时按白名单清除 localStorage，避免误清其他数据
export const SAVED_SETTINGS_KEYS = Object.keys(
	SAVED_SETTINGS_SCHEMA,
) as DisplaySettingKey[];
