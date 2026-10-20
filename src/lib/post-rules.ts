export function isCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	if (year < 1 || month < 1 || month > 12 || day < 1) return false;
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function warsawToday(now: Date): string {
	const parts = new Intl.DateTimeFormat('en', {
		timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
	}).formatToParts(now);
	const part = (type: string) => parts.find((item) => item.type === type)!.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Zod = typeof import('astro/zod').z;

export interface PostSchemaOptions {
	/** Dozwolone identyfikatory kategorii: jedyne źródło prawdy to konfiguracja bloga. */
	categoryIds: readonly string[];
	/** Walidator obrazu z `defineCollection({ schema: ({ image }) => … })`; w testach może być zwykłym tekstem. */
	image: () => any;
	/** Dodatkowe pola bloga (obiekt pól zod). Nie mogą nadpisywać pól silnika. */
	extend?: Record<string, any>;
}

const CORE_FIELDS = ['categories', 'title', 'description', 'slug', 'pubDate', 'video', 'cover', 'coverAlt'];

export function buildPostSchema(z: Zod, { categoryIds, image, extend = {} }: PostSchemaOptions) {
	for (const key of Object.keys(extend)) {
		if (CORE_FIELDS.includes(key)) throw new Error(`extendSchema: pole „${key}” należy do silnika i nie można go nadpisać.`);
	}
	const category = categoryIds.length
		? z.enum(categoryIds as [string, ...string[]])
		: z.never({ error: 'Blog nie ma skonfigurowanych kategorii.' });
	const chapter = z.object({
		at: z.number().int().nonnegative('Czas rozdziału to liczba sekund od początku filmu.'),
		title: z.string().trim().min(1, 'Tytuł rozdziału nie może być pusty.'),
	}).strict();
	const video = z.object({
		youtubeId: z.string().regex(/^[\w-]{11}$/, 'Identyfikator filmu YouTube ma 11 znaków.').optional(),
		duration: z.string().regex(/^\d+:\d{2}$/, 'Czas trwania w formacie m:ss.'),
		chapters: z.array(chapter).default([]),
	}).strict().superRefine((value, ctx) => {
		value.chapters.forEach((item, index) => {
			if (index === 0 && item.at !== 0) ctx.addIssue({ code: 'custom', message: 'Pierwszy rozdział musi zaczynać się w sekundzie 0.' });
			if (index > 0 && item.at <= value.chapters[index - 1].at) ctx.addIssue({ code: 'custom', message: `Rozdział „${item.title}” musi zaczynać się później niż poprzedni.` });
		});
	});
	return z.object({
		categories: z.array(category).refine((values) => new Set(values).size === values.length, 'Nie powtarzaj kategorii.').default([]),
		title: z.string().trim().min(1, 'Tytuł nie może być pusty.'),
		description: z.string().trim().min(1, 'Zajawka nie może być pusta.'),
		slug: z.string().regex(SLUG_PATTERN, 'Slug: małe litery a–z, cyfry i pojedyncze myślniki.'),
		pubDate: z.string().refine(isCalendarDate, 'Data musi być istniejącym dniem YYYY-MM-DD, zapisanym w cudzysłowie.'),
		video: video.optional(),
		cover: image().optional(),
		coverAlt: z.string().trim().min(1, 'Opis okładki nie może być pusty.').optional(),
		...extend,
	}).strict().refine((data: any) => !data.cover || data.coverAlt, { message: 'Okładka wymaga opisu coverAlt.', path: ['coverAlt'] });
}

type Post = {
	id: string;
	filePath?: string;
	data: { slug: string; pubDate: string };
};

/** Sprawdza daty (strefa Europe/Warsaw) i unikalność slugów, zwraca wpisy od najnowszego. Nie zmienia wejścia. */
export function validatePublishedPosts<T extends Post>(posts: readonly T[], today: string): T[] {
	if (!isCalendarDate(today)) throw new Error(`Niepoprawna data bieżąca: ${today}`);
	const slugs = new Map<string, string>();
	for (const post of posts) {
		const source = post.filePath ?? post.id;
		const { slug, pubDate } = post.data;
		if (!isCalendarDate(pubDate)) throw new Error(`${source}: pubDate musi być istniejącym dniem YYYY-MM-DD (jest: ${pubDate}).`);
		if (pubDate > today) {
			throw new Error(`${source}: przyszła data publikacji ${pubDate} (dziś w Warszawie: ${today}). Przenieś wpis do drafts/.`);
		}
		const previous = slugs.get(slug);
		if (previous) throw new Error(`Powtórzony slug „${slug}”: ${previous} oraz ${source}.`);
		slugs.set(slug, source);
	}
	return [...posts].sort((a, b) => {
		if (a.data.pubDate !== b.data.pubDate) return a.data.pubDate > b.data.pubDate ? -1 : 1;
		return a.data.slug < b.data.slug ? -1 : a.data.slug > b.data.slug ? 1 : 0;
	});
}
