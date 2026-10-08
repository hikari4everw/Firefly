import assert from "node:assert/strict";
import { test } from "node:test";
import { remarkWikiLink } from "../src/plugins/remark-wiki-link.js";

function transform(value) {
	const tree = { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value }] }] };
	remarkWikiLink()(tree, {});
	return tree;
}

test("根 vault 的 src/content/posts 路径解析为现有文章卡片", () => {
	const tree = transform("[[src/content/posts/guide/index|使用指南]]");
	assert.equal(tree.children[0].data?.hName, "a");
	assert.equal(tree.children[0].data?.hProperties?.href, "/posts/guide/");
});

test("根 vault 双链锚点和别名保持有效", () => {
	const tree = transform("请看 [[src/content/posts/guide/index#快速 开始|指南章节]]。");
	const paragraph = tree.children[0];
	assert.ok(paragraph.type === "paragraph");
	const link = paragraph.children[1];
	assert.ok(link.type === "link");
	assert.equal(link.url, "/posts/guide/#快速-开始");
	assert.deepEqual(link.children, [{ type: "text", value: "指南章节" }]);
});

test("已有路径、裸文件名和当前页锚点仍按原规则解析", () => {
	for (const target of ["guide/firefly-wiki-link", "posts/guide/firefly-wiki-link", "firefly-wiki-link"]) {
		const tree = transform(`查看 [[${target}|双链示例]]`);
		const paragraph = tree.children[0];
		assert.ok(paragraph.type === "paragraph");
		const link = paragraph.children[1];
		assert.ok(link.type === "link");
		assert.equal(link.url, "/posts/guide/firefly-wiki-link/");
	}
	const tree = transform("查看 [[#当前 标题]]");
	const paragraph = tree.children[0];
	assert.ok(paragraph.type === "paragraph");
	const link = paragraph.children[1];
	assert.ok(link.type === "link");
	assert.equal(link.url, "#当前-标题");
});
