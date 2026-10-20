export default {
	site: 'https://fixture.example',
	name: 'Blog Testowy',
	tagline: 'Strona do testów silnika',
	description: 'Przykładowa witryna z testów blog-silnik.',
	postsPath: 'wpisy',
	categories: { 'pierwsza': 'Pierwsza kategoria', 'druga': 'Druga kategoria', 'pusta': 'Pusta kategoria' },
	extendSchema: ({ z }) => ({ numer: z.number().int().positive().optional() }),
	nav: [{ label: 'Wpisy', href: '/wpisy/' }, { label: 'Dodatek', href: '/dodatek/' }],
	slots: { logo: './src/components/Logo.astro', afterPost: './src/components/AfterPost.astro' },
	theme: './src/styles/theme.css',
	addons: [{
		id: 'dodatek',
		routes: [{ pattern: '/dodatek', entrypoint: './src/addons/dodatek.astro' }],
		components: { Pozdrowienie: './src/addons/Pozdrowienie.astro' },
	}],
};
