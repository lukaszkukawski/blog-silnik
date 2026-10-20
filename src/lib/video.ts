export function mmss(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export type Heading = { depth: number; slug: string; text: string };
export type Chapter = { at: number; title: string };
export type ExtraToc = { id: string; label: string; after: number };
export type TocItem = { slug: string; text: string; time: number | null; extra: boolean };

const norm = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * Składa spis rozdziałów: każdy nagłówek `##` to pozycja; pozycja dostaje minutę filmu, gdy ma rozdział o tym samym tytule,
 * a w przeciwnym razie jest „tylko we wpisie”. Błędy kończą build z opisem po polsku.
 */
export function planToc(source: string, headings: readonly Heading[], chapters: readonly Chapter[] = [], extraToc: readonly ExtraToc[] = []): TocItem[] {
	const sections = headings.filter((h) => h.depth === 2);
	if (chapters.length > sections.length) {
		throw new Error(`${source}: film ma ${chapters.length} rozdziałów, a w treści jest tylko ${sections.length} nagłówków ##. Każdy rozdział musi mieć swój nagłówek ##.`);
	}
	if (chapters.length && chapters[0].at !== 0) throw new Error(`${source}: pierwszy rozdział musi zaczynać się w sekundzie 0.`);
	const times = new Map<number, number>();
	let cursor = 0;
	for (const chapter of chapters) {
		const found = sections.findIndex((h, index) => index >= cursor && norm(h.text) === norm(chapter.title));
		if (found < 0) {
			const anywhere = sections.some((h) => norm(h.text) === norm(chapter.title));
			throw new Error(anywhere
				? `${source}: rozdział „${chapter.title}” jest w złej kolejności względem nagłówków ##.`
				: `${source}: tytuł rozdziału „${chapter.title}” nie jest równy żadnemu nagłówkowi ## we wpisie.`);
		}
		times.set(found, chapter.at);
		cursor = found + 1;
	}
	const items: TocItem[] = [];
	sections.forEach((h, index) => {
		items.push({ slug: h.slug, text: h.text, time: times.has(index) ? times.get(index)! : null, extra: false });
		extraToc.filter((e) => e.after === index + 1).forEach((e) => items.push({ slug: e.id, text: e.label, time: null, extra: true }));
	});
	return items;
}
