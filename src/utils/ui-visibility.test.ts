import assert from "node:assert/strict";
import { test } from "node:test";
import { sidebarLayoutConfig } from "@/config/sidebarConfig";
import { getWidgetVisibilityId, UI_VISIBILITY_TARGETS, validateUiVisibility } from "./ui-visibility";

test("目标清单保持唯一，重复广告可独立隐藏", () => {
	assert.equal(new Set(UI_VISIBILITY_TARGETS.map(item => item.id)).size, UI_VISIBILITY_TARGETS.length);
	const ads = sidebarLayoutConfig.rightComponents.filter(item => item.type === "advertisement");
	assert.equal(new Set(ads.map(item => getWidgetVisibilityId("right", item))).size, ads.length);
});

test("接受合法配置并去重，不修改原输入", () => {
	const input = { hiddenTargets: ["home-title", "search", "home-title"] };
	assert.deepEqual(validateUiVisibility(input), { hiddenTargets: ["home-title", "search"] });
	assert.equal(input.hiddenTargets.length, 3);
	assert.deepEqual(validateUiVisibility({ hiddenTargets: [] }), { hiddenTargets: [] });
});

test("拒绝未知目标、非法类型和混入外观设置", () => {
	for (const input of [null, [], {}, { hiddenTargets: "search" }, { hiddenTargets: [1] }, { hiddenTargets: ["display-settings-switch"] }, { hiddenTargets: ["search"], theme: "dark" }]) {
		assert.throws(() => validateUiVisibility(input));
	}
});
