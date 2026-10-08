import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { sidebarLayoutConfig } from "@/config/sidebarConfig";
import { getUiLinkAttributes } from "./ui-link-attributes";
import {
	getUiStyleCss,
	getWidgetVisibilityId,
	mergeUiVisibility,
	UI_VISIBILITY_TARGETS,
	validateUiVisibility,
} from "./ui-visibility";

async function loadVisibilityForEnvironment(dev: boolean) {
	const result = await build({
		entryPoints: ["src/utils/ui-visibility.ts"],
		bundle: true,
		write: false,
		platform: "node",
		format: "esm",
		define: { "import.meta.env": JSON.stringify({ DEV: dev, PROD: !dev }) },
		plugins: [
			{
				name: "saved-visibility-fixture",
				setup(builder) {
					builder.onLoad({ filter: /saved-ui-visibility\.json$/ }, () => ({
						loader: "json",
						contents: JSON.stringify({
							hiddenTargets: ["search"],
							overrides: {},
						}),
					}));
				},
			},
		],
	});
	return import(
		`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
	) as Promise<typeof import("./ui-visibility")>;
}

test("隐藏配置只在生产生效，本地保留板块和隐藏勾选状态", async () => {
	for (const dev of [true, false]) {
		const visibility = await loadVisibilityForEnvironment(dev);
		assert.deepEqual(visibility.getSavedUiVisibility().hiddenTargets, [
			"search",
		]);
		assert.equal(visibility.isUiTargetHidden("search"), !dev);
		assert.equal(visibility.isUiTargetHidden("footer"), false);
		if (dev) assert.equal(visibility.getUiVisibilityCss(), "");
		else
			assert.match(visibility.getUiVisibilityCss(), /display: none !important/);
		// 隐藏规则不影响本地的样式预览。
		assert.match(
			visibility.getUiStyleCss({
				hiddenTargets: ["search"],
				overrides: { "home-title": { style: { fontSize: 42 } } },
			}),
			/font-size:42px/,
		);
	}
});

test("本地草稿隐藏不影响布局判断，生产读取页面的隐藏状态", async () => {
	const originalDocument = Object.getOwnPropertyDescriptor(
		globalThis,
		"document",
	);
	try {
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: { documentElement: { getAttribute: () => "footer" } },
		});
		for (const dev of [true, false]) {
			const visibility = await loadVisibilityForEnvironment(dev);
			assert.equal(visibility.isUiTargetHidden("footer"), !dev);
			assert.equal(visibility.isUiTargetHidden("search"), false);
		}
	} finally {
		if (originalDocument)
			Object.defineProperty(globalThis, "document", originalDocument);
		else Reflect.deleteProperty(globalThis, "document");
	}
});

test("目标清单保持唯一，重复广告可独立隐藏", () => {
	assert.equal(
		new Set(UI_VISIBILITY_TARGETS.map((item) => item.id)).size,
		UI_VISIBILITY_TARGETS.length,
	);
	const ads = sidebarLayoutConfig.rightComponents.filter(
		(item) => item.type === "advertisement",
	);
	assert.equal(
		new Set(ads.map((item) => getWidgetVisibilityId("right", item))).size,
		ads.length,
	);
});

test("接受合法配置并去重，不修改原输入", () => {
	const input = { hiddenTargets: ["home-title", "search", "home-title"] };
	assert.deepEqual(validateUiVisibility(input), {
		hiddenTargets: ["home-title", "search"],
		overrides: {},
	});
	assert.equal(input.hiddenTargets.length, 3);
	assert.deepEqual(validateUiVisibility({ hiddenTargets: [] }), {
		hiddenTargets: [],
		overrides: {},
	});
});

test("兼容旧配置并接受目标允许的内容与样式", () => {
	const input = {
		hiddenTargets: [],
		overrides: {
			"home-title": {
				style: { fontSize: 42, color: "#abc" },
				content: { text: "新标题" },
			},
		},
	};
	assert.deepEqual(validateUiVisibility(input), input);
	assert.deepEqual(validateUiVisibility({ hiddenTargets: [] }), {
		hiddenTargets: [],
		overrides: {},
	});
	assert.ok(
		UI_VISIBILITY_TARGETS.every(
			(target) =>
				Array.isArray(target.styleFields) &&
				Array.isArray(target.contentFields),
		),
	);
});

test("三个草稿只保存选中两个，其他磁盘值保留", () => {
	const current = {
		hiddenTargets: ["footer"],
		overrides: { footer: { content: { note: "已保存" } } },
	};
	const draft = {
		hiddenTargets: ["home-title"],
		overrides: {
			"home-title": { content: { text: "新标题" } },
			"home-subtitle": { content: { subtitles: ["第一句", "第二句"] } },
			footer: { content: { note: "未选中" } },
		},
	};
	assert.deepEqual(
		mergeUiVisibility(current, draft, ["home-title", "home-subtitle"]),
		{
			hiddenTargets: ["footer", "home-title"],
			overrides: {
				footer: { content: { note: "已保存" } },
				"home-title": { content: { text: "新标题" } },
				"home-subtitle": { content: { subtitles: ["第一句", "第二句"] } },
			},
		},
	);
	assert.equal(current.overrides.footer.content.note, "已保存");
});

test("选中恢复默认删除覆盖；空选择与未知选择拒绝保存", () => {
	assert.deepEqual(
		mergeUiVisibility(
			{
				hiddenTargets: ["home-title"],
				overrides: { "home-title": { style: { fontSize: 40 } } },
			},
			{ hiddenTargets: [], overrides: {} },
			["home-title"],
		),
		{ hiddenTargets: [], overrides: {} },
	);
	for (const selection of [[], ["unknown"], [1]])
		assert.throws(() =>
			mergeUiVisibility(
				{ hiddenTargets: [] },
				{ hiddenTargets: [] },
				selection as string[],
			),
		);
});

test("拒绝未知字段、危险链接、不存在前缀、越界样式与非法内容类型", () => {
	for (const override of [
		{ style: { display: "none" } },
		{ style: { fontSize: 129 } },
		{ style: { lineHeight: 0.7 } },
		{ style: { color: "red;display:none" } },
		{ style: { fontWeight: 450 } },
		{ style: { opacity: 101 } },
		{ content: { text: 123 } },
		{ content: { unknown: "x" } },
		{ unknown: {} },
	])
		assert.throws(() =>
			validateUiVisibility({
				hiddenTargets: [],
				overrides: { "home-title": override },
			}),
		);
	const link = UI_VISIBILITY_TARGETS.find((target) =>
		target.id.startsWith("home-link-"),
	);
	assert.ok(link);
	for (const url of [
		"javascript:alert(1)",
		"about/",
		"tel:+123",
		"data:text/html,<svg>",
		"//evil.example",
		"https://",
		"\\evil.example",
		" java\nscript:alert(1)",
	]) {
		assert.throws(() =>
			validateUiVisibility({
				hiddenTargets: [],
				overrides: { [link.id]: { content: { url } } },
			}),
		);
	}
	assert.throws(() =>
		validateUiVisibility({
			hiddenTargets: [],
			overrides: { [link.id]: { content: { icon: "unknown:github" } } },
		}),
	);
	assert.throws(() =>
		validateUiVisibility(
			{
				hiddenTargets: [],
				overrides: {
					[link.id]: { content: { icon: "fa7-brands:no-such-icon" } },
				},
			},
			() => false,
		),
	);
	assert.throws(() =>
		validateUiVisibility({
			hiddenTargets: [],
			overrides: { search: { content: { name: "名称" } } },
		}),
	);
});

test("样式精确命中实际文字和卡片，透明度只作用背景且不改交互层级", () => {
	const css = getUiStyleCss({
		hiddenTargets: [],
		overrides: {
			"home-title": { style: { fontSize: 42, marginTop: -10 } },
			"sidebar-left-profile": {
				style: {
					backgroundColor: "#abc",
					backgroundOpacity: 20,
					paddingX: 8,
					color: "#123456",
				},
			},
			"navbar-theme": { style: { iconSize: 28 } },
		},
	});
	assert.match(css, /font-size:42px !important/);
	assert.match(css, /margin-top:-10px !important/);
	assert.match(css, /\.card-base/);
	assert.match(css, /background-color:color-mix/);
	assert.match(css, /data-ui-field="name"/);
	assert.doesNotMatch(
		css,
		/display:|pointer-events:|z-index:|#theme-mode-panel/,
	);
});

test("拒绝未知目标、非法类型和混入外观设置", () => {
	for (const input of [
		null,
		[],
		{},
		{ hiddenTargets: "search" },
		{ hiddenTargets: [1] },
		{ hiddenTargets: ["display-settings-switch"] },
		{ hiddenTargets: ["search"], theme: "dark" },
	]) {
		assert.throws(() => validateUiVisibility(input));
	}
});

test("链接维持锚点、外链和邮箱编码行为，协议大小写一致", () => {
	assert.equal(
		getUiLinkAttributes("test", "#section", "锚点").href,
		"#section",
	);
	const external = getUiLinkAttributes(
		"test",
		"HTTPS://example.com/path",
		"外链",
	);
	assert.equal(external.href, "https://example.com/path");
	assert.equal(external.target, "_blank");
	const email = getUiLinkAttributes(
		"test",
		"MAILTO:author@example.com",
		"邮箱",
	);
	assert.equal(email.href, "#");
	assert.equal(
		Buffer.from(email["data-encoded-email"] || "", "base64").toString(),
		"author@example.com",
	);
	assert.ok(email.onclick);
});
