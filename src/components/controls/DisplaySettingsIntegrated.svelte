<script lang="ts">
import {
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { resolveDisplaySetting } from "@utils/saved-display-settings";
import {
	clearStoredDisplaySettings,
	getDefaultBannerCarouselEnabled,
	getDefaultBannerTitleEnabled,
	getDefaultCardBorderEnabled,
	getDefaultCardFollowThemeEnabled,
	getDefaultFullscreenLayout,
	getDefaultGradientEnabled,
	getDefaultHue,
	getDefaultOverlayBlur,
	getDefaultOverlayCardOpacity,
	getDefaultOverlayOpacity,
	getDefaultSakuraEnabled,
	getDefaultWallpaperMode,
	getDefaultWavesEnabled,
	getHue,
	getStoredBannerCarouselEnabled,
	getStoredBannerTitleEnabled,
	getStoredCardBorderEnabled,
	getStoredCardFollowThemeEnabled,
	getStoredFullscreenLayout,
	getStoredGradientEnabled,
	getStoredOverlayBlur,
	getStoredOverlayCardOpacity,
	getStoredOverlayOpacity,
	getStoredSakuraEnabled,
	getStoredTheme,
	getStoredWallpaperMode,
	getStoredWavesEnabled,
	reapplyDisplaySettings,
	setBannerCarouselEnabled,
	setBannerTitleEnabled,
	setCardBorderEnabled,
	setCardFollowThemeEnabled,
	setFullscreenLayout,
	setGradientEnabled,
	setHue,
	setOverlayBlur,
	setOverlayCardOpacity,
	setOverlayOpacity,
	setSakuraEnabled,
	setWallpaperMode,
	setWavesEnabled,
} from "@utils/setting-utils";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import PageDebug from "@/components/controls/PageDebug.svelte";
import {
	backgroundWallpaper,
	displaySettingsConfig,
	siteConfig,
} from "@/config";
import type { FullscreenWallpaperLayout, WALLPAPER_MODE } from "@/types/config";

type OverlaySliderItem = {
	key: "opacity" | "blur" | "cardOpacity";
	enabled: boolean;
	label: string;
	displayValue: string;
	ariaLabel: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onValueChange: (value: number) => void;
};

type TabKey = "appearance" | "wallpaper" | "effects" | "page-debug";

let hue = $state(getHue());
const defaultHue = getDefaultHue();
// 初始值一律取「解析后的默认值」，而不是出厂配置：
// 这样无 localStorage 时（无痕窗口 / 首次访问）面板显示的就是保存过的样式，
// 也保证「单行重置」按钮把值还原到与页面实际渲染一致的位置。
let wallpaperMode: WALLPAPER_MODE = $state(getDefaultWallpaperMode());
const defaultWallpaperMode = getDefaultWallpaperMode();
let fullscreenLayout: FullscreenWallpaperLayout = $state(
	getDefaultFullscreenLayout(),
);
const defaultFullscreenLayout = getDefaultFullscreenLayout();
let currentLayout: "list" | "grid" = $state("list");
const defaultLayout = resolveDisplaySetting("postListLayout");
const mobileDefaultLayout =
	siteConfig.postListLayout.mobileDefaultMode || defaultLayout;
let mounted = $state(false);
let isSmallScreen = $state(
	typeof window !== "undefined" ? window.innerWidth < 1200 : false,
);
let isMobileWidth = $state(
	typeof window !== "undefined" ? window.innerWidth < 780 : false,
);
let isMobileViewport = $state(
	typeof window !== "undefined" ? window.innerWidth < 1024 : false,
);
let isSwitching = $state(false);
let wavesEnabled = $state(getDefaultWavesEnabled());
const defaultWavesEnabled = getDefaultWavesEnabled();
let gradientEnabled = $state(getDefaultGradientEnabled());
const defaultGradientEnabled = getDefaultGradientEnabled();
let bannerTitleEnabled = $state(getDefaultBannerTitleEnabled());
const defaultBannerTitleEnabled = getDefaultBannerTitleEnabled();
let bannerCarouselEnabled = $state(getDefaultBannerCarouselEnabled());
const defaultBannerCarouselEnabled = getDefaultBannerCarouselEnabled();
let sakuraEnabled = $state(getDefaultSakuraEnabled());
const defaultSakuraEnabled = getDefaultSakuraEnabled();
let overlayOpacity = $state(getDefaultOverlayOpacity());
const defaultOverlayOpacity = getDefaultOverlayOpacity();
let overlayBlur = $state(getDefaultOverlayBlur());
const defaultOverlayBlur = getDefaultOverlayBlur();
let overlayCardOpacity = $state(getDefaultOverlayCardOpacity());
const defaultOverlayCardOpacity = getDefaultOverlayCardOpacity();
let cardBorderEnabled = $state(false);
const defaultCardBorderEnabled = getDefaultCardBorderEnabled();
let cardFollowThemeEnabled = $state(false);
const defaultCardFollowThemeEnabled = getDefaultCardFollowThemeEnabled();

const isWallpaperSwitchable = displaySettingsConfig.wallpaperModeSwitchable;
const isFullscreenLayoutSwitchable = $derived(
	displaySettingsConfig.fullscreenLayoutSwitchable &&
		wallpaperMode === WALLPAPER_FULLSCREEN,
);
const allowLayoutSwitch = displaySettingsConfig.layoutSwitchable;
let effectiveDefaultLayout = $derived(
	isMobileWidth ? mobileDefaultLayout : defaultLayout,
);
const showThemeColor = displaySettingsConfig.themeColorSwitchable;
const isWavesSwitchable = displaySettingsConfig.wavesSwitchable;
const isGradientSwitchable = displaySettingsConfig.gradientSwitchable;
// 检查是否启用横幅标题（功能开关，非用户切换开关）
// 用解析值而非出厂值：出厂开启但用户保存为关闭时，开关仍应可见（以便再打开）；
// 出厂本来就关闭（该功能未启用）时，开关不显示。
const isBannerTitleEnabled = getDefaultBannerTitleEnabled();
const isBannerTitleSwitchable =
	isBannerTitleEnabled && displaySettingsConfig.bannerTitleSwitchable;
const isBannerCarouselSwitchable =
	displaySettingsConfig.bannerCarouselSwitchable;
const isSakuraSwitchable = displaySettingsConfig.sakuraSwitchable;
const isCardBorderSwitchable = displaySettingsConfig.cardBorderSwitchable;
const isCardFollowThemeSwitchable =
	displaySettingsConfig.cardFollowThemeSwitchable;
// 是否有任何横幅设置可显示（后续添加新设置时在此处添加条件）
const hasBannerSettings =
	isWavesSwitchable ||
	isGradientSwitchable ||
	isBannerTitleSwitchable ||
	isBannerCarouselSwitchable;
const overlaySwitchableConfig = displaySettingsConfig.overlaySwitchable;
const isOverlaySettingsSwitchable =
	typeof overlaySwitchableConfig === "boolean" ? overlaySwitchableConfig : true;
const isOverlayOpacitySwitchable =
	typeof overlaySwitchableConfig === "boolean"
		? overlaySwitchableConfig
		: (overlaySwitchableConfig.opacity ?? false);
const isOverlayBlurSwitchable =
	typeof overlaySwitchableConfig === "boolean"
		? overlaySwitchableConfig
		: (overlaySwitchableConfig.blur ?? false);
const isOverlayCardOpacitySwitchable =
	typeof overlaySwitchableConfig === "boolean"
		? overlaySwitchableConfig
		: (overlaySwitchableConfig.cardOpacity ?? false);
const hasOverlaySettings =
	isOverlaySettingsSwitchable &&
	(isOverlayOpacitySwitchable ||
		isOverlayBlurSwitchable ||
		isOverlayCardOpacitySwitchable);
// 全屏壁纸模式的模糊渐变是否启用（按当前设备读取 fullscreen.blurRamp 配置，未配置默认开启）
const isFullscreenBlurRampEnabled = $derived.by(() => {
	const enable = backgroundWallpaper.fullscreen?.blurRamp?.enable;
	if (typeof enable === "boolean") return enable;
	if (!enable) return true;
	return isMobileViewport ? enable.mobile : enable.desktop;
});
let overlaySettingsIsDefault = $derived(
	(!isOverlayOpacitySwitchable || overlayOpacity === defaultOverlayOpacity) &&
		(!isOverlayBlurSwitchable || overlayBlur === defaultOverlayBlur) &&
		(!isOverlayCardOpacitySwitchable ||
			overlayCardOpacity === defaultOverlayCardOpacity),
);
// 横幅设置是否全部为默认值（用于控制恢复出厂设置按钮的显隐）
let bannerSettingsIsDefault = $derived(
	(!isBannerTitleSwitchable ||
		bannerTitleEnabled === defaultBannerTitleEnabled) &&
		(!isWavesSwitchable || wavesEnabled === defaultWavesEnabled) &&
		(!isGradientSwitchable || gradientEnabled === defaultGradientEnabled) &&
		(!isBannerCarouselSwitchable ||
			bannerCarouselEnabled === defaultBannerCarouselEnabled),
);
let cardSettingsIsDefault = $derived(
	(!isCardBorderSwitchable || cardBorderEnabled === defaultCardBorderEnabled) &&
		(!isCardFollowThemeSwitchable ||
			cardFollowThemeEnabled === defaultCardFollowThemeEnabled),
);

const hasAnyContent = $derived(
	showThemeColor ||
		isWallpaperSwitchable ||
		isFullscreenLayoutSwitchable ||
		allowLayoutSwitch ||
		hasBannerSettings ||
		hasOverlaySettings ||
		isSakuraSwitchable || displaySettingsConfig.enable,
);

// --- Tab visibility ---
const hasAppearanceTab = $derived(
	showThemeColor ||
		allowLayoutSwitch ||
		isCardBorderSwitchable ||
		isCardFollowThemeSwitchable,
);
const hasWallpaperTab = $derived(
	isWallpaperSwitchable ||
		isFullscreenLayoutSwitchable ||
		((wallpaperMode === WALLPAPER_OVERLAY ||
			wallpaperMode === WALLPAPER_FULLSCREEN) &&
			hasOverlaySettings) ||
		((wallpaperMode === WALLPAPER_BANNER ||
			wallpaperMode === WALLPAPER_FULLSCREEN) &&
			hasBannerSettings),
);
const hasEffectsTab = $derived(isSakuraSwitchable);

let visibleTabs = $derived.by(() => {
	const tabs: { key: TabKey; icon: string; label: string }[] = [];
	if (hasAppearanceTab)
		tabs.push({
			key: "appearance",
			icon: "material-symbols:palette",
			label: i18n(I18nKey.settingsTabAppearance),
		});
	if (hasWallpaperTab)
		tabs.push({
			key: "wallpaper",
			icon: "material-symbols:wallpaper",
			label: i18n(I18nKey.settingsTabWallpaper),
		});
	if (hasEffectsTab)
		tabs.push({
			key: "effects",
			icon: "mdi:flower-poppy",
			label: i18n(I18nKey.settingsTabEffects),
		});
	tabs.push({ key: "page-debug", icon: "material-symbols:visibility-off-outline", label: "页面调试" });
	return tabs;
});

let showTabBar = $derived(visibleTabs.length > 1);
let activeTab = $state<TabKey>("appearance");

// Auto-switch active tab if it becomes invisible
$effect(() => {
	if (!visibleTabs.find((t) => t.key === activeTab) && visibleTabs.length > 0) {
		activeTab = visibleTabs[0].key;
	}
});

// Auto-switch to wallpaper tab when entering overlay/fullscreen mode
$effect(() => {
	if (
		(wallpaperMode === WALLPAPER_OVERLAY ||
			wallpaperMode === WALLPAPER_FULLSCREEN) &&
		hasOverlaySettings
	) {
		activeTab = "wallpaper";
	}
});

let overlaySliderItems = $derived<OverlaySliderItem[]>([
	{
		key: "opacity",
		// 全屏壁纸模式不需要背景透明度，隐藏该滑块（仍显示模糊与卡片透明度）
		enabled:
			isOverlayOpacitySwitchable && wallpaperMode !== WALLPAPER_FULLSCREEN,
		label: i18n(I18nKey.overlayOpacity),
		displayValue: `${Math.round(overlayOpacity * 100)}%`,
		ariaLabel: i18n(I18nKey.overlayOpacity),
		min: 20,
		max: 100,
		step: 1,
		value: Math.round(overlayOpacity * 100),
		onValueChange: (value) => {
			overlayOpacity = value / 100;
		},
	},
	{
		key: "blur",
		// 全屏壁纸模式关闭模糊渐变时隐藏模糊滑块（overlay 模式不受影响）
		enabled:
			isOverlayBlurSwitchable &&
			!(wallpaperMode === WALLPAPER_FULLSCREEN && !isFullscreenBlurRampEnabled),
		label: i18n(I18nKey.overlayBlur),
		displayValue: `${overlayBlur.toFixed(1)}px`,
		ariaLabel: i18n(I18nKey.overlayBlur),
		min: 0,
		max: 20,
		step: 0.5,
		value: overlayBlur,
		onValueChange: (value) => {
			overlayBlur = value;
		},
	},
	{
		key: "cardOpacity",
		enabled: isOverlayCardOpacitySwitchable,
		label: i18n(I18nKey.overlayCardOpacity),
		displayValue: `${Math.round(overlayCardOpacity * 100)}%`,
		ariaLabel: i18n(I18nKey.overlayCardOpacity),
		min: 20,
		max: 100,
		step: 1,
		value: Math.round(overlayCardOpacity * 100),
		onValueChange: (value) => {
			overlayCardOpacity = value / 100;
		},
	},
]);
// 当前模式下是否有任何 overlay 滑块实际可见（模糊滑块可能因关闭模糊渐变而隐藏）
let hasVisibleOverlaySlider = $derived(
	overlaySliderItems.some((item) => item.enabled),
);

// ── 保存当前样式 / 恢复出厂设置 ─────────────────────────────
// 保存会把当前 15 项可调参数通过开发服务器接口写入
// src/constants/saved-display-settings.json，成为站点默认外观（只存与出厂值不同的项）
//
// 注意：这里刻意 **不用** `import.meta.env.DEV` 包住按钮的渲染。
// 它在浏览器构建时会被替换成 false，于是 `{#if ...}` 整块被 tree-shake 掉：
// 服务端渲染出的按钮仍在 DOM 里，但客户端没有对应的事件处理器，
// 点下去毫无反应（曾因此出现「点了保存没有任何提示」）。
// 改为始终渲染按钮，在点击处理函数里用运行时判断决定是否可写。
const isDevMode = import.meta.env.DEV;

type DefaultsFeedback = {
	kind: "ok" | "error";
	text: string;
	debug?: string;
} | null;
let defaultsFeedback: DefaultsFeedback = $state(null);
let defaultsSaving = $state(false);
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

// reloadAfter: 恢复出厂设置后需要整页刷新。
// 原因：覆盖层 JSON 是在构建/开发服务器注入时被读入内存的（Layout 的
// define:vars、ConfigCarrier、PostPage 都用了它），当前页面内存里仍是旧值，
// 只重绘 DOM 无法拿回原始出厂值，必须重新加载页面才能让整条链路生效。
function showDefaultsFeedback(
	kind: "ok" | "error",
	text: string,
	reloadAfter = false,
	debug?: string,
): void {
	defaultsFeedback = { kind, text, debug };
	if (feedbackTimer !== undefined) clearTimeout(feedbackTimer);
	feedbackTimer = setTimeout(
		() => {
			defaultsFeedback = null;
			if (reloadAfter && typeof window !== "undefined") {
				window.location.reload();
			}
		},
		reloadAfter ? 900 : 15000,
	);
}

// 收集当前 15 项可调参数（与 localStorage 键一一对应）
function collectCurrentDisplaySettings(): Record<string, unknown> {
	return {
		hue,
		theme: getStoredTheme(),
		postListLayout: currentLayout,
		cardBorderEnabled,
		cardFollowThemeEnabled,
		wallpaperMode,
		fullscreenLayout,
		overlayOpacity,
		overlayBlur,
		overlayCardOpacity,
		wavesEnabled,
		gradientEnabled,
		sakuraEnabled,
		bannerTitleEnabled,
		bannerCarouselEnabled,
	};
}

// 写入接口走 POST + JSON body，由 astro.config.mjs 里的 Vite dev 中间件处理。
// 中间件在 Astro 路由之前执行，因此能拿到完整 POST 请求体（预渲染路由会被剥离）。
// 剪枝由服务端按出厂值完成，前端只负责提交当前值。
const SAVED_SETTINGS_ENDPOINT = "/api/saved-display-settings.json";

async function postSavedSettings(payload: Record<string, unknown>): Promise<{
	ok: boolean;
	saved?: number;
	error?: string;
	debug: string;
}> {
	const keys = Object.keys(payload);
	// 把提交内容一并带出，便于对比「界面看到的样式」与「实际提交的值」是否一致
	const payloadSummary = JSON.stringify(payload);
	try {
		const response = await fetch(SAVED_SETTINGS_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			cache: "no-store",
		});
		const text = await response.text();
		let result: { ok?: boolean; saved?: number; error?: string };
		try {
			result = JSON.parse(text) as typeof result;
		} catch {
			// 返回的不是 JSON（例如回到了首页 HTML），把片段带出来便于定位
			return {
				ok: false,
				error: `HTTP ${response.status}`,
				debug: `提交 ${keys.length} 项 → 响应非 JSON(HTTP ${response.status}): ${text.slice(0, 80)}`,
			};
		}
		if (!response.ok || result.ok !== true) {
			return {
				ok: false,
				error: result.error,
				debug: `提交 ${payloadSummary} → HTTP ${response.status}${result.error ? ` ${result.error}` : ""}`,
			};
		}
		return {
			ok: true,
			saved: result.saved ?? 0,
			debug: `提交 ${payloadSummary} → 服务端写入 ${result.saved ?? 0} 项`,
		};
	} catch (error) {
		// fetch 本身失败（接口不存在 / 网络中断）会走到这里
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
			debug: `提交 ${payloadSummary} → 请求未送达：${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

// 保存当前样式。
//
// 两个关键点：
//   1. defaultsSaving 的解锁必须放在 finally 里。此前它写在 await 之后，
//      中间任何一步抛错都会让它永久停在 true，两个按钮 disabled 到必须刷新页面
//      ——这正是「保存一次后再也点不动」的原因。
//   2. 保存后不清理本浏览器的 localStorage 记录。当前页面里解析出的默认值是在
//      服务启动时读入内存的，写文件不会刷新它；此时若清掉 localStorage，界面会
//      回退到那套「旧」默认值，反而显示成不是刚保存的样式。保留记录则当前预览
//      恰好就是刚保存的样式，语义一致；新样式在下次加载与构建时自动生效。
async function saveAsDefault(): Promise<void> {
	if (defaultsSaving) return;
	// 非开发环境直接给出说明，避免请求打到一个不存在的接口
	if (!isDevMode) {
		showDefaultsFeedback("error", i18n(I18nKey.displaySaveFailed));
		return;
	}
	defaultsSaving = true;
	// 注意：这里必须有 catch。此前只有 finally，导致函数体内任何异常（例如
	// 调用了未导入的函数）都会静默消失，界面停在「点击已到达按钮」那一句，
	// 既没有成功也没有失败提示 —— 极难排查。
	try {
		const payload = collectCurrentDisplaySettings();
		const result = await postSavedSettings(payload);
		if (!result.ok) {
			showDefaultsFeedback(
				"error",
				i18n(I18nKey.displaySaveFailed),
				false,
				result.debug,
			);
			return;
		}

		// saved === 0 表示当前样式与出厂值完全一致，服务端剪枝后无可写入内容。
		// 这时文件保持为空是正确结果，需要明确告知，而不是假装保存成功。
		if (result.saved === 0) {
			showDefaultsFeedback(
				"ok",
				i18n(I18nKey.displaySaveNoChange),
				false,
				result.debug,
			);
			return;
		}

		showDefaultsFeedback(
			"ok",
			i18n(I18nKey.displaySaveSuccess),
			false,
			result.debug,
		);
	} catch (error) {
		// 把异常原文显示出来，避免再次出现「点了没反应也看不到原因」
		showDefaultsFeedback(
			"error",
			i18n(I18nKey.displaySaveFailed),
			false,
			`${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
		);
	} finally {
		// 无论成功、失败还是抛错，都必须解锁，保证可以继续保存
		defaultsSaving = false;
	}
}

