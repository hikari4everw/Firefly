import { setMaxListeners } from "node:events";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { pluginLanguageLogo } from "ec-lang-logo"; /* Language Logo */
import { pluginCollapsible } from "expressive-code-collapsible"; /* Collapsible */
import { pluginLanguageBadge } from "expressive-code-language-badge"; /* Language Badge */
import katex from "katex";
import "katex/dist/contrib/mhchem.mjs"; // 加载 mhchem 扩展
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeCallouts from "rehype-callouts";
import rehypeCodeGroup from "rehype-code-group"; /* Tab 代码块 */
import rehypeComponents from "rehype-components"; /* Render the custom directive content */
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkAdmonitionToBlockquoteCallout from "remark-admonition-to-blockquote-callout";
import remarkDirective from "remark-directive"; /* Handle directives */
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";
import {
	commentConfig,
	dynamicConfig,
	expressiveCodeConfig,
	fontConfig,
	fontsList,
	mermaidConfig,
	plantumlConfig,
	siteConfig,
} from "./src/config";
import I18nKey from "./src/i18n/i18nKey";
import { i18n } from "./src/i18n/translation";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { rehypeDiagramPanZoom } from "./src/plugins/rehype-diagram-panzoom.mjs";
import rehypeEmailProtection from "./src/plugins/rehype-email-protection.mjs";
import rehypeExternalLinks from "./src/plugins/rehype-external-links.mjs";
import rehypeFigure from "./src/plugins/rehype-figure.mjs";
import rehypeImageReferrerPolicy from "./src/plugins/rehype-image-referrerpolicy.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { rehypePlantuml } from "./src/plugins/rehype-plantuml.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js";
import { remarkImageGrid } from "./src/plugins/remark-image-grid.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
import { remarkPlantuml } from "./src/plugins/remark-plantuml.js";
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";
import { remarkWikiLink } from "./src/plugins/remark-wiki-link.js";
import { DISPLAY_DEFAULT_SCHEMA } from "./src/types/displayDefaults.ts";
import {
	normalizeOverrides,
	pickOverrides,
} from "./src/utils/display-defaults.ts";
import { collectUsedFontCssVars } from "./src/utils/fontHelper";

if (process.env.NODE_ENV === "development") {
	setMaxListeners(20);
}

// 开发服务器上，显示设置面板的「保存为默认」需要一个能写文件的接口。
// 该接口以 Vite 中间件形式提供（见下方 displayDefaultsDevApi），
// 它只在开发服务器存在，完全不参与构建，因此 pnpm build 依旧是纯静态输出。
const adapter = process.env.CF_WORKERS
	? cloudflare({
			prerenderEnvironment: "node",
		})
	: undefined;

// 开发专用的显示设置写入接口。
//
// 为什么放在 Vite 中间件而不是 Astro API 路由：
//   Astro 开发服务器对预渲染路由会剥离请求上下文（POST 请求体为空、查询参数不传入），
//   因此 API 路由写法拿不到要保存的数据；而按需渲染路由又要求存在服务端适配器，
//   会给纯静态站点引入 dist/client + dist/server 的双目录产物。
//   Vite 的 configureServer 中间件在 Astro 路由之前执行，能直接读到 Node 原始请求，
//   既拿得到 POST 请求体，又完全不参与构建 —— pnpm build 依旧是纯静态输出。
//
// 该中间件只在 `pnpm dev` 期间存在（apply: "serve"），生产环境不存在任何写入能力。
const DISPLAY_DEFAULTS_ENDPOINT = "/api/display-defaults.json";

// 覆盖层文件（站点源码内，不在 dist）
const DISPLAY_DEFAULTS_FILE = path.join(
	process.cwd(),
	"src",
	"constants",
	"display-defaults.json",
);

// 直接从磁盘读取覆盖层文件。
//
// 为什么不用 display-defaults.ts 的 readOverrides()：
//   那个函数读的是 import 进来的 JSON 模块，模块在进程内只求值一次并被缓存。
//   开发服务器启动后再写文件，缓存不会失效，GET 就会一直返回旧值
//   （正是调试中发现的「写成功但 GET 仍为空」现象）。
//   读取路径走 fs 才能反映磁盘上的真实内容。
async function readOverridesFromDisk() {
	try {
		const raw = await readFile(DISPLAY_DEFAULTS_FILE, "utf8");
		return normalizeOverrides(JSON.parse(raw));
	} catch {
		// 文件缺失或内容损坏时回退为空覆盖（等价于全部使用出厂值）
		return {};
	}
}

