import { updateMainGridCols, updateSidebarComponentsVisibility } from "@/utils/grid-layout-utils";
import { UI_VISIBILITY_STORAGE_KEY, validateUiVisibility } from "@/utils/ui-visibility";

export function previewUiVisibility(hiddenTargets: string[]): void {
	const settings = validateUiVisibility({ hiddenTargets });
	// 先写入存储；失败时保留原来的页面状态，面板会显示原因。
	localStorage.setItem(UI_VISIBILITY_STORAGE_KEY, JSON.stringify(settings));
	document.documentElement.setAttribute("data-ui-hidden", settings.hiddenTargets.join(" "));
	updateMainGridCols();
	updateSidebarComponentsVisibility();
}