// 把面板自身的显示状态重新从存储读一遍，使其反映最新的默认值
function syncPanelStateFromStorage(): void {
	hue = getHue();
	wallpaperMode = getStoredWallpaperMode();
	fullscreenLayout = getStoredFullscreenLayout();
	cardBorderEnabled = getStoredCardBorderEnabled();
	cardFollowThemeEnabled = getStoredCardFollowThemeEnabled();
	overlayOpacity = getStoredOverlayOpacity();
	overlayBlur = getStoredOverlayBlur();
	overlayCardOpacity = getStoredOverlayCardOpacity();
	wavesEnabled = getStoredWavesEnabled();
	gradientEnabled = getStoredGradientEnabled();
	sakuraEnabled = getStoredSakuraEnabled();
	bannerTitleEnabled = getStoredBannerTitleEnabled();
	bannerCarouselEnabled = getStoredBannerCarouselEnabled();
	currentLayout = window.innerWidth < 780 ? mobileDefaultLayout : defaultLayout;
	requestAnimationFrame(refreshAllRangeProgress);
}

// 恢复出厂设置：先清空保存的样式文件，再清除本浏览器的显示设置记录并重绘。
// 接口失败时不清理本地状态，保持两者一致，避免只清了一半。
async function restoreDefaults(): Promise<void> {
	if (defaultsSaving) return;
	if (!isDevMode) {
		showDefaultsFeedback("error", i18n(I18nKey.displaySaveFailed));
		return;
	}
	if (typeof window !== "undefined") {
		const confirmed = window.confirm(i18n(I18nKey.displayRestoreConfirm));
		if (!confirmed) return;
	}

	defaultsSaving = true;
	try {
		// 传空对象即清空保存的样式（服务端会剪枝成空文件）
		const result = await postSavedSettings({});
		if (!result.ok) {
			showDefaultsFeedback(
				"error",
				i18n(I18nKey.displaySaveFailed),
				false,
				result.debug,
			);
			return;
		}

		clearStoredDisplaySettings();
		reapplyDisplaySettings();
		syncPanelStateFromStorage();
		// 恢复出厂设置后整页刷新：内存里解析出的样式需要重新加载才能回到出厂值
		showDefaultsFeedback("ok", i18n(I18nKey.displayRestoreSuccess), true);
	} finally {
		defaultsSaving = false;
	}
}

