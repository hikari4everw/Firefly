// display-defaults.json 的模块类型声明
//
// 为什么需要这个文件：本文件初始内容是空对象 {}，TypeScript 会把 JSON 推断成 {}，
// 于是读取 overrides.hue 这类访问会报 TS2339（属性不存在）。
// 显式声明成 RuntimeDisplaySettings 后，各字段都是可选属性，读写都安全。
//
// 该文件由显示设置面板的「保存为默认」按钮通过开发环境接口写入，
// 内容只包含「与出厂值不同」的差异项；原配置文件（siteConfig.ts /
// backgroundWallpaper.ts / effectsConfig.ts）始终保持出厂值不变。

declare module "@/constants/display-defaults.json" {
	import type { RuntimeDisplaySettings } from "@/types/displayDefaults";

	const overrides: RuntimeDisplaySettings;
	export default overrides;
}
