// 外观面板访问限制与保存样式的回归验证。
// 运行：node --import tsx scripts/verify-display-settings-access.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { backgroundWallpaper, displaySettingsConfig } from "../src/config";
import savedSettings from "../src/constants/saved-display-settings.json";
import type { DisplaySettingsConfig } from "../src/types/displaySettingsConfig";
import { getBannerVisibilityState } from "../src/utils/banner-visibility-utils";

const enabledConfig: DisplaySettingsConfig = {
	enable: true,
	themeColorSwitchable: true,
	layoutSwitchable: true,
	cardBorderSwitchable: true,
	cardFollowThemeSwitchable: true,
	wallpaperModeSwitchable: true,
	fullscreenLayoutSwitchable: true,
	wavesSwitchable: true,
	gradientSwitchable: true,
	bannerTitleSwitchable: true,
	bannerCarouselSwitchable: true,
	overlaySwitchable: { opacity: true, blur: true, cardOpacity: true },
	sakuraSwitchable: true,
};

async function resolveConfig(
	dev: boolean,
	env: string | undefined,
	config = enabledConfig,
): Promise<DisplaySettingsConfig> {
	// 用实际 Vite 静态替换语义执行生产解析器，覆盖 SSR 与浏览器共用的配置。
	const result = await build({
		entryPoints: ["src/utils/display-settings-utils.ts"],
		bundle: true,
		write: false,
		platform: "node",
		format: "esm",
		define: {
			"import.meta.env": JSON.stringify({
				DEV: dev,
				PUBLIC_DISPLAY_SETTINGS: env,
			}),
		},
	});
	const module = await import(
		`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
	);
	return module.resolveDisplaySettingsConfig(config);
}

await test("生产环境即使显式开启面板，也关闭入口及全部设置项", async () => {
	for (const env of [undefined, "true", "1", "false", "invalid"]) {
		const config = await resolveConfig(false, env);
		assert.equal(config.enable, false, `生产环境变量 ${env}`);
		assert.ok(Object.values(config).every((value) => value === false));
	}
});

await test("开发环境保留原有配置和环境变量开关", async () => {
	assert.deepEqual(await resolveConfig(true, undefined), enabledConfig);
	assert.deepEqual(await resolveConfig(true, "invalid"), enabledConfig);
	assert.equal((await resolveConfig(true, "false")).enable, false);
	const disabled = { ...enabledConfig, enable: false };
	assert.equal((await resolveConfig(true, undefined, disabled)).enable, false);
	assert.equal((await resolveConfig(true, "true", disabled)).enable, true);
});

const originalSaved = { ...savedSettings };
const originalWallpaper = structuredClone(backgroundWallpaper);
const originalConfig = { ...displaySettingsConfig };

function resetFixture(): void {
	for (const key of Object.keys(savedSettings)) {
		Reflect.deleteProperty(savedSettings, key);
	}
	Object.assign(backgroundWallpaper, structuredClone(originalWallpaper));
	Object.assign(displaySettingsConfig, originalConfig);
	// 模拟生产环境的总开关关闭：不能依靠可切换项替保存样式生成内容。
	Object.assign(displaySettingsConfig, {
		wallpaperModeSwitchable: false,
		wavesSwitchable: false,
		gradientSwitchable: false,
	});
}

try {
	await test("面板关闭后，壁纸内容按保存模式生成而非原始模式", () => {
		for (const mode of ["none", "banner", "fullscreen", "overlay"] as const) {
			resetFixture();
			backgroundWallpaper.mode = mode === "none" ? "banner" : "none";
			Object.assign(savedSettings, { wallpaperMode: mode });
			const state = getBannerVisibilityState({
				isHomePage: true,
				isPostPage: false,
			});
			assert.equal(state.isBannerMode, mode === "banner");
			assert.equal(state.isFullscreenMode, mode === "fullscreen");
			assert.equal(state.isOverlayMode, mode === "overlay");
			assert.equal(state.hasWallpaper, mode !== "none");
		}
	});

	await test("保存的全屏 hero 布局不会生成经典布局的文章横幅", () => {
		resetFixture();
		backgroundWallpaper.mode = "fullscreen";
		Object.assign(savedSettings, { fullscreenLayout: "hero" });
		const state = getBannerVisibilityState({
			isHomePage: false,
			isPostPage: true,
			bannerPostMeta: {
				title: "测试文章",
				description: "测试描述",
				published: new Date(),
			},
		});
		assert.equal(state.showBannerPostMeta, false);
	});

	await test("保存的特效开关覆盖设备配置并决定内容是否生成", () => {
		for (const enabled of [true, false]) {
			resetFixture();
			const common = backgroundWallpaper.common;
			assert.ok(common?.waves && common.gradient);
			common.waves.enable = { desktop: !enabled, mobile: !enabled };
			common.gradient.enable = { desktop: !enabled, mobile: !enabled };
			Object.assign(savedSettings, {
				wavesEnabled: enabled,
				gradientEnabled: enabled,
			});
			const state = getBannerVisibilityState({
				isHomePage: true,
				isPostPage: false,
			});
			assert.equal(state.wavesEnabledOnDesktop, enabled);
			assert.equal(state.wavesEnabledOnMobile, enabled);
			assert.equal(state.shouldRenderWaves, enabled);
			assert.equal(state.gradientEnabledOnDesktop, enabled);
			assert.equal(state.gradientEnabledOnMobile, enabled);
			assert.equal(state.shouldRenderGradient, enabled);
		}
	});

	await test("未保存特效时保留桌面与移动端差异", () => {
		resetFixture();
		const common = backgroundWallpaper.common;
		assert.ok(common?.waves && common.gradient);
		common.waves.enable = { desktop: true, mobile: false };
		common.gradient.enable = { desktop: false, mobile: true };
		const state = getBannerVisibilityState({
			isHomePage: true,
			isPostPage: false,
		});
		assert.equal(state.wavesEnabledOnDesktop, true);
		assert.equal(state.wavesEnabledOnMobile, false);
		assert.equal(state.gradientEnabledOnDesktop, false);
		assert.equal(state.gradientEnabledOnMobile, true);
	});

	await test("保存的首页标题和轮播开关覆盖原始配置", () => {
		resetFixture();
		Object.assign(savedSettings, {
			bannerTitleEnabled: false,
			bannerCarouselEnabled: true,
		});
		const state = getBannerVisibilityState({
			isHomePage: true,
			isPostPage: false,
		});
		assert.equal(state.showHomeText, false);
		assert.equal(state.bannerCarouselEnabledDefault, true);
	});
} finally {
	resetFixture();
	Object.assign(savedSettings, originalSaved);
	Object.assign(displaySettingsConfig, originalConfig);
}