function resetHue() {
	hue = getDefaultHue();
	requestAnimationFrame(refreshAllRangeProgress);
}

function resetWallpaperMode() {
	wallpaperMode = defaultWallpaperMode;
	setWallpaperMode(defaultWallpaperMode);
}

function resetFullscreenLayout() {
	fullscreenLayout = defaultFullscreenLayout;
	setFullscreenLayout(defaultFullscreenLayout);
}

function switchFullscreenLayout(layout: FullscreenWallpaperLayout) {
	if (fullscreenLayout === layout) return;
	fullscreenLayout = layout;
	setFullscreenLayout(layout);
}

function resetLayout() {
	currentLayout = effectiveDefaultLayout;
	localStorage.removeItem("postListLayout");

	// 触发自定义事件，通知页面布局已改变
	const event = new CustomEvent("layoutChange", {
		detail: { layout: effectiveDefaultLayout },
	});
	window.dispatchEvent(event);
}

function resetWavesEnabled() {
	wavesEnabled = defaultWavesEnabled;
	setWavesEnabled(defaultWavesEnabled);
}

function resetGradientEnabled() {
	gradientEnabled = defaultGradientEnabled;
	setGradientEnabled(defaultGradientEnabled);
}

function resetBannerSettings() {
	if (
		isBannerTitleSwitchable &&
		bannerTitleEnabled !== defaultBannerTitleEnabled
	) {
		bannerTitleEnabled = defaultBannerTitleEnabled;
		setBannerTitleEnabled(defaultBannerTitleEnabled);
	}
	if (isWavesSwitchable && wavesEnabled !== defaultWavesEnabled) {
		wavesEnabled = defaultWavesEnabled;
		setWavesEnabled(defaultWavesEnabled);
	}
	if (isGradientSwitchable && gradientEnabled !== defaultGradientEnabled) {
		gradientEnabled = defaultGradientEnabled;
		setGradientEnabled(defaultGradientEnabled);
	}
	if (
		isBannerCarouselSwitchable &&
		bannerCarouselEnabled !== defaultBannerCarouselEnabled
	) {
		bannerCarouselEnabled = defaultBannerCarouselEnabled;
		setBannerCarouselEnabled(defaultBannerCarouselEnabled);
	}
}

