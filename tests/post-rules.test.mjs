import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'astro/zod';
import { buildPostSchema, isCalendarDate, validatePublishedPosts, warsawToday } from '../src/lib/post-rules.ts';

const postSchema = buildPostSchema(z, { categoryIds: ['podstawy', 'praktyka'], image: () => z.string(), extend: { numer: z.number().int().positive().optional() } });
const data = { title: 'Pierwszy wpis', description: 'Zajawka autora', slug: 'pierwszy-wpis', pubDate: '2026-09-25' };
const entry = (slug, pubDate, id = slug) => ({ id, filePath: `src/content/posts/${id}/index.mdx`, data: { ...data, categories: [], slug, pubDate } });

test('daty kalendarzowe: prawdziwe dni, lata przestępne, dokładny format', () => {
	for (const value of ['2024-02-29', '2000-02-29', '2026-09-25', '0001-01-01']) assert.equal(isCalendarDate(value), true, value);
	for (const value of ['2026-02-30', '2025-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-1-01', '0000-01-01', '2026-09-25T00:00:00Z']) {
		assert.equal(isCalendarDate(value), false, value);
	}
	assert.equal(postSchema.safeParse({ ...data, pubDate: new Date('2026-09-25') }).success, false);
});

test('metadane odrzucają puste teksty, złe slugi, brakujące i nieznane pola', () => {
	assert.equal(postSchema.safeParse(data).success, true);
	for (const slug of ['', 'Duzy', 'zażółć', 'a--b', '-a', 'a-', '../a', 'a/b', ' a']) {
		assert.equal(postSchema.safeParse({ ...data, slug }).success, false, slug);
	}
	for (const field of Object.keys(data)) {
		const incomplete = { ...data };
		delete incomplete[field];
		assert.equal(postSchema.safeParse(incomplete).success, false, field);
	}
	for (const field of ['title', 'description']) assert.equal(postSchema.safeParse({ ...data, [field]: ' \n\t' }).success, false);
	for (const field of ['draft', 'updatedDate', 'nieznane']) assert.equal(postSchema.safeParse({ ...data, [field]: 'x' }).success, false, field);
});

test('kategorie: znane, bez duplikatów, bez literówek; domyślnie puste', () => {
	assert.deepEqual(postSchema.parse(data).categories, []);
	assert.deepEqual(postSchema.parse({ ...data, categories: ['podstawy', 'praktyka'] }).categories, ['podstawy', 'praktyka']);
	for (const value of [['literowka'], ['podstawy', 'podstawy'], 'podstawy', [12]]) {
		assert.equal(postSchema.safeParse({ ...data, categories: value }).success, false, JSON.stringify(value));
	}
});

test('extendSchema dodaje pola bloga, ale nie nadpisuje pól silnika', () => {
	assert.equal(postSchema.parse({ ...data, numer: 3 }).numer, 3);
	assert.equal(postSchema.safeParse({ ...data, numer: 0 }).success, false);
	assert.throws(() => buildPostSchema(z, { categoryIds: [], image: () => z.string(), extend: { title: z.string() } }), /należy do silnika/);
});

test('video: identyfikator, czas trwania, rozdziały od 0 i rosnące', () => {
	const video = { duration: '5:12', chapters: [{ at: 0, title: 'Wstęp' }, { at: 41, title: 'Dalej' }] };
	assert.equal(postSchema.safeParse({ ...data, video }).success, true);
	assert.equal(postSchema.safeParse({ ...data, video: { ...video, youtubeId: 'abc123XYZ09' } }).success, true);
	assert.equal(postSchema.safeParse({ ...data, video: { duration: '5:12' } }).success, true);
	const bad = [
		{ ...video, youtubeId: 'krotki' },
		{ ...video, duration: '512' },
		{ ...video, chapters: [{ at: 5, title: 'Wstęp' }] },
		{ ...video, chapters: [{ at: 0, title: 'A' }, { at: 0, title: 'B' }] },
		{ ...video, chapters: [{ at: 0, title: 'A' }, { at: 30, title: 'B' }, { at: 20, title: 'C' }] },
		{ ...video, chapters: [{ at: 0, title: '  ' }] },
		{ ...video, chapters: [{ at: 0.5, title: 'A' }] },
		{ ...video, rozdzialy: [] },
	];
	for (const value of bad) assert.equal(postSchema.safeParse({ ...data, video: value }).success, false, JSON.stringify(value));
});

test('okładka wymaga opisu', () => {
	assert.equal(postSchema.safeParse({ ...data, cover: './a.png' }).success, false);
	assert.equal(postSchema.safeParse({ ...data, cover: './a.png', coverAlt: 'Opis' }).success, true);
});

test('dziś przechodzi; jutro nie, z podanym źródłem i powodem', () => {
	const today = entry('today', '2026-09-25');
	assert.deepEqual(validatePublishedPosts([today], '2026-09-25'), [today]);
	assert.throws(() => validatePublishedPosts([entry('future', '2026-09-26')], '2026-09-25'), /future\/index.mdx.*przyszła data.*2026-09-26/);
	assert.throws(() => validatePublishedPosts([entry('invalid', '2026-02-30')], '2026-09-25'), /invalid\/index.mdx.*pubDate/s);
});

test('dzień w Warszawie zmienia się wcześniej niż w UTC, latem i zimą', () => {
	assert.equal(warsawToday(new Date('2026-06-10T21:59:59Z')), '2026-06-10');
	assert.equal(warsawToday(new Date('2026-06-10T22:00:00Z')), '2026-06-11');
	assert.equal(warsawToday(new Date('2026-01-10T22:59:59Z')), '2026-01-10');
	assert.equal(warsawToday(new Date('2026-01-10T23:00:00Z')), '2026-01-11');
	assert.doesNotThrow(() => validatePublishedPosts([entry('today', '2026-06-11')], warsawToday(new Date('2026-06-10T22:00:00Z'))));
});

test('powtórzone slugi podają oba pliki', () => {
	assert.throws(() => validatePublishedPosts([entry('same', '2026-09-24', 'one'), entry('same', '2026-09-25', 'two')], '2026-09-25'),
		/Powtórzony slug.*same.*one\/index.mdx.*two\/index.mdx/);
});

test('od najnowszego, przy remisie slug rosnąco, bez zmiany wejścia', () => {
	const posts = [entry('z', '2026-09-25'), entry('older', '2026-09-24'), entry('a', '2026-09-25')];
	assert.deepEqual(validatePublishedPosts(posts, '2026-09-25').map((post) => post.data.slug), ['a', 'z', 'older']);
	assert.deepEqual(posts.map((post) => post.data.slug), ['z', 'older', 'a']);
	assert.deepEqual(validatePublishedPosts([], '2026-09-25'), []);
});
