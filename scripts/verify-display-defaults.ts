// 显示设置默认值覆盖层的验证脚本
//
// 项目没有单元测试框架，这里用 Node 内置断言覆盖覆盖层最关键的纯逻辑：
// 差异剪枝、非法键/越界值丢弃、空输入回退。
//
// 运行：npx tsx scripts/verify-display-defaults.ts
// 断言失败时进程以非 0 退出，可直接用于 CI。

import assert from "node:assert/strict";
import {
	getFactoryDefaults,
	normalizeOverrides,
	pickOverrides,
	readOverrides,
	resolveDisplayDefaults,
} from "../src/utils/display-defaults";

let passed = 0;
function check(name: string, fn: () => void): void {
	fn();
	passed += 1;
	console.log(`  ✓ ${name}`);
}

const factory = getFactoryDefaults();

console.log("display-defaults 覆盖层验证\n");

console.log("normalizeOverrides：丢弃非法输入");
check("未知键被丢弃", () => {
	const result = normalizeOverrides({ bogus: 1, another: "x" }) as Record<
		string,
		unknown
	>;
	assert.deepEqual(Object.keys(result), []);
});

check("越界数值被丢弃（overlayBlur 上限 20）", () => {
	const result = normalizeOverrides({ overlayBlur: 999 });
	assert.equal(result.overlayBlur, undefined);
});

check("越界数值被丢弃（hue 超过 360）", () => {
	const result = normalizeOverrides({ hue: 400 });
	assert.equal(result.hue, undefined);
});

check("类型错误被丢弃（boolean 字段传字符串）", () => {
	const result = normalizeOverrides({
		sakuraEnabled: "true" as unknown as boolean,
	});
	assert.equal(result.sakuraEnabled, undefined);
});

check("枚举外的取值被丢弃（wallpaperMode）", () => {
	const result = normalizeOverrides({
		wallpaperMode: "rainbow" as unknown as typeof factory.wallpaperMode,
	});
	assert.equal(result.wallpaperMode, undefined);
});

check("非对象输入返回空对象", () => {
	assert.deepEqual(normalizeOverrides(null), {});
	assert.deepEqual(normalizeOverrides([1, 2, 3]), {});
	assert.deepEqual(normalizeOverrides("nope"), {});
	assert.deepEqual(normalizeOverrides(42), {});
});

console.log("\nnormalizeOverrides：保留合法输入");
check("合法值被保留", () => {
	const result = normalizeOverrides({
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
	assert.equal(normalizeOverrides({ hue: 0 }).hue, 0);
	assert.equal(normalizeOverrides({ hue: 360 }).hue, 360);
	assert.equal(normalizeOverrides({ overlayBlur: 20 }).overlayBlur, 20);
});

console.log("\npickOverrides：差异剪枝");
check("与出厂值相同的项被剔除", () => {
	const result = pickOverrides({ hue: factory.hue });
	assert.equal(result.hue, undefined);
	assert.equal(Object.keys(result).length, 0);
});

check("仅保留真正不同的项", () => {
	// 让 hue 偏离出厂值，其余保持出厂值
	const changedHue = factory.hue === 200 ? 201 : 200;
	const result = pickOverrides({
		hue: changedHue,
		overlayBlur: factory.overlayBlur,
		sakuraEnabled: factory.sakuraEnabled,
	});
	assert.equal(result.hue, changedHue);
	assert.equal(result.overlayBlur, undefined);
	assert.equal(result.sakuraEnabled, undefined);
	assert.deepEqual(Object.keys(result), ["hue"]);
});

check("全部为出厂值时得到空对象（等价于恢复默认）", () => {
	const result = pickOverrides({ ...factory });
	assert.deepEqual(result, {});
});

check("空输入得到空对象", () => {
	assert.deepEqual(pickOverrides({}), {});
});

check("非法值不会进入结果", () => {
	const result = pickOverrides({
		overlayBlur: 9999,
		wallpaperMode: "rainbow" as unknown as typeof factory.wallpaperMode,
	});
	assert.deepEqual(result, {});
});

console.log("\nresolveDisplayDefaults：覆盖层优先、缺失回退");
check("解析结果始终包含全部 15 项", () => {
	const resolved = resolveDisplayDefaults();
	assert.equal(Object.keys(resolved).length, 15);
});

check("当前无覆盖时解析结果等于出厂值", () => {
	// 仓库内 display-defaults.json 提交的是空对象
	assert.deepEqual(readOverrides(), {});
	assert.deepEqual(resolveDisplayDefaults(), factory);
});

check("覆盖值优先于出厂值", () => {
	const resolved = resolveDisplayDefaults();
	const overrides = readOverrides();
	for (const [key, value] of Object.entries(overrides)) {
		assert.equal(
			(resolved as Record<string, unknown>)[key],
			value,
			`${key} 应取覆盖值`,
		);
	}
});

console.log(`\n全部通过：${passed} 项断言`);