function resetOverlaySettings() {
	if (isOverlayOpacitySwitchable && overlayOpacity !== defaultOverlayOpacity) {
		overlayOpacity = defaultOverlayOpacity;
		setOverlayOpacity(defaultOverlayOpacity);
	}
	if (isOverlayBlurSwitchable && overlayBlur !== defaultOverlayBlur) {
		overlayBlur = defaultOverlayBlur;
		setOverlayBlur(defaultOverlayBlur);
	}
	if (
		isOverlayCardOpacitySwitchable &&
		overlayCardOpacity !== defaultOverlayCardOpacity
	) {
		overlayCardOpacity = defaultOverlayCardOpacity;
		setOverlayCardOpacity(defaultOverlayCardOpacity);
	}

	requestAnimationFrame(refreshAllRangeProgress);
}

function toggleWavesEnabled() {
	wavesEnabled = !wavesEnabled;
	setWavesEnabled(wavesEnabled);
}

function toggleGradientEnabled() {
	gradientEnabled = !gradientEnabled;
	setGradientEnabled(gradientEnabled);
}

function toggleBannerTitleEnabled() {
	bannerTitleEnabled = !bannerTitleEnabled;
	setBannerTitleEnabled(bannerTitleEnabled);
}

function toggleBannerCarouselEnabled() {
	bannerCarouselEnabled = !bannerCarouselEnabled;
	setBannerCarouselEnabled(bannerCarouselEnabled);
}

