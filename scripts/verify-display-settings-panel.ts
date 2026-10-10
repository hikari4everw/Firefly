// 编译真实面板，验证默认关闭的标题仍可调整，以及开发权限的 SSR 输出。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { build } from "esbuild";
import { compile } from "svelte/compiler";

const result = await build({
	stdin: {
		contents: `
			import { render } from 'svelte/server';
			import Panel from './src/components/controls/DisplaySettingsIntegrated.svelte';
			import { backgroundWallpaper, displaySettingsConfig } from './src/config';
			import saved from './src/constants/saved-display-settings.json';
			backgroundWallpaper.common.homeText.enable = false;
			displaySettingsConfig.bannerTitleSwitchable = true;
			delete saved.bannerTitleEnabled;
			saved.wallpaperMode = 'banner';
			export const personal = render(Panel, { props: { allowSiteEditing: false } }).body;
			export const local = render(Panel, { props: { allowSiteEditing: true } }).body;
		`,
		resolveDir: process.cwd(),
		loader: "ts",
	},
	bundle: true,
	write: false,
	platform: "node",
	conditions: ["svelte"],
	alias: {
		"@iconify/svelte/offline": path.resolve(
			"node_modules/@iconify/svelte/dist/OfflineIcon.svelte",
		),
	},
	format: "esm",
	define: { "import.meta.env": JSON.stringify({ DEV: false }) },
	plugins: [
		{
			name: "svelte-server",
			setup(builder) {
				builder.onLoad({ filter: /\.svelte$/ }, async ({ path: filename }) => {
					let source = await readFile(filename, "utf8");
					// SSR 不执行点击：固定测试在壁纸标签，其他组件逻辑保持原样。
					if (filename.endsWith("DisplaySettingsIntegrated.svelte")) {
						source = source.replace(
							'let activeTab = $state<TabKey>("appearance")',
							'let activeTab = $state<TabKey>("wallpaper")',
						);
					}
					return {
						contents: compile(source, {
							filename,
							generate: "server",
						}).js.code,
						loader: "js",
						resolveDir: path.dirname(filename),
					};
				});
			},
		},
	],
});
const { personal, local } = await import(
	`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);

await test("出厂关闭标题时仍输出访客标题开关", () => {
	assert.ok(personal.includes("首页壁纸标题"));
});
await test("Astro 传入的权限决定管理按钮输出", () => {
	assert.doesNotMatch(personal, /页面调试|保存当前样式|恢复出厂设置/);
	assert.match(local, /页面调试/);
	assert.match(local, /保存当前样式/);
	assert.match(local, /恢复出厂设置/);
});
