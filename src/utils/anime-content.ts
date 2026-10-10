import data from "@/data/anime.json";
import type { AnimeArchive } from "@/types/anime";
import { normalizeLegacyDraft } from "./anime-ranking";

export function getAnimeArchive(): AnimeArchive {
	const archive = data as unknown as AnimeArchive;
	return {
		boards: archive.boards
			.map((board) => ({
				...board,
				versions: board.versions.map((version) => ({
					...normalizeLegacyDraft(version),
					id: version.id,
					label: version.label,
					createdAt: version.createdAt,
				})),
			}))
			.sort((a, b) => b.year - a.year || b.quarter - a.quarter),
		reviews: { ...archive.reviews },
	};
}
