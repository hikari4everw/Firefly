// 保存的显示样式 · 解析与剪枝逻辑验证脚本
//
// 项目没有单元测试框架，这里用 Node 内置断言覆盖最关键的纯逻辑：
// 差异化剪枝、非法键/越界值丢弃、空输入回退、覆盖优先级。
//
// 运行：npx tsx scripts/verify-saved-display-settings.ts
// 断言失败时进程以非 0 退出，可直接用于 CI。

import assert from "node:assert/strict";
import {
	SAVED_SETTINGS_KEYS,
	SAVED_SETTINGS_SCHEMA,
} from "../src/types/savedDisplaySettings";
import {
	getFactorySettings,
	normalizeSavedSettings,
	pickChangedSettings,
	readSavedSettings,
	resolveDisplaySettings,
} from "../src/utils/saved-display-settings";

let passed = 0;
function check(name: string, fn: () => void): void {
	fn();
	passed += 1;
	console.log(`  ✓ ${name}`);
}

const factory = getFactorySettings();
const saved = readSavedSettings();

console.log("保存的显示样式 · 逻辑验证\n");

console.log("校验规则表自身");
check("可保存键共 15 项", () => {
	assert.equal(SAVED_SETTINGS_KEYS.length, 15);
});

check("键列表由校验规则表派生，两者一致", () => {
	assert.deepEqual(
		[...SAVED_SETTINGS_KEYS].sort(),
		Object.keys(SAVED_SETTINGS_SCHEMA).sort(),
	);
});

check("每个可保存键都有出厂值", () => {
	for (const key of SAVED_SETTINGS_KEYS) {
		assert.notEqual(factory[key], undefined, `${key} 缺少出厂值定义`);
	}
});

console.log("\nnormalizeSavedSettings：丢弃非法输入");
check("未知键被丢弃", () => {
	const result = normalizeSavedSettings({ bogus: 1, another: "x" }) as Record<
		string,
		unknown
	>;
	assert.deepEqual(Object.keys(result), []);
});

check("越界数值被丢弃（overlayBlur 上限 20）", () => {
	assert.equal(
		normalizeSavedSettings({ overlayBlur: 999 }).overlayBlur,
		undefined,
	);
});

check("越界数值被丢弃（hue 超过 360）", () => {
	assert.equal(normalizeSavedSettings({ hue: 400 }).hue, undefined);
});

check("类型错误被丢弃（boolean 字段传字符串）", () => {
	const result = normalizeSavedSettings({
		sakuraEnabled: "true" as unknown as boolean,
	});
	assert.equal(result.sakuraEnabled, undefined);
});

check("枚举外的取值被丢弃（wallpaperMode）", () => {
	const result = normalizeSavedSettings({
		wallpaperMode: "rainbow" as unknown as typeof factory.wallpaperMode,
	});
	assert.equal(result.wallpaperMode, undefined);
});

check("非对象输入返回空对象", () => {
	assert.deepEqual(normalizeSavedSettings(null), {});
	assert.deepEqual(normalizeSavedSettings([1, 2, 3]), {});
	assert.deepEqual(normalizeSavedSettings("nope"), {});
	assert.deepEqual(normalizeSavedSettings(42), {});
});

console.log("\nnormalizeSavedSettings：保留合法输入");
check("合法值被保留", () => {
	const result = normalizeSavedSettings({
		hue: 200,
		sakuraEnabled: true,
		wallpaperMode: "fullscreen",
		overlayBlur: 12,
	});
	assert.equal(result.hue, 200);
	assert.equal(result.sakuraEnabled, true);
	assert.equal(result.wallpaperMode, "fullscreen");
	assert.equal(result.overlayBlur, 12);
});

check("边界值被保留（hue=0 / hue=360 / overlayBlur=20）", () => {
	assert.equal(normalizeSavedSettings({ hue: 0 }).hue, 0);
	assert.equal(normalizeSavedSettings({ hue: 360 }).hue, 360);
	assert.equal(normalizeSavedSettings({ overlayBlur: 20 }).overlayBlur, 20);
});

console.log("\npickChangedSettings：差异化剪枝");
check("与出厂值相同的项被剔除", () => {
	const result = pickChangedSettings({ hue: factory.hue });
	assert.equal(result.hue, undefined);
	assert.equal(Object.keys(result).length, 0);
});

check("仅保留真正不同的项", () => {
	// 让 hue 偏离出厂值，其余保持出厂值
	const changedHue = factory.hue === 200 ? 201 : 200;
	const result = pickChangedSettings({
		hue: changedHue,
		overlayBlur: factory.overlayBlur,
		sakuraEnabled: factory.sakuraEnabled,
	});
	assert.equal(result.hue, changedHue);
	assert.equal(result.overlayBlur, undefined);
	assert.equal(result.sakuraEnabled, undefined);
	assert.deepEqual(Object.keys(result), ["hue"]);
});

// 这条对应「保存后文件却是空的」这一现象：当所有项都等于出厂值时，
// 剪枝后确实没有任何内容可写，空文件是正确结果，不是保存失败。
check("全部等于出厂值时剪枝为空（即「没有需要保存的内容」）", () => {
	const result = pickChangedSettings({ ...factory });
	assert.deepEqual(result, {});
	assert.equal(Object.keys(result).length, 0);
});

check("空输入得到空对象", () => {
	assert.deepEqual(pickChangedSettings({}), {});
});

check("非法值不会进入结果", () => {
	const result = pickChangedSettings({
		overlayBlur: 9999,
		wallpaperMode: "rainbow" as unknown as typeof factory.wallpaperMode,
	});
	assert.deepEqual(result, {});
});

check("剪枝只影响差异项，不改动其他键", () => {
	const changedHue = factory.hue === 300 ? 301 : 300;
	const result = pickChangedSettings({ hue: changedHue, theme: factory.theme });
	assert.deepEqual(Object.keys(result), ["hue"]);
	assert.equal(result.hue, changedHue);
});

console.log("\nresolveDisplaySettings：保存的样式优先、缺失回退出厂值");
check("解析结果始终包含全部 15 项", () => {
	assert.equal(Object.keys(resolveDisplaySettings()).length, 15);
});

check("未保存任何样式时解析结果等于出厂值", () => {
	if (Object.keys(saved).length === 0) {
		assert.deepEqual(resolveDisplaySettings(), factory);
	} else {
		// 本地已保存过样式时该断言不适用，跳过（避免误报）
		console.log("    （本仓库已有保存的样式，跳过此断言）");
	}
});

check("保存的值优先于出厂值", () => {
	const resolved = resolveDisplaySettings();
	for (const [key, value] of Object.entries(saved)) {
		assert.equal(
			(resolved as Record<string, unknown>)[key],
			value,
			`${key} 应取保存的值`,
		);
	}
});

console.log(`\n全部通过：${passed} 项断言`);
