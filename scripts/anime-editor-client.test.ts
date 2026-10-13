import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeAnimeEditor } from "../src/utils/anime-editor-client";

test("visitor preview removes the local editor placeholder rather than leaving a loading message", () => {
	const old = Object.fromEntries(
		["document", "window", "location"].map((key) => [
			key,
			Object.getOwnPropertyDescriptor(globalThis, key),
		]),
	);
	let removed = false;
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			getElementById: () => ({
				remove() {
					removed = true;
				},
			}),
			addEventListener() {},
		},
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {},
	});
	Object.defineProperty(globalThis, "location", {
		configurable: true,
		value: { search: "?preview=1" },
	});
	try {
		initializeAnimeEditor();
		assert.equal(removed, true);
	} finally {
		for (const key of Object.keys(old)) {
			if (old[key]) Object.defineProperty(globalThis, key, old[key]!);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
