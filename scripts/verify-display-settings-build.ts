// 构建后验证：node --import tsx scripts/verify-display-settings-build.ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile("dist/index.html", "utf8");

await test("生产面板提供三个个人设置标签和恢复默认，不输出本地管理功能", () => {
	assert.match(html, /id=["']display-settings-switch["']/);
	assert.match(html, /id=["']display-setting["']/);
	assert.match(html, /外观/);
	assert.match(html, /壁纸/);
	assert.match(html, /特效/);
	assert.match(html, /恢复站点默认/);
	assert.match(html, /id=["']scheme-switch["']/);
	assert.doesNotMatch(
		html,
		/页面调试|保存当前样式|恢复出厂设置|data-page-debug/,
	);
});

await test("实际首屏脚本保留个人偏好，新浏览器使用发布默认值", () => {
	const script = html.match(
		/<script\b[^>]*\bid=["']appearance-init["'][^>]*>([\s\S]*?)<\/script>/,
	)?.[1];
	assert.ok(script);
	const initialize = (storage: Map<string, string>) => {
		const attributes = new Map<string, string>([
			["data-waves-enabled", "true"],
			["data-gradient-enabled", "true"],
			["data-banner-title-enabled", "true"],
			["data-sakura-enabled", "true"],
		]);
		const styles = new Map<string, string>();
		runInNewContext(script, {
			localStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				removeItem: (key: string) => storage.delete(key),
			},
			document: {
				readyState: "loading",
				documentElement: {
					getAttribute: (key: string) => attributes.get(key) ?? null,
					setAttribute: (key: string, value: string) =>
						attributes.set(key, value),
					classList: { add() {}, remove() {} },
					style: {
						setProperty: (key: string, value: string) => styles.set(key, value),
					},
				},
			},
			window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
		});
		return { attributes, styles };
	};
	const published = initialize(new Map());
	const storage = new Map([
		["wallpaperMode", "none"],
		["fullscreenLayout", "classic"],
		["hue", "47"],
		["wavesEnabled", "false"],
		["gradientEnabled", "false"],
		["bannerTitleEnabled", "false"],
		["sakuraEnabled", "false"],
		["theme", "dark"],
		["comment-draft", "保留评论"],
		["music-volume", "0.5"],
	]);
	const before = [...storage.entries()];
	for (let visit = 0; visit < 2; visit++) {
		const personal = initialize(storage);
		assert.equal(personal.attributes.get("data-wallpaper-mode"), "none");
		assert.equal(personal.attributes.get("data-fullscreen-layout"), "classic");
		assert.equal(personal.attributes.get("data-waves-enabled"), "false");
		assert.equal(personal.attributes.get("data-gradient-enabled"), "false");
		assert.equal(personal.attributes.get("data-sakura-enabled"), "false");
		assert.equal(personal.styles.get("--hue"), "47");
		assert.deepEqual([...storage.entries()], before);
	}
	assert.notEqual(published.attributes.get("data-wallpaper-mode"), "none");
	assert.notEqual(published.styles.get("--hue"), "47");
});

await test("全部生产页面开放个人面板，同时排除本地管理功能", async () => {
	const files = await readdir("dist", { recursive: true });
	for (const file of files.filter(
		(name) => name.endsWith(".html") && name !== "404.html",
	)) {
		const page = await readFile(`dist/${file}`, "utf8");
		assert.doesNotMatch(page, /页面调试|保存当前样式|恢复出厂设置|data-page-debug|display-settings-cache-reset/, file);
		// 重定向与嵌入评论页没有导航栏，沿用现有精简布局。
		if (!/id=["']navbar["']/.test(page)) continue;
		assert.match(page, /id=["']display-settings-switch["']/, file);
		assert.match(page, /id=["']display-setting["']/, file);
		assert.doesNotMatch(
			page,
			/页面调试|保存当前样式|恢复出厂设置|data-page-debug|display-settings-cache-reset/,
			file,
		);
	}
});
