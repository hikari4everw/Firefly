// 由全站布局在开发环境注册，首次通过 Swup 进入追番页也能加载编辑器。
export function initializeAnimeEditor(): void {
	let editor: Record<string, unknown> | undefined;
	let target: HTMLElement | null = null;
	let dispose: ((component: Record<string, unknown>) => Promise<void>) | undefined;
	let swupRegistered = false;

	async function initEditor(): Promise<void> {
		const placeholder = document.getElementById("anime-editor-root");
		const preview = new URLSearchParams(location.search).get("preview") === "1";
		if (preview) placeholder?.remove();
		const root = preview ? null : placeholder;
		if (root === target) return;
		target = root;
		if (editor && dispose) void dispose(editor);
		editor = undefined;
		if (!root) return;
		try {
			const [{ mount, unmount }, { default: Editor }] = await Promise.all([
				import("svelte"),
				import("@/components/pages/anime/AnimeEditor.svelte"),
			]);
			// 模块加载期间切页时，不在已经移除的节点上挂载。
			if (root !== target || !root.isConnected) return;
			dispose = unmount;
			root.replaceChildren();
			editor = mount(Editor, {
				target: root,
				props: {
					posts: JSON.parse(root.dataset.posts || "[]"),
					initialBoardId: root.dataset.boardId,
					initialVersionId: root.dataset.versionId,
					onready: () => {
						if (root !== target || !root.isConnected) return;
						const content = root.closest(".anime-panel")?.querySelector<HTMLElement>(".anime-public-content");
						if (content) content.hidden = true;
						root.closest(".anime-page")?.classList.add("is-workbench");
					},
				},
			});
		} catch (error) {
			if (root !== target || !root.isConnected) return;
			root.textContent = `本机编辑器加载失败：${error instanceof Error ? error.message : String(error)}。请刷新后重试。`;
		}
	}
	const registerSwup = (): void => {
		if (!swupRegistered && window.swup) {
			window.swup.hooks.on("page:view", initEditor);
			swupRegistered = true;
		}
	};
	void initEditor();
	registerSwup();
	document.addEventListener("swup:enable", registerSwup);
	document.addEventListener("swup:contentReplaced", initEditor);
	document.addEventListener("astro:page-load", initEditor);
}
