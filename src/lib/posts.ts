import { getCollection } from 'astro:content';
import { validatePublishedPosts, warsawToday } from './post-rules.ts';

/** Jedyny publiczny odczyt wpisów: sprawdza datę (Europe/Warsaw) przy każdym wywołaniu, także przy cache treści. */
export async function getPublishedPosts() {
	return validatePublishedPosts(await getCollection('posts'), warsawToday(new Date()));
}