// 校验请求体并剪枝写盘。与页面侧共用同一套 schema 与剪枝逻辑，
// 保证「保存为默认」的语义（只存与出厂值不同的项）在两侧完全一致。
async function saveDisplayDefaults(payload) {
	if (
		typeof payload !== "object" ||
		payload === null ||
		Array.isArray(payload)
	) {
		return {
			status: 400,
			body: { ok: false, error: "请求体必须是 JSON 对象" },
		};
	}

	// 未知键直接拒绝，避免拼写错误导致「保存了但没生效」
	const unknownKeys = Object.keys(payload).filter(
		(key) => !Object.hasOwn(DISPLAY_DEFAULT_SCHEMA, key),
	);
	if (unknownKeys.length > 0) {
		return {
			status: 400,
			body: { ok: false, error: `未知参数：${unknownKeys.join(", ")}` },
		};
	}

	// 校验并规整：类型错误与越界值会被丢弃
	const normalized = normalizeOverrides(payload);
	const invalidKeys = Object.keys(payload).filter(
		(key) => normalized[key] === undefined,
	);
	if (invalidKeys.length > 0) {
		return {
			status: 400,
			body: {
				ok: false,
				error: `以下参数取值非法，已拒绝写入：${invalidKeys.join(", ")}`,
			},
		};
	}

	// 剪枝：只保留与出厂值不同的差异项；传空对象即得到空文件（恢复默认）
	const overrides = pickOverrides(normalized);
	try {
		// 原子写：先写临时文件再 rename，避免写入中断留下半截文件
		const tempFile = `${DISPLAY_DEFAULTS_FILE}.tmp`;
		await writeFile(
			tempFile,
			`${JSON.stringify(overrides, null, "\t")}\n`,
			"utf8",
		);
		await rename(tempFile, DISPLAY_DEFAULTS_FILE);
	} catch (error) {
		return {
			status: 500,
			body: {
				ok: false,
				error: `写入失败：${error instanceof Error ? error.message : String(error)}`,
			},
		};
	}

	return { status: 200, body: { ok: true, overrides } };
}