function toggleSakuraEnabled() {
	sakuraEnabled = !sakuraEnabled;
	setSakuraEnabled(sakuraEnabled);
}

function toggleCardBorderEnabled() {
	cardBorderEnabled = !cardBorderEnabled;
	setCardBorderEnabled(cardBorderEnabled);
}

function toggleCardFollowThemeEnabled() {
	cardFollowThemeEnabled = !cardFollowThemeEnabled;
	setCardFollowThemeEnabled(cardFollowThemeEnabled);
}

function resetCardSettings() {
	if (
		isCardBorderSwitchable &&
		cardBorderEnabled !== defaultCardBorderEnabled
	) {
		cardBorderEnabled = defaultCardBorderEnabled;
		setCardBorderEnabled(defaultCardBorderEnabled);
	}
	if (
		isCardFollowThemeSwitchable &&
		cardFollowThemeEnabled !== defaultCardFollowThemeEnabled
	) {
		cardFollowThemeEnabled = defaultCardFollowThemeEnabled;
		setCardFollowThemeEnabled(defaultCardFollowThemeEnabled);
	}
}

function switchWallpaperMode(newMode: WALLPAPER_MODE) {
	wallpaperMode = newMode;
	setWallpaperMode(newMode);
	window.scrollTo({ top: 0 });

	if (newMode === WALLPAPER_OVERLAY || newMode === WALLPAPER_FULLSCREEN) {
		requestAnimationFrame(refreshAllRangeProgress);
	}
}

function checkScreenSize() {
	isSmallScreen = window.innerWidth < 1200;
	isMobileWidth = window.innerWidth < 780;
	isMobileViewport = window.innerWidth < 1024;
	// 低于380px强制网格模式
	if (window.innerWidth < 380 && currentLayout === "list") {
		currentLayout = "grid";
		const event = new CustomEvent("layoutChange", {
			detail: { layout: "grid" },
		});
		window.dispatchEvent(event);
	}
}

function updateRangeProgress(input: HTMLInputElement) {
	const min = Number(input.min || 0);
	const max = Number(input.max || 100);
	const value = Number(input.value || 0);
	const progress = ((value - min) * 100) / (max - min || 1);
	input.style.setProperty(
		"--range-progress",
		`${Math.min(100, Math.max(0, progress))}%`,
	);
}

function refreshAllRangeProgress() {
	const panel = document.getElementById("display-setting");
	if (!panel) return;

	const rangeInputs = Array.from(
		panel.querySelectorAll('input[type="range"]'),
	) as HTMLInputElement[];

	rangeInputs.forEach((input) => {
		updateRangeProgress(input);
	});
}

function switchLayout() {
	if (!mounted || isSwitching) return;

	isSwitching = true;
	currentLayout = currentLayout === "list" ? "grid" : "list";
	localStorage.setItem("postListLayout", currentLayout);

	// 触发自定义事件，通知页面布局已改变
	const event = new CustomEvent("layoutChange", {
		detail: { layout: currentLayout },
	});
	window.dispatchEvent(event);

	// 动画完成后重置状态
	setTimeout(() => {
		isSwitching = false;
	}, 500);
}

onMount(() => {
	mounted = true;
	checkScreenSize();

	// 从localStorage读取保存的壁纸模式
	wallpaperMode = getStoredWallpaperMode();

	// 从localStorage读取保存的全屏壁纸布局
	fullscreenLayout = getStoredFullscreenLayout();

	// 从localStorage读取水波纹动画状态
	wavesEnabled = getStoredWavesEnabled();

	// 从localStorage读取渐变过渡状态
	gradientEnabled = getStoredGradientEnabled();

	// 从localStorage读取横幅标题状态
	bannerTitleEnabled = getStoredBannerTitleEnabled();

	// 从localStorage读取横幅轮播状态
	bannerCarouselEnabled = getStoredBannerCarouselEnabled();

	// 从localStorage读取樱花特效状态
	sakuraEnabled = getStoredSakuraEnabled();

	// 从localStorage读取卡片样式状态
	cardBorderEnabled = getStoredCardBorderEnabled();
	cardFollowThemeEnabled = getStoredCardFollowThemeEnabled();

	// 从localStorage读取全屏透明设置状态
	overlayOpacity = getStoredOverlayOpacity();
	overlayBlur = getStoredOverlayBlur();
	overlayCardOpacity = getStoredOverlayCardOpacity();

	// 从localStorage读取用户偏好布局
	const savedLayout = localStorage.getItem("postListLayout");
	if (savedLayout && (savedLayout === "list" || savedLayout === "grid")) {
		currentLayout = savedLayout;
	} else {
		currentLayout =
			window.innerWidth < 780 ? mobileDefaultLayout : defaultLayout;
	}

	// 监听窗口大小变化
	window.addEventListener("resize", checkScreenSize);

	return () => {
		window.removeEventListener("resize", checkScreenSize);
	};
});

// 监听布局变化事件
onMount(() => {
	const handleCustomEvent = (event: Event) => {
		const customEvent = event as CustomEvent<{ layout: "list" | "grid" }>;
		currentLayout = customEvent.detail.layout;
	};

	window.addEventListener("layoutChange", handleCustomEvent);

	return () => {
		window.removeEventListener("layoutChange", handleCustomEvent);
	};
});

