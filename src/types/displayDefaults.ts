// 显示设置面板「保存为默认」的覆盖层类型定义
//
// 这里的 15 个键是显示设置面板中「运行时可调」的参数，与 localStorage 的键一一对应。
// 它们和 displaySettingsConfig.ts 里的 *Switchable 开关是两回事：
//   - 本文件描述的是「用户能调的值」，可在运行时修改并写回 display-defaults.json
//   - displaySettingsConfig.ts 描述的是「面板显示哪些控件」，属于编译期配置，不可运行时修改
//
// 解析优先级：localStorage（实时预览）→ display-defaults.json（已保存覆盖）→ 原配置文件（出厂值）
// 原配置文件始终是可靠的出厂值，本覆盖层只存「与出厂值不同」的差异项。

import type {
	FullscreenWallpaperLayout,
	LIGHT_DARK_MODE,
	WALLPAPER_MODE,
} from "@/types/config";

// 主题模式，取值与 constants.ts 的 LIGHT_MODE / DARK_MODE / SYSTEM_MODE 一致
// 直接复用 LIGHT_DARK_MODE，与 siteConfig.themeColor.defaultMode 的类型保持同源
export type DisplayDefaultTheme = LIGHT_DARK_MODE;

// 文章列表布局模式，与 siteConfig.postListLayout.defaultMode 取值一致
export type DisplayDefaultListLayout = "list" | "grid";

// 单键的值类型表。作为 RuntimeDisplaySettings 与校验规则的唯一事实来源，
// 新增可覆盖项时只需在这里加一行，类型、键名列表、校验规则会同步生效。
export type DisplayDefaultValue = {
	hue: number;
	theme: DisplayDefaultTheme;
	postListLayout: DisplayDefaultListLayout;
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

// 所有可覆盖键的联合类型，即 DisplayDefaultValue 的键名
export type DisplayDefaultKey = keyof DisplayDefaultValue;

// 覆盖层文件的结构：任意子集，未出现的键表示「使用出厂值」
export type RuntimeDisplaySettings = Partial<DisplayDefaultValue>;

// 数值范围约束，读取与写入两侧共用，避免两处规则漂移
export type DisplayDefaultNumberRange = {
	min: number;
	max: number;
};

// 单键的校验规则
export type DisplayDefaultRule =
	| { kind: "number"; min: number; max: number }
	| { kind: "boolean" }
	| { kind: "enum"; values: readonly string[] };

// 键 → 校验规则映射
export type DisplayDefaultSchema = {
	[K in DisplayDefaultKey]: DisplayDefaultRule;
};

// 覆盖层文件的校验规则表
// 读取时用于剔除非法值，写入接口用同一张表校验请求体
// 显式标注类型是为了满足 --isolatedDeclarations（项目的 type-check 要求）
export const DISPLAY_DEFAULT_SCHEMA: DisplayDefaultSchema = {
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

// 运行时可覆盖键的列表，由校验规则表派生，保证两者永不脱节
// 用于「恢复默认」时按白名单清除 localStorage，避免误清其他数据
export const DISPLAY_DEFAULT_KEYS = Object.keys(
	DISPLAY_DEFAULT_SCHEMA,
) as DisplayDefaultKey[];