function displayDefaultsDevApi() {
	return {
		name: "firefly-display-defaults-dev-api",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const pathname = (req.url || "").split("?")[0];
				if (pathname !== DISPLAY_DEFAULTS_ENDPOINT) return next();

				const send = (status, body) => {
					res.statusCode = status;
					res.setHeader("Content-Type", "application/json; charset=utf-8");
					res.setHeader("Cache-Control", "no-store");
					res.end(JSON.stringify(body, null, "\t"));
				};

				if (req.method === "GET") {
					// 走磁盘读取而不是模块缓存，保证读到的就是刚保存的内容
					readOverridesFromDisk().then((overrides) =>
						send(200, { ok: true, overrides }),
					);
					return;
				}

				if (req.method !== "POST") {
					return send(405, { ok: false, error: "仅支持 GET / POST" });
				}

				let raw = "";
				req.on("data", (chunk) => {
					raw += chunk;
				});
				req.on("end", async () => {
					let payload;
					try {
						payload = raw ? JSON.parse(raw) : {};
					} catch {
						return send(400, { ok: false, error: "请求体不是合法 JSON" });
					}
					const result = await saveDisplayDefaults(payload);
					send(result.status, result.body);
				});
			});
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site_url,

	base: "/",
	trailingSlash: "always",

	// 字体配置 - 只加载实际使用的字体，跳过未引用的以加快构建
	fonts: (() => {
		// 禁用字体功能时直接返回空数组，跳过 Astro Font API 集成
		if (!fontConfig.enable) return [];

		const used = collectUsedFontCssVars(fontConfig);
		return fontsList
			.filter((f) => used.has(f.cssVariable))
			.map((f) => {
				let provider;
				switch (f.provider) {
					case "google":
						provider = fontProviders.google();
						break;
					case "fontsource":
						provider = fontProviders.fontsource();
						break;
					case "local":
						provider = fontProviders.local();
						break;
					case "bunny":
						provider = fontProviders.bunny();
						break;
					case "fontshare":
						provider = fontProviders.fontshare();
						break;
					case "npm":
						provider = fontProviders.npm();
						break;
					default:
						provider = f.provider;
				}
				return { ...f, provider };
			});
	})(),

	adapter,

	// 图像优化配置
	image: {
		// 组件可自行传入 layout/widths；这里只控制 Markdown 正文图片
		layout: "none",
	},

	integrations: [
		swup({
			theme: false,
			animationClass: "transition-swup-", // see https://swup.js.org/options/#animationselector
			// the default value `transition-` cause transition delay
			// when the Tailwind class `transition-all` is used
			containers: [
				"#banner-overlay-container",
				"#banner-dim-container",
				"#swup-container",
				"#left-sidebar-dynamic",
				"#right-sidebar-dynamic",
				"#floating-toc-wrapper",
			],
			smoothScrolling: false,
			cache: true,
			preload: {
				hover: true,
				visible: true,
			},
			accessibility: true,
			updateHead: true,
			updateBodyClass: false,
			globalInstance: true,
			// 滚动相关配置优化
			resolveUrl: (url) => url,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => {
				// 跳过锚点链接的处理，让浏览器原生处理
				return event.state?.url?.includes("#");
			},
		}),
		icon({
			include: {
				"material-symbols": ["*"],
				"fa7-brands": ["*"],
				"fa7-regular": ["*"],
				"fa7-solid": ["*"],
				"simple-icons": ["*"],
				mdi: ["*"],
				mingcute: ["*"],
			},
		}),
		expressiveCode({
			themes: [expressiveCodeConfig.darkTheme, expressiveCodeConfig.lightTheme],
			useDarkModeMediaQuery: false,
			themeCssSelector: (theme) => `[data-theme='${theme.name}']`,
			plugins: [
				// pluginLanguageBadge 配置 - 从expressiveCodeConfig读取设置
				...(expressiveCodeConfig.pluginLanguageBadge?.enable === true
					? [pluginLanguageBadge()]
					: []),
				// pluginLanguageLogo 配置 - 从expressiveCodeConfig读取设置
				...(expressiveCodeConfig.pluginLanguageLogo?.enable === true
					? [
							pluginLanguageLogo({
								color: expressiveCodeConfig.pluginLanguageLogo.color ?? "mono",
								excludedLangs:
									expressiveCodeConfig.pluginLanguageLogo.excludedLangs ?? [],
							}),
						]
					: []),
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				// pluginCollapsible 配置 - 从expressiveCodeConfig读取设置，使用i18n文本
				...(expressiveCodeConfig.pluginCollapsible?.enable === true
					? [
							pluginCollapsible({
								lineThreshold:
									expressiveCodeConfig.pluginCollapsible.lineThreshold || 15,
								previewLines:
									expressiveCodeConfig.pluginCollapsible.previewLines || 8,
								defaultCollapsed:
									expressiveCodeConfig.pluginCollapsible.defaultCollapsed ??
									true,
								expandButtonText: i18n(I18nKey.codeCollapsibleShowMore),
								collapseButtonText: i18n(I18nKey.codeCollapsibleShowLess),
								expandedAnnouncement: i18n(I18nKey.codeCollapsibleExpanded),
								collapsedAnnouncement: i18n(I18nKey.codeCollapsibleCollapsed),
							}),
						]
					: []),
			],
			defaultProps: {
				wrap: false,
				overridesByLang: {
					shellsession: {
						showLineNumbers: false,
					},
				},
			},
			styleOverrides: {
				borderRadius: "0.75rem",
				codeFontSize: "0.875rem",
				codeFontFamily:
					"var(--font-code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace)",
				codeLineHeight: "1.5rem",
				frames: {},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250,
				},
				languageBadge: {
					fontSize: "0.75rem",
					fontWeight: "bold",
					borderRadius: "0.25rem",
					opacity: "1",
					borderWidth: "0px",
					borderColor: "transparent",
				},
			},
			frames: {
				// 保留原生复制按钮，外观由 src/styles/expressive-code.css 覆盖成主题风格
				showCopyToClipboardButton: true,
			},
		}),
		svelte(),
		sitemap({
			filter: (page) => {
				// 根据页面开关配置过滤sitemap
				const url = new URL(page);
				const pathname = url.pathname;
				if (pathname === "/dynamic/" && !siteConfig.pages.dynamic) {
					return false;
				}
				if (pathname.startsWith("/gallery/") && !siteConfig.pages.gallery) {
					return false;
				}
				if (pathname === "/friends/" && !siteConfig.pages.friends) {
					return false;
				}
				if (pathname === "/guestbook/" && !siteConfig.pages.guestbook) {
					return false;
				}
				if (pathname === "/booknav/" && !siteConfig.pages.booknav) {
					return false;
				}
				if (pathname === "/bilibili/" && !siteConfig.pages.bilibili) {
					return false;
				}
				if (pathname === "/bangumi/" && !siteConfig.pages.bangumi) {
					return false;
				}
				if (pathname === "/vndb/" && !siteConfig.pages.vndb) {
					return false;
				}
				if (pathname === "/myanimelist/" && !siteConfig.pages.mal) {
					return false;
				}
				// 动态页评论嵌入页：评论关闭时重定向到 /404/，不应进 sitemap
				if (
					pathname === "/dynamic/comments/" &&
					(dynamicConfig.showComment === false ||
						!commentConfig.type ||
						commentConfig.type === "none")
				) {
					return false;
				}
				if (pathname === "/sponsor/" && !siteConfig.pages.sponsor) {
					return false;
				}
				return true;
			},
		}),
		mdx(),
	],
	markdown: {
		processor: unified({
			remarkPlugins: [
				...(siteConfig.post.rehypeCallouts.enablePythonMarkdownAdmonitions !==
				false
					? [remarkAdmonitionToBlockquoteCallout]
					: []),
				remarkMath,
				remarkReadingTime,
				remarkWikiLink,
				remarkImageGrid,
				remarkExcerpt,
				remarkDirective,
				remarkSectionize,
				parseDirectiveNode,
				remarkMermaid,
				[remarkPlantuml, plantumlConfig],
			],
			rehypePlugins: [
				[rehypeKatex, { katex }],
				[rehypeCallouts, { theme: siteConfig.post.rehypeCallouts.theme }],
				rehypeSlug,
				rehypeCodeGroup,
				[rehypeMermaid, mermaidConfig],
				rehypePlantuml,
				rehypeDiagramPanZoom,
				rehypeFigure,
				[
					rehypeImageReferrerPolicy,
					{ domains: siteConfig.imageOptimization?.noReferrerDomains || [] },
				],
				[rehypeExternalLinks, { siteUrl: siteConfig.site_url }],
				[rehypeEmailProtection, { method: "base64" }], // 邮箱保护插件，支持 'base64' 或 'rot13'
				[
					rehypeComponents,
					{
						components: {
							github: GithubCardComponent,
						},
					},
				],
				[
					rehypeAutolinkHeadings,
					{
						behavior: "append",
						properties: {
							className: ["anchor"],
						},
						content: {
							type: "element",
							tagName: "span",
							properties: {
								className: ["anchor-icon"],
								"data-pagefind-ignore": true,
							},
							children: [
								{
									type: "text",
									value: "#",
								},
							],
						},
					},
				],
			],
		}),
	},
	vite: {
		plugins: [displayDefaultsDevApi(), tailwindcss()],
		server: {
			watch: {
				ignored: ["**/package/**", "**/Firefly-docs/**"],
			},
		},
		resolve: {
			alias: {
				"@rehype-callouts-theme": `rehype-callouts/theme/${siteConfig.post.rehypeCallouts.theme}`,
			},
		},
		build: {
			minify: "esbuild",
			esbuildOptions: {
				minify: true,
				// 删除 debugger 语句；console.log / console.debug 无副作用，未使用返回值时会被 dead code elimination 移除，
				// console.warn / console.error 保留，确保生产环境出错时仍有日志可查
				drop: ["debugger"],
				pure: ["console.log", "console.debug"],
			},
			rollupOptions: {
				onwarn(warning, warn) {
					// temporarily suppress this warning
					if (
						warning.message.includes("is dynamically imported by") &&
						warning.message.includes("but also statically imported by")
					) {
						return;
					}
					warn(warning);
				},
			},
			// CSS 优化
			cssCodeSplit: true,
			cssMinify: "esbuild",
			assetsInlineLimit: 4096,
		},
	},
});