onMount(() => {
	const panel = document.getElementById("display-setting");
	if (!panel) return;

	const handleRangeInput = (event: Event) => {
		const target = event.target;
		if (target instanceof HTMLInputElement && target.type === "range") {
			updateRangeProgress(target);
		}
	};

	refreshAllRangeProgress();
	panel.addEventListener("input", handleRangeInput);

	return () => {
		panel.removeEventListener("input", handleRangeInput);
	};
});

onMount(() => {
	const handleWallpaperModeChange = (event: Event) => {
		const customEvent = event as CustomEvent<{ mode: WALLPAPER_MODE }>;
		wallpaperMode = customEvent.detail.mode;
	};

	window.addEventListener("wallpaperModeChange", handleWallpaperModeChange);

	return () => {
		window.removeEventListener(
			"wallpaperModeChange",
			handleWallpaperModeChange,
		);
	};
});

$effect(() => {
	if (hue || hue === 0) {
		setHue(hue);
	}
});

$effect(() => {
	if (wallpaperMode === WALLPAPER_OVERLAY) {
		if (isOverlayOpacitySwitchable) {
			setOverlayOpacity(overlayOpacity);
		}
		if (isOverlayBlurSwitchable) {
			setOverlayBlur(overlayBlur);
		}
		if (isOverlayCardOpacitySwitchable) {
			setOverlayCardOpacity(overlayCardOpacity);
		}
	} else if (wallpaperMode === WALLPAPER_FULLSCREEN) {
		// 全屏壁纸不透明，只应用模糊与卡片透明度
		if (isOverlayBlurSwitchable) {
			setOverlayBlur(overlayBlur);
		}
		if (isOverlayCardOpacitySwitchable) {
			setOverlayCardOpacity(overlayCardOpacity);
		}
	}
});

// Tab 切换后刷新滑块进度（overlay 滑块在 DOM 中才生效）
$effect(() => {
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	activeTab;
	requestAnimationFrame(refreshAllRangeProgress);
});
</script>

