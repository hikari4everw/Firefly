type ReviewPost = { id: string; data: { category?: string | null; series?: string } };

export function getAnimeReviewCandidates<T extends ReviewPost>(posts: T[], currentId: string): T[] {
	return posts.filter((post) => post.id === currentId || (post.data.category === "ACG" && post.data.series === "追番"));
}

export function canRenderAnimeReviewBody(data: { draft?: boolean; password?: string }, production: boolean): boolean {
	return !data.password && (!production || !data.draft);
}
