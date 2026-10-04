// 构建后验证：node --import tsx scripts/verify-display-settings-build.ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = await readFile("dist/index.html", "utf8");

await test("生产首页不输出外观入口和面板，保留亮暗色按钮", () => {
	assert.doesNotMatch(html, /id=["']display-settings-switch["']/);
	assert.doesNotMatch(html, /id=["']display-setting["']/);
	assert.match(html, /id=["']scheme-switch["']/);
});

await test("生产启动清理旧外观偏好，保留主题及无关数据", () => {
	const script = html.match(
		/<script\b[^>]*\bid=["']display-settings-cache-reset["'][^>]*>([\s\S]*?)<\/script>/,
	)?.[1];
	assert.ok(script, "生产页面应包含首屏缓存迁移脚本");
	const appearanceKeys = [
		"hue",
		"postListLayout",
		"cardBorderEnabled",
		"cardFollowThemeEnabled",
		"wallpaperMode",
		"fullscreenLayout",
		"overlayOpacity",
		"overlayBlur",
		"overlayCardOpacity",
		"wavesEnabled",
		"gradientEnabled",
		"sakuraEnabled",
		"bannerTitleEnabled",
		"bannerCarouselEnabled",
	];
	const storage = new Map(appearanceKeys.map((key) => [key, "old-value"]));
	storage.set("theme", "dark");
	storage.set("comment-draft", "保留评论");
	storage.set("music-volume", "0.5");
	runInNewContext(script, {
		localStorage: { removeItem: (key: string) => storage.delete(key) },
	});
	assert.deepEqual(
		[...storage.entries()],
		[
			["theme", "dark"],
			["comment-draft", "保留评论"],
			["music-volume", "0.5"],
		],
	);
});

await test("全部生产页面不输出外观面板", async () => {
	const files = await readdir("dist", { recursive: true });
	for (const file of files.filter((name) => name.endsWith(".html"))) {
		const page = await readFile(`dist/${file}`, "utf8");
		assert.doesNotMatch(page, /id=["']display-settings-switch["']/, file);
		assert.doesNotMatch(page, /id=["']display-setting["']/, file);
	}
});
