// Konfiguracja witryny: jedno miejsce, z którego korzystają astro.config.mjs i src/content.config.ts bloga.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) {
	throw new Error(`blog-silnik: ${message}`);
}

/**
 * Sprawdza i uzupełnia konfigurację bloga. Funkcja czysta (bez dostępu do dysku), więc łatwa do przetestowania.
 * Ścieżki do plików (`theme`, `slots`, `addons`) zostają takie, jakie podał blog, a rozwiązuje je integracja.
 */
export function normalizeConfig(input = {}) {
	const { site, name, tagline = '', description = '', lang = 'pl', postsPath = 'blog', categories = {}, extendSchema, nav = [],
		slots = {}, theme, addons = [], listPage = true } = input;
	if (!site || typeof site !== 'string') fail('pole `site` jest wymagane (np. site: \'https://moj-blog.pl\'). Bez niego nie powstaną adresy canonical, sitemap ani RSS.');
	let origin;
	try {
		origin = new URL(site);
	} catch {
		fail(`pole \`site\` nie jest poprawnym adresem: ${site}`);
	}
	if (!/^https?:$/.test(origin.protocol)) fail(`pole \`site\` musi zaczynać się od https://: ${site}`);
	if (!name || typeof name !== 'string') fail('pole `name` (nazwa bloga) jest wymagane.');
	if (!SLUG.test(postsPath)) fail(`pole \`postsPath\` ma niepoprawny format: „${postsPath}” (małe litery, cyfry, myślniki; np. blog albo odcinki).`);
	if (postsPath === 'kategorie') fail('`postsPath` nie może być „kategorie”: ten adres zajmują strony kategorii.');
	if (typeof categories !== 'object' || Array.isArray(categories) || categories === null) fail('pole `categories` to obiekt { id: \'Nazwa\' }.');
	for (const [id, label] of Object.entries(categories)) {
		if (!SLUG.test(id)) fail(`kategoria „${id}” ma niepoprawny identyfikator (małe litery, cyfry, myślniki).`);
		if (typeof label !== 'string' || !label.trim()) fail(`kategoria „${id}” musi mieć nazwę.`);
	}
	if (extendSchema !== undefined && typeof extendSchema !== 'function') fail('`extendSchema` to funkcja ({ z, image }) => ({ pole: z… }).');
	if (!Array.isArray(nav)) fail('`nav` to lista { label, href }.');
	for (const item of nav) if (!item?.label || !item?.href) fail('każda pozycja `nav` wymaga `label` i `href`.');
	const ids = new Set();
	for (const addon of addons) {
		if (!addon?.id || !SLUG.test(addon.id)) fail('każdy dodatek wymaga `id` (małe litery, cyfry, myślniki).');
		if (ids.has(addon.id)) fail(`dodatek „${addon.id}” jest zarejestrowany dwa razy.`);
		ids.add(addon.id);
		for (const key of Object.keys(addon)) {
			if (!['id', 'routes', 'components'].includes(key)) fail(`dodatek „${addon.id}”: pole „${key}” nie jest dozwolone. Dodatek może mieć tylko \`routes\` i \`components\` (schemat zmienia się wyłącznie przez extendSchema).`);
		}
		for (const route of addon.routes ?? []) if (!route?.pattern || !route?.entrypoint) fail(`dodatek „${addon.id}”: trasa wymaga \`pattern\` i \`entrypoint\`.`);
	}
	return {
		site: origin.origin + origin.pathname.replace(/\/$/, ''), name, tagline, description, lang, postsPath, categories, extendSchema,
		nav, slots, theme, addons, listPage,
	};
}

/** Część konfiguracji, którą wolno przekazać do przeglądarki i szablonów (bez funkcji i ścieżek do plików). */
export function publicConfig(config) {
	const { site, name, tagline, description, lang, postsPath, categories, nav, listPage } = config;
	return { site, name, tagline, description, lang, postsPath, categories, nav, listPage };
}
