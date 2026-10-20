import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { normalizeConfig, publicConfig } from './config.mjs';
import remarkPostImages from './lib/remark-post-images.mjs';
import rehypeReadingBlocks from './lib/rehype-reading-blocks.mjs';

export { normalizeConfig } from './config.mjs';

const VIRTUAL = ['config', 'slots', 'theme', 'components'];

function virtualModules(files) {
	const ids = new Map(VIRTUAL.map((name) => [`virtual:blog-silnik/${name}`, `\0virtual:blog-silnik/${name}`]));
	const abs = (path) => JSON.stringify(path);
	return {
		name: 'blog-silnik:virtual',
		resolveId: (id) => ids.get(id),
		load(id) {
			if (id === ids.get('virtual:blog-silnik/config')) return `export default ${JSON.stringify(files.config)};`;
			if (id === ids.get('virtual:blog-silnik/theme')) return files.theme ? `import ${abs(files.theme)};` : 'export {};';
			if (id === ids.get('virtual:blog-silnik/slots')) {
				const lines = Object.entries(files.slots).map(([key, path], i) => `import slot${i} from ${abs(path)};`);
				const body = Object.keys(files.slots).map((key, i) => `${JSON.stringify(key)}: slot${i}`).join(', ');
				return `${lines.join('\n')}\nexport default { ${body} };`;
			}
			if (id === ids.get('virtual:blog-silnik/components')) {
				const entries = Object.entries(files.components);
				const lines = entries.map(([, path], i) => `import component${i} from ${abs(path)};`);
				const body = entries.map(([name], i) => `${JSON.stringify(name)}: component${i}`).join(', ');
				return `${lines.join('\n')}\nexport default { ${body} };`;
			}
		},
	};
}

/**
 * Integracja Astro: `integrations: [blogSilnik({ site, name, … })]`.
 * Zwraca listę integracji (MDX, sitemap i silnik), więc blog nie dodaje ich osobno.
 */
export default function blogSilnik(input) {
	const config = normalizeConfig(input);
	const engine = {
		name: 'blog-silnik',
		hooks: {
			'astro:config:setup': ({ config: astro, updateConfig, injectRoute, logger }) => {
				// Adres endpointu obrazów w trybie dev powstaje przed scaleniem ustawień z integracji, więc bez tego ustawienia
				// w astro.config.mjs obrazy z wpisów dają 404 w `npm run dev`. Wymuszamy je zamiast zgadywać.
				if (astro.trailingSlash !== 'always') {
					throw new Error("blog-silnik: dodaj do astro.config.mjs `trailingSlash: 'always'` (oraz `build: { format: 'directory' }`). Bez tego obrazy we wpisach nie wczytują się w trybie dev.");
				}
				const root = fileURLToPath(astro.root);
				const rel = (path) => resolve(root, path);
				const slots = Object.fromEntries(Object.entries(config.slots).filter(([, path]) => path).map(([key, path]) => [key, rel(path)]));
				const components = {};
				for (const addon of config.addons) {
					for (const [name, path] of Object.entries(addon.components ?? {})) {
						if (components[name]) throw new Error(`blog-silnik: komponent MDX „${name}” rejestrują dwa dodatki.`);
						components[name] = rel(path);
					}
				}
				const postsRoot = fileURLToPath(new URL('./content/posts/', astro.srcDir));
				updateConfig({
					site: config.site,
					output: 'static',
					trailingSlash: 'always',
					build: { format: 'directory' },
					markdown: {
						processor: unified({
							remarkPlugins: [[remarkPostImages, { postsRoot }]],
							rehypePlugins: [rehypeReadingBlocks],
						}),
					},
					vite: {
						plugins: [virtualModules({ config: publicConfig(config), slots, theme: config.theme && rel(config.theme), components })],
						ssr: { noExternal: ['blog-silnik'] },
					},
				});

				const page = (name) => new URL(`./pages/${name}`, import.meta.url);
				if (config.listPage) injectRoute({ pattern: `/${config.postsPath}`, entrypoint: page('list.astro') });
				injectRoute({ pattern: `/${config.postsPath}/[slug]`, entrypoint: page('post.astro') });
				if (Object.keys(config.categories).length) injectRoute({ pattern: '/kategorie/[category]', entrypoint: page('category.astro') });
				injectRoute({ pattern: '/rss.xml', entrypoint: page('rss.xml.ts') });
				injectRoute({ pattern: '/404', entrypoint: page('404.astro') });
				for (const addon of config.addons) {
					for (const route of addon.routes ?? []) injectRoute({ pattern: route.pattern, entrypoint: pathToEntry(route.entrypoint, root) });
				}
				logger.info(`${config.name}: ${config.site}, wpisy pod /${config.postsPath}/`);
			},
		},
	};
	return [mdx(), sitemap(), engine];
}

// Dodatek podaje ścieżkę względem projektu bloga; nazwy pakietów (bez ./ i /) zostają bez zmian.
function pathToEntry(entrypoint, root) {
	return /^[./]/.test(entrypoint) ? resolve(root, entrypoint) : entrypoint;
}
