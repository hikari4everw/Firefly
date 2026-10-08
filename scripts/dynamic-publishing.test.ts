import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as dynamicUtils from "../src/utils/dynamic-utils";

test("旧动态省略 draft 时默认发布，显式草稿保留状态", async () => {
	const hooks = registerHooks({
		resolve(specifier, context, nextResolve) {
			return nextResolve(
				specifier === "astro:content"
					? new URL("../node_modules/astro/dist/content/config.js", import.meta.url).href
					: specifier,
				context,
			);
		},
	});
	try {
		const { collections } = await import("../src/content.config");
		const schema = collections.dynamic.schema;
		assert.ok(schema && typeof schema !== "function");
		const published = new Date("2026-10-08T00:00:00Z");
		assert.deepEqual(schema.parse({ published }), {
			published, draft: false, pinned: false, location: "",
		});
		assert.equal(Reflect.get(schema.parse({ published, draft: true }), "draft"), true);
	} finally {
		hooks.deregister();
	}
});

test("生产动态列表过滤草稿，开发列表保留草稿和旧动态", () => {
	assert.equal(typeof dynamicUtils.isDynamicPublished, "function");
	const entries = [
		{ id: "legacy", data: {} },
		{ id: "published", data: { draft: false } },
		{ id: "draft", data: { draft: true } },
	];
	assert.deepEqual(entries.filter((entry) => dynamicUtils.isDynamicPublished(entry, true)).map((entry) => entry.id), ["legacy", "published"]);
	assert.deepEqual(entries.filter((entry) => dynamicUtils.isDynamicPublished(entry, false)).map((entry) => entry.id), ["legacy", "published", "draft"]);
});

test("笔记相对图片映射到网站 public 路径，保留编码和站点子目录", () => {
	assert.equal(typeof dynamicUtils.resolveDynamicImageSrc, "function");
	const cases = [
		["../../../public/assets/dynamic/20261008/uuid.webp", "src/content/dynamic/20261008.md", "/", "/assets/dynamic/20261008/uuid.webp"],
		["../../../../public/assets/dynamic/20261008/%E6%B5%8B%E8%AF%95%20image.webp?width=800#photo", "src/content/dynamic/archive/20261008.md", "/blog/", "/blog/assets/dynamic/20261008/%E6%B5%8B%E8%AF%95%20image.webp?width=800#photo"],
		["../../../public/assets/dynamic/20261008/中文.webp", "/repo/Firefly/src/content/dynamic/20261008.md", "/blog", "/blog/assets/dynamic/20261008/%E4%B8%AD%E6%96%87.webp"],
		["https://example.com/a%20b.webp", "src/content/dynamic/a.md", "/blog/", "https://example.com/a%20b.webp"],
		["//example.com/image.webp", "src/content/dynamic/a.md", "/blog/", "//example.com/image.webp"],
		["/assets/dynamic/old.webp", "src/content/dynamic/a.md", "/blog/", "/assets/dynamic/old.webp"],
		["./unrelated.webp", "src/content/dynamic/a.md", "/", "./unrelated.webp"],
	];
	for (const [src, filePath, baseUrl, expected] of cases) {
		assert.equal(dynamicUtils.resolveDynamicImageSrc(src, filePath, baseUrl), expected);
	}
});
