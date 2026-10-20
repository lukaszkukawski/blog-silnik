import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkPostImages, { validateImagePath, validatePostSource } from '../src/lib/remark-post-images.mjs';

function workspace(t) {
	const root = mkdtempSync(join(tmpdir(), 'post-images-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const posts = join(root, 'posts');
	const article = join(posts, 'article');
	mkdirSync(join(article, 'images'), { recursive: true });
	const source = join(article, 'index.md');
	writeFileSync(source, '');
	writeFileSync(join(article, 'image.png'), 'local image');
	writeFileSync(join(article, 'images', 'detail.png'), 'nested image');
	writeFileSync(join(root, 'draft.png'), 'private draft');
	return { root, posts, article, source };
}

test('local images must exist inside their article, including real symlink targets', (t) => {
	const { root, source, article } = workspace(t);
	assert.equal(validateImagePath('./image.png', source), './image.png');
	assert.equal(validateImagePath('images/detail.png', source), './images/detail.png');
	for (const url of ['https://example.com/a.png', '//example.com/a.png', '/draft.png', '../../draft.png', '%2e%2e/%2e%2e/draft.png', 'data:image/png;base64,x', 'file:///draft.png', '..\\draft.png', './image.png?raw', './image.png#part']) {
		assert.throws(() => validateImagePath(url, source), /index.md:/, url);
	}
	assert.throws(() => validateImagePath('./missing.png', source), /index.md: Brak pliku/);
	assert.throws(() => validateImagePath('./images', source), /nie jest plikiem/);
	symlinkSync(join(root, 'draft.png'), join(article, 'leak.png'));
	assert.throws(() => validateImagePath('./leak.png', source), /Symlink obrazu/);
	symlinkSync(join(article, 'image.png'), join(article, 'safe.png'));
	assert.equal(validateImagePath('./safe.png', source), './safe.png');
});

test('article source and directory cannot symlink outside published content', (t) => {
	const { root, posts, source } = workspace(t);
	assert.doesNotThrow(() => validatePostSource(source, posts));
	mkdirSync(join(root, 'draft'));
	writeFileSync(join(root, 'draft', 'index.md'), 'draft');
	symlinkSync(join(root, 'draft'), join(posts, 'linked'), 'dir');
	assert.throws(() => validatePostSource(join(posts, 'linked', 'index.md'), posts), /Symlink źródła/);
	mkdirSync(join(posts, 'linked-file'));
	symlinkSync(join(root, 'draft', 'index.md'), join(posts, 'linked-file', 'index.md'));
	assert.throws(() => validatePostSource(join(posts, 'linked-file', 'index.md'), posts), /Symlink źródła/);
});

async function renderer() {
	return createMarkdownProcessor({ remarkPlugins: [remarkPostImages], syntaxHighlight: false, smartypants: false });
}

test('caption is escaped text and the image remains in Astro image metadata', async (t) => {
	const { source } = workspace(t);
	const processor = await renderer();
	const { code, metadata } = await processor.render('Before ![Opis](./image.png "<b>Podpis</b> & tekst") after.', { fileURL: new URL(`file://${source}`) });
	assert.match(code, /<figure>[\s\S]*<img[\s\S]*<figcaption>&#x3C;b>Podpis&#x3C;\/b> &#x26; tekst<\/figcaption>[\s\S]*<\/figure>/);
	assert.doesNotMatch(code, /<p>\s*<figure>/);
	assert.deepEqual(metadata.localImagePaths, ['./image.png']);
	assert.match(code, /__ASTRO_IMAGE_/);
});

test('reference images, collapsed references and uncaptioned images use the same validation', async (t) => {
	t.mock.method(console, 'error', () => {}); // Renderer logs expected rejection errors.
	const { source } = workspace(t);
	const processor = await renderer();
	for (const body of ['![Opis][photo]\n\n[photo]: ./image.png "Podpis"', '![photo][]\n\n[photo]: ./image.png "Podpis"', '![photo]\n\n[photo]: ./image.png "Podpis"']) {
		const { code, metadata } = await processor.render(body, { fileURL: new URL(`file://${source}`) });
		assert.match(code, /<figcaption>Podpis<\/figcaption>/);
		assert.deepEqual(metadata.localImagePaths, ['./image.png']);
	}
	const { code } = await processor.render('![Opis](./image.png)', { fileURL: new URL(`file://${source}`) });
	assert.match(code, /<img/);
	assert.doesNotMatch(code, /figure/);
	await assert.rejects(processor.render('![Opis][private]\n\n[private]: ../../draft.png', { fileURL: new URL(`file://${source}`) }), /poza katalog/);
});

test('empty alt and raw HTML media fail, while code examples remain readable', async (t) => {
	t.mock.method(console, 'error', () => {});
	const { source } = workspace(t);
	const processor = await renderer();
	for (const body of ['![](./image.png)', '![  ](./image.png)', '![][photo]\n\n[photo]: ./image.png']) {
		await assert.rejects(processor.render(body, { fileURL: new URL(`file://${source}`) }), /tekst.*alternatywn/);
	}
	for (const body of ['<img src="./image.png" alt="x">', '<picture></picture>', '<video poster="/draft.png"></video>', '<svg><image href="/draft.png"/></svg>', '<div style="background:url(/draft.png)"></div>']) {
		await assert.rejects(processor.render(body, { fileURL: new URL(`file://${source}`) }), /Surowy HTML/);
	}
	await assert.doesNotReject(processor.render('`<img src="/example.png">`\n\n```html\n<img src="/example.png">\n```', { fileURL: new URL(`file://${source}`) }));
});

test('captions also work inside links, emphasis and table cells', async (t) => {
	const { source } = workspace(t);
	const processor = await renderer();
	for (const body of ['Before [![Opis](./image.png "Podpis")](https://example.com) after.', '*![Opis](./image.png "Podpis")*', '| Obraz |\n| --- |\n| ![Opis](./image.png "Podpis") |']) {
		const { code, metadata } = await processor.render(body, { fileURL: pathToFileURL(source) });
		assert.match(code, /<figure>[\s\S]*<figcaption>Podpis<\/figcaption>[\s\S]*<\/figure>/);
		assert.doesNotMatch(code, /<(?:p|a|em)[^>]*>\s*<figure>/);
		assert.deepEqual(metadata.localImagePaths, ['./image.png']);
		if (body.includes('example.com')) assert.match(code, /<figure><a href="https:\/\/example.com"><img/);
	}
});

test('wpis musi leżeć w <wpis>/index.md albo index.mdx', (t) => {
	const { posts, article } = workspace(t);
	writeFileSync(join(article, 'index.mdx'), '');
	assert.doesNotThrow(() => validatePostSource(join(article, 'index.mdx'), posts));
	writeFileSync(join(article, 'inny.md'), '');
	assert.throws(() => validatePostSource(join(article, 'inny.md'), posts), /index\.mdx/);
});
