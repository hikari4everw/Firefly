import type { SiteConfig } from "@/types/siteConfig";

// 站点语言的环境变量覆盖工具
// 把「读取 PUBLIC_SITE_LANG 环境变量并规整为合法语言」的逻辑收敛在这里，
// 让 siteConfig.ts 保持纯配置，不掺杂判断代码

// 读取站点语言环境变量（Vite/Astro 走 import.meta.env，构建脚本回退 process.env）
function readSiteLangEnv(): string | undefined {
	try {
		const raw = (import.meta.env as Record<string, unknown>).PUBLIC_SITE_LANG;
		return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
	} catch {
		return typeof process === "undefined"
			? undefined
			: process.env.PUBLIC_SITE_LANG;
	}
}

// 规整成 SiteConfig.lang 的合法取值，无法识别时返回 undefined（回退到默认值）
function normalizeSiteLang(
	value: string | undefined,
): SiteConfig["lang"] | undefined {
	if (!value) return undefined;
	const v = value.toLowerCase();
	if (v === "zh_cn" || v === "zh-cn") return "zh_CN";
	if (v === "zh_tw" || v === "zh-tw") return "zh_TW";
	if (v === "ja" || v === "ja_jp" || v === "ja-jp") return "ja";
	if (v === "ru" || v === "ru_ru" || v === "ru-ru") return "ru";
	if (v === "ko" || v === "ko_kr" || v === "ko-kr") return "ko";
	if (
		v === "en" ||
		v === "en_us" ||
		v === "en_gb" ||
		v === "en-us" ||
		v === "en-gb"
	) {
		return "en";
	}
	return undefined;
}

// 站点语言，环境变量 PUBLIC_SITE_LANG 优先，未设置或无法识别时使用默认值
// 例如在部署平台设置 PUBLIC_SITE_LANG=en 即可让站点以英文构建，无需修改配置文件
export function resolveSiteLang(
	defaultLang: SiteConfig["lang"],
): SiteConfig["lang"] {
	return normalizeSiteLang(readSiteLangEnv()) ?? defaultLang;
}

// 读取 Bangumi API 地址环境变量（Vite/Astro 走 import.meta.env，构建脚本回退 process.env）
function readBangumiApiUrlEnv(): string | undefined {
	let raw: unknown;
	try {
		raw = (import.meta.env as Record<string, unknown>).BANGUMI_API_URL;
	} catch {
		raw = undefined;
	}
	// import.meta.env 不存在（tsx 构建脚本）或未设置该键时，回退 process.env
	if (typeof raw !== "string" || !raw.trim()) {
		raw =
			typeof process === "undefined" ? undefined : process.env.BANGUMI_API_URL;
	}
	if (typeof raw !== "string") return undefined;
	// 调用方按 `${apiUrl}/v0/users/...` 拼接，这里去掉结尾斜杠避免出现双斜杠
	const value = raw.trim().replace(/\/+$/, "");
	return value || undefined;
}

// Bangumi API 地址：环境变量 BANGUMI_API_URL 优先，未设置时使用默认值。
// 用于接入自建 Cloudflare 反代，同时避免把带 token 的地址提交进仓库。
export function resolveBangumiApiUrl(defaultUrl: string): string {
	return readBangumiApiUrlEnv() ?? defaultUrl;
}

// 由语言代码生成 OpenGraph og:locale（language_TERRITORY 格式）。
// 站点语言已是下划线形式（zh_CN/zh_TW/en/ja/ko/ru），仅需为无地区的语言补全区号。
export function getOgLocale(lang: string): string {
	switch (lang.toLowerCase().replace("-", "_")) {
		case "zh_cn":
			return "zh_CN";
		case "zh_tw":
			return "zh_TW";
		case "ja":
			return "ja_JP";
		case "ko":
			return "ko_KR";
		case "ru":
			return "ru_RU";
		default:
			return "en_US";
	}
}