{#if hasAnyContent}
<div id="display-setting" class="float-panel float-panel-closed absolute transition-all w-80 right-4 px-3 pt-0 pb-3 max-h-[80vh] overflow-y-auto custom-scrollbar" data-floating-panel data-floating-panel-trigger="display-settings-switch" inert aria-hidden="true">
	<!-- Tab Bar -->
	{#if showTabBar}
	<div class="flex gap-1 border-b border-black/5 dark:border-white/10 pt-3 pb-1 mb-3">
		{#each visibleTabs as tab (tab.key)}
			<button
				class="focus-ring-inset flex-1 flex flex-col items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium transition-colors rounded-lg min-w-0
					{activeTab === tab.key
						? 'bg-(--btn-plain-bg-hover) text-(--primary)'
						: 'text-gray-500 dark:text-gray-400 hover:bg-(--btn-plain-bg-hover) hover:text-gray-700 dark:hover:text-gray-300'}"
				onclick={() => activeTab = tab.key}
			>
				<Icon icon={tab.icon} class="text-[1.5rem] shrink-0"></Icon>
				<span class="truncate">{tab.label}</span>
			</button>
		{/each}
	</div>
	{/if}

	<!-- Appearance Tab: Theme Color + Layout -->
	{#if activeTab === "page-debug"}<PageDebug />{/if}
	{#if activeTab === "appearance"}
		<!-- Theme Color Section -->
		{#if showThemeColor}
		<div class="">
			<div class="section-title">
				{i18n(I18nKey.themeColor)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={hue === defaultHue} class:pointer-events-none={hue === defaultHue}
						disabled={hue === defaultHue} aria-hidden={hue === defaultHue ? "true" : undefined} onclick={resetHue}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
				<div id="hueValue" class="transition bg-(--btn-regular-bg) rounded-md flex justify-center
				font-bold items-center text-(--btn-content)">
					{hue}
				</div>
			</div>
			<div class="hue-slider-shell w-full h-6 px-1 bg-[oklch(0.80_0.10_0)] dark:bg-[oklch(0.70_0.10_0)] rounded-md select-none">
				<input aria-label={i18n(I18nKey.themeColor)} type="range" min="0" max="360" bind:value={hue}
					   class="slider" id="colorSlider" step="5" style="width: 100%">
			</div>
		</div>
		{/if}

		<!-- Layout Switch Section -->
		{#if allowLayoutSwitch}
		<div class="">
			<div class="section-title">
				{i18n(I18nKey.postListLayout)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={currentLayout === effectiveDefaultLayout} class:pointer-events-none={currentLayout === effectiveDefaultLayout}
						disabled={currentLayout === effectiveDefaultLayout} aria-hidden={currentLayout === effectiveDefaultLayout ? "true" : undefined} onclick={resetLayout}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<div class="flex gap-2">
				<button
					aria-label={i18n(I18nKey.postListLayoutList)}
					class="flex-1 btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={currentLayout !== 'list'}
					class:bg-(--btn-regular-bg-hover)={currentLayout === 'list'}
					disabled={isSwitching}
					onclick={switchLayout}
					title={i18n(I18nKey.postListLayoutList)}
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
					</svg>
					<span class="text-xs font-medium">{i18n(I18nKey.postListLayoutList)}</span>
				</button>
				<button
					aria-label={i18n(I18nKey.postListLayoutGrid)}
					class="flex-1 btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={currentLayout !== 'grid'}
					class:bg-(--btn-regular-bg-hover)={currentLayout === 'grid'}
					disabled={isSwitching}
					onclick={switchLayout}
					title={i18n(I18nKey.postListLayoutGrid)}
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
					</svg>
					<span class="text-xs font-medium">{i18n(I18nKey.postListLayoutGrid)}</span>
				</button>
			</div>
		</div>
		{/if}

		<!-- Card Settings Section -->
		{#if isCardBorderSwitchable || isCardFollowThemeSwitchable}
		<div>
			<div class="section-title">
				{i18n(I18nKey.cardSettings)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={cardSettingsIsDefault} class:pointer-events-none={cardSettingsIsDefault}
						disabled={cardSettingsIsDefault} aria-hidden={cardSettingsIsDefault ? "true" : undefined} onclick={resetCardSettings}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<div class="space-y-1">
				{#if isCardBorderSwitchable}
				<button
					class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
					class:bg-(--btn-regular-bg-hover)={cardBorderEnabled}
					onclick={toggleCardBorderEnabled}
				>
					<Icon icon="material-symbols:border-outer-rounded" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-sm flex-1">{i18n(I18nKey.cardBorder)}</span>
					<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
						 class:bg-(--primary)={cardBorderEnabled}
						 class:bg-(--btn-regular-bg-active)={!cardBorderEnabled}>
						<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
							 class:left-0.5={!cardBorderEnabled}
							 class:left-5={cardBorderEnabled}></div>
					</div>
				</button>
				{/if}
				{#if isCardFollowThemeSwitchable}
				<button
					class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
					class:bg-(--btn-regular-bg-hover)={cardFollowThemeEnabled}
					onclick={toggleCardFollowThemeEnabled}
				>
					<Icon icon="material-symbols:palette" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-sm flex-1">{i18n(I18nKey.cardFollowTheme)}</span>
					<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
						 class:bg-(--primary)={cardFollowThemeEnabled}
						 class:bg-(--btn-regular-bg-active)={!cardFollowThemeEnabled}>
						<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
							 class:left-0.5={!cardFollowThemeEnabled}
							 class:left-5={cardFollowThemeEnabled}></div>
					</div>
				</button>
				{/if}
			</div>
		</div>
		{/if}
	{/if}

	<!-- Wallpaper Tab: Mode + Overlay + Banner Settings -->
	{#if activeTab === "wallpaper"}
		<!-- Wallpaper Mode Section -->
		{#if isWallpaperSwitchable}
		<div>
			<div class="section-title">
				{i18n(I18nKey.wallpaperMode)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={wallpaperMode === defaultWallpaperMode} class:pointer-events-none={wallpaperMode === defaultWallpaperMode}
						disabled={wallpaperMode === defaultWallpaperMode} aria-hidden={wallpaperMode === defaultWallpaperMode ? "true" : undefined} onclick={resetWallpaperMode}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<button
					class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={wallpaperMode !== WALLPAPER_BANNER}
					class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_BANNER}
					onclick={() => switchWallpaperMode(WALLPAPER_BANNER)}
				>
					<Icon icon="material-symbols:image-outline" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-xs font-medium">{i18n(I18nKey.wallpaperBannerMode)}</span>
				</button>
				<button
					class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={wallpaperMode !== WALLPAPER_FULLSCREEN}
					class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_FULLSCREEN}
					onclick={() => switchWallpaperMode(WALLPAPER_FULLSCREEN)}
				>
					<Icon icon="material-symbols:wallpaper" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-xs font-medium">{i18n(I18nKey.wallpaperFullscreenMode)}</span>
				</button>
				<button
					class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={wallpaperMode !== WALLPAPER_OVERLAY}
					class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_OVERLAY}
					onclick={() => switchWallpaperMode(WALLPAPER_OVERLAY)}
				>
					<Icon icon="material-symbols:full-coverage-outline-rounded" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-xs font-medium">{i18n(I18nKey.wallpaperOverlayMode)}</span>
				</button>
				<button
					class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={wallpaperMode !== WALLPAPER_NONE}
					class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_NONE}
					onclick={() => switchWallpaperMode(WALLPAPER_NONE)}
				>
					<Icon icon="material-symbols:hide-image-outline" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-xs font-medium">{i18n(I18nKey.wallpaperNoneMode)}</span>
				</button>
			</div>
		</div>
		{/if}

		<!-- Fullscreen Layout Section -->
		{#if isFullscreenLayoutSwitchable}
		<div>
			<div class="section-title">
				{i18n(I18nKey.fullscreenLayout)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={fullscreenLayout === defaultFullscreenLayout} class:pointer-events-none={fullscreenLayout === defaultFullscreenLayout}
						disabled={fullscreenLayout === defaultFullscreenLayout} aria-hidden={fullscreenLayout === defaultFullscreenLayout ? "true" : undefined} onclick={resetFullscreenLayout}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<button
					class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={fullscreenLayout !== "classic"}
					class:bg-(--btn-regular-bg-hover)={fullscreenLayout === "classic"}
					onclick={() => switchFullscreenLayout("classic")}
				>
					<Icon icon="material-symbols:view-day-outline" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-xs font-medium">{i18n(I18nKey.fullscreenClassicLayout)}</span>
				</button>
				<button
					class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
					class:opacity-60={fullscreenLayout !== "hero"}
					class:bg-(--btn-regular-bg-hover)={fullscreenLayout === "hero"}
					onclick={() => switchFullscreenLayout("hero")}
				>
					<Icon icon="material-symbols:desktop-landscape-outline-rounded" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-xs font-medium">{i18n(I18nKey.fullscreenHeroLayout)}</span>
				</button>
			</div>
		</div>
		{/if}

		<!-- Overlay Settings Section（全屏壁纸模式也复用 overlay 的透明/模糊/卡片透明度设置） -->
		{#if (wallpaperMode === WALLPAPER_OVERLAY || (wallpaperMode === WALLPAPER_FULLSCREEN && fullscreenLayout === "hero")) && hasOverlaySettings && hasVisibleOverlaySlider}
		<div class="">
			<div class="section-title">
				{i18n(I18nKey.overlaySettings)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={overlaySettingsIsDefault} class:pointer-events-none={overlaySettingsIsDefault}
						disabled={overlaySettingsIsDefault} aria-hidden={overlaySettingsIsDefault ? "true" : undefined} onclick={resetOverlaySettings}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<div class="space-y-2">
				{#each overlaySliderItems as item (item.key)}
					{#if item.enabled}
						<div class="rounded-md bg-(--btn-regular-bg) p-2">
							<div class="flex items-center justify-between mb-1">
								<span class="text-xs font-medium text-(--btn-content) opacity-80">{item.label}</span>
								<span class="text-xs text-(--btn-content)">{item.displayValue}</span>
							</div>
							<input
								aria-label={item.ariaLabel}
								type="range"
								min={item.min}
								max={item.max}
								step={item.step}
								value={item.value}
								oninput={(e) => item.onValueChange(Number((e.currentTarget as HTMLInputElement).value))}
								class="slider w-full overlay-slider"
							/>
						</div>
					{/if}
				{/each}
			</div>
		</div>
		{/if}

		<!-- Banner Settings Section -->
		{#if (wallpaperMode === WALLPAPER_BANNER || wallpaperMode === WALLPAPER_FULLSCREEN) && hasBannerSettings}
		<div class="">
			<div class="section-title">
				{i18n(I18nKey.wallpaperSettings)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={bannerSettingsIsDefault} class:pointer-events-none={bannerSettingsIsDefault}
						disabled={bannerSettingsIsDefault} aria-hidden={bannerSettingsIsDefault ? "true" : undefined} onclick={resetBannerSettings}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<div class="space-y-1">
				<!-- Banner Title Switch -->
				{#if isBannerTitleSwitchable}
				<button
					class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
					class:bg-(--btn-regular-bg-hover)={bannerTitleEnabled}
					onclick={toggleBannerTitleEnabled}
				>
					<Icon icon="material-symbols:titlecase-rounded" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-sm flex-1">{i18n(I18nKey.wallpaperTitle)}</span>
					<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
						 class:bg-(--primary)={bannerTitleEnabled}
						 class:bg-(--btn-regular-bg-active)={!bannerTitleEnabled}>
						<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
							 class:left-0.5={!bannerTitleEnabled}
							 class:left-5={bannerTitleEnabled}></div>
					</div>
				</button>
				{/if}
				<!-- Banner Carousel Switch -->
				{#if isBannerCarouselSwitchable}
				<button
					class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
					class:bg-(--btn-regular-bg-hover)={bannerCarouselEnabled}
					onclick={toggleBannerCarouselEnabled}
				>
					<Icon icon="material-symbols:view-carousel-outline" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-sm flex-1">{i18n(I18nKey.wallpaperCarousel)}</span>
					<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
						 class:bg-(--primary)={bannerCarouselEnabled}
						 class:bg-(--btn-regular-bg-active)={!bannerCarouselEnabled}>
						<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
							 class:left-0.5={!bannerCarouselEnabled}
							 class:left-5={bannerCarouselEnabled}></div>
					</div>
				</button>
				{/if}
				<!-- Waves Animation Switch（横幅模式和 classic 全屏模式） -->
				{#if isWavesSwitchable && (wallpaperMode === WALLPAPER_BANNER || (wallpaperMode === WALLPAPER_FULLSCREEN && fullscreenLayout === "classic"))}
				<button
					class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
					class:bg-(--btn-regular-bg-hover)={wavesEnabled}
					onclick={toggleWavesEnabled}
				>
					<Icon icon="material-symbols:airwave-rounded" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-sm flex-1">{i18n(I18nKey.wavesAnimation)}</span>
					<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
						 class:bg-(--primary)={wavesEnabled}
						 class:bg-(--btn-regular-bg-active)={!wavesEnabled}>
						<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
							 class:left-0.5={!wavesEnabled}
							 class:left-5={wavesEnabled}></div>
					</div>
				</button>
				{/if}
				<!-- Gradient Transition Switch（横幅模式和 classic 全屏模式） -->
				{#if isGradientSwitchable && (wallpaperMode === WALLPAPER_BANNER || (wallpaperMode === WALLPAPER_FULLSCREEN && fullscreenLayout === "classic"))}
				<button
					class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
					class:bg-(--btn-regular-bg-hover)={gradientEnabled}
					onclick={toggleGradientEnabled}
				>
					<Icon icon="material-symbols:gradient" class="text-[1.25rem] shrink-0"></Icon>
					<span class="text-sm flex-1">{i18n(I18nKey.gradientTransition)}</span>
					<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
						 class:bg-(--primary)={gradientEnabled}
						 class:bg-(--btn-regular-bg-active)={!gradientEnabled}>
						<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
							 class:left-0.5={!gradientEnabled}
							 class:left-5={gradientEnabled}></div>
					</div>
				</button>
				{/if}
			</div>
		</div>
		{/if}
	{/if}

	<!-- Effects Tab: Sakura -->
	{#if activeTab === "effects"}
		{#if isSakuraSwitchable}
		<div class="">
			<div class="section-title">
				{i18n(I18nKey.effectsSettings)}
				<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
						class:opacity-0={sakuraEnabled === defaultSakuraEnabled} class:pointer-events-none={sakuraEnabled === defaultSakuraEnabled}
						disabled={sakuraEnabled === defaultSakuraEnabled} aria-hidden={sakuraEnabled === defaultSakuraEnabled ? "true" : undefined}
						onclick={() => { sakuraEnabled = defaultSakuraEnabled; setSakuraEnabled(defaultSakuraEnabled); }}>
					<div class="text-(--btn-content)">
						<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
					</div>
				</button>
			</div>
			<button
				class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
				class:bg-(--btn-regular-bg-hover)={sakuraEnabled}
				onclick={toggleSakuraEnabled}
			>
				<Icon icon="mdi:flower-poppy" class="text-[1.25rem] shrink-0"></Icon>
				<span class="text-sm flex-1">{i18n(I18nKey.sakuraEffect)}</span>
				<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
					 class:bg-(--primary)={sakuraEnabled}
					 class:bg-(--btn-regular-bg-active)={!sakuraEnabled}>
					<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
						 class:left-0.5={!sakuraEnabled}
						 class:left-5={sakuraEnabled}></div>
				</div>
			</button>
		</div>
		{/if}
	{/if}

	<!-- 保存当前样式 / 恢复出厂设置。
	     不加 {#if import.meta.env.DEV} 之类条件：那会在浏览器构建时被替换成 false，
	     整块标记被 tree-shake 掉，导致服务端渲染出的按钮点了没反应。
	     非开发环境由处理函数在运行时给出提示。 -->
	{#if activeTab !== "page-debug"}
	<div class="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
		<div class="flex gap-2">
			<button
				class="flex-1 btn-regular rounded-md py-2 px-3 text-sm active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
				disabled={defaultsSaving}
				onclick={saveAsDefault}
			>
				{defaultsSaving ? i18n(I18nKey.displaySaving) : i18n(I18nKey.displaySaveAsDefault)}
			</button>
			<button
				class="flex-1 btn-regular rounded-md py-2 px-3 text-sm active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
				disabled={defaultsSaving}
				onclick={restoreDefaults}
			>
				{defaultsSaving ? i18n(I18nKey.displaySaving) : i18n(I18nKey.displayRestoreDefault)}
			</button>
		</div>
		{#if defaultsFeedback}
			<p
				class="mt-2 text-xs leading-relaxed"
				class:text-(--primary)={defaultsFeedback.kind === "ok"}
				class:text-red-500={defaultsFeedback.kind === "error"}
			>
				{defaultsFeedback.text}
			</p>
			{#if defaultsFeedback.debug}
				<!-- 开发期诊断信息：直接显示在面板上，便于排查「点了保存但文件没变化」 -->
				<p class="mt-1 text-[0.6875rem] leading-relaxed text-gray-500 dark:text-gray-400 break-all">
					{defaultsFeedback.debug}
				</p>
			{/if}
		{/if}
	</div>
{/if}
</div>
{/if}
