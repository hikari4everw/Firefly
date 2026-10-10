import assert from "node:assert/strict";
import { test } from "node:test";
import { SAVED_SETTINGS_KEYS } from "../types/savedDisplaySettings";
import { clearStoredDisplaySettings } from "./setting-utils";

test("恢复个人外观默认仅清理外观偏好，保留主题和无关数据", () => {
	const stored = new Map<string, string>(
		SAVED_SETTINGS_KEYS.map((key) => [key, "custom"]),
	);
	stored.set("theme", "dark");
	stored.set("comment-draft", "评论");
	stored.set("music-volume", "0.7");
	stored.set("firefly-ui-visibility-preview", "本地调试草稿");
	const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	try {
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: { removeItem: (key: string) => stored.delete(key) },
		});
		clearStoredDisplaySettings({ preserveTheme: true });
		assert.deepEqual(
			[...stored.entries()],
			[
				["theme", "dark"],
				["comment-draft", "评论"],
				["music-volume", "0.7"],
				["firefly-ui-visibility-preview", "本地调试草稿"],
			],
		);
		clearStoredDisplaySettings();
		assert.equal(stored.has("theme"), false);
		assert.equal(stored.get("comment-draft"), "评论");
	} finally {
		if (original) Object.defineProperty(globalThis, "localStorage", original);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
