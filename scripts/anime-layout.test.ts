import assert from "node:assert/strict";
import { test } from "node:test";
import { computeGridColumns } from "../src/utils/responsive-utils";

test("anime hides only the right column and restores the ordinary layout", () => {
	const input = {
		enabled: true,
		position: "both" as const,
		tabletSidebar: "left" as const,
		hideSidebarOnPostPage: false,
		isPostPage: false,
		hasLeftWidgets: true,
		hasRightWidgets: true,
	};
	const ordinary = computeGridColumns(input);
	assert.equal(ordinary["--grid-sidebar-width"], "17.5rem");
	const anime = computeGridColumns({ ...input, hideRightSidebar: true });
	assert.equal(anime["--right-display-xl"], "none");
	assert.equal(anime["--left-display-xl"], "contents");
	assert.equal(anime["--cols-xl"], "var(--grid-sidebar-width) 1fr");
	assert.equal(ordinary["--right-display-xl"], "contents");
	assert.deepEqual(
		computeGridColumns({ ...input, hideRightSidebar: false }),
		ordinary,
	);
});
