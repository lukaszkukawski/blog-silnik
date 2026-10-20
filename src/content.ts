import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { fileURLToPath } from 'node:url';
import { buildPostSchema } from './lib/post-rules.ts';
import { validateImagePath, validatePostSource } from './lib/remark-post-images.mjs';

/**
 * Kolekcja wpisów dla `src/content.config.ts` bloga:
 *   export const collections = definePosts(siteConfig, import.meta.url);
 * Wpisy leżą w `src/content/posts/<slug>/index.mdx` (albo index.md); szkice w `drafts/` nigdy nie trafiają do buildu.
 */
export function definePosts(config: { categories: Record<string, string>; extendSchema?: (ctx: any) => Record<string, any> }, contentConfigUrl: string) {
	const postsRoot = new URL('./content/posts/', contentConfigUrl);
	const sourceLoader = glob({
		pattern: '*/index.{md,mdx}',
		base: postsRoot,
		generateId: ({ entry }) => entry.replace(/\/index\.mdx?$/, ''),
	});

	const posts = defineCollection({
		schema: ({ image }) => buildPostSchema(z, {
			categoryIds: Object.keys(config.categories),
			image,
			extend: config.extendSchema?.({ z, image }),
		}),
		loader: {
			name: 'validated-posts',
			async load(context) {
				// glob zapisuje błędy Markdown w logu zamiast je rzucać. Odrzucamy niekompletny wpis w store.set.
				await sourceLoader.load({
					...context,
					store: {
						...context.store,
						set(entry) {
							if (!entry.rendered && !entry.filePath?.endsWith('.mdx')) {
								throw new Error(`${entry.filePath ?? entry.id}: renderowanie Markdown nie powiodło się. Popraw błąd podany powyżej.`);
							}
							return context.store.set(entry);
						},
					},
				});
				// Wpis z cache może wskazywać usunięty plik albo podmieniony symlink: granice sprawdzamy za każdym razem.
				for (const entry of context.store.values()) {
					const source = fileURLToPath(new URL(entry.filePath!, context.config.root));
					validatePostSource(source, fileURLToPath(postsRoot));
					if (source.endsWith('.mdx')) continue; // obrazy MDX waliduje wtyczka remark przy kompilacji strony
					if (!entry.rendered) throw new Error(`${source}: brak poprawnie wyrenderowanej treści.`);
					for (const image of entry.rendered.metadata?.imagePaths ?? []) validateImagePath(image, source);
				}
			},
		},
	});

	return { posts };
}
