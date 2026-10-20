import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import config from 'virtual:blog-silnik/config';
import { getPublishedPosts } from '../lib/posts.ts';

export async function GET(context: APIContext) {
	const posts = await getPublishedPosts();
	return rss({
		title: config.name,
		description: config.description || config.tagline || config.name,
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			link: `/${config.postsPath}/${post.data.slug}/`,
			pubDate: new Date(`${post.data.pubDate}T12:00:00Z`),
		})),
		customData: `<language>${config.lang}</language>`,
	});
}
