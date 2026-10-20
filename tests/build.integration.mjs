import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env as zmienneSrodowiska } from 'node:process';
import test from 'node:test';

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const engine = fileURLToPath(new URL('../', import.meta.url));
let counter = 0;

// Kopia przykładowej witryny w tests/fixtures/work-N (ta sama głębokość co `site`, więc ścieżki do silnika działają).
function workspace(t) {
	const root = join(fixtures, `work-${process.pid}-${++counter}`);
	cpSync(join(fixtures, 'site'), root, { recursive: true, filter: (src) => !/[\\/](dist|\.astro)$/.test(src) });
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const posts = join(root, 'src/content/posts');
	const write = (name, source, file = 'index.mdx') => {
		mkdirSync(join(posts, name), { recursive: true });
		writeFileSync(join(posts, name, file), source);
	};
	const edit = (name, change) => {
		const path = join(posts, name, 'index.mdx');
		writeFileSync(path, change(readFileSync(path, 'utf8')));
	};
	const build = () => {
		const result = spawnSync(process.execPath, [join(engine, 'node_modules/astro/bin/astro.mjs'), 'build'], {
			cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
			env: { ...zmienneSrodowiska, ASTRO_TELEMETRY_DISABLED: '1' },
		});
		assert.ifError(result.error);
		return { status: result.status, output: result.stdout + result.stderr };
	};
	return { root, posts, write, edit, build, dist: (path) => readFileSync(join(root, 'dist', path), 'utf8') };
}

const post = (extra = '', body = '## Sekcja\n\nTreść.\n') =>
	`---\ntitle: "Próba"\ndescription: "Opis"\nslug: proba\npubDate: "2026-09-01"\n${extra}---\n\n${body}`;

function fails(result, reason) {
	assert.notEqual(result.status, 0, 'build powinien się przerwać:\n' + result.output);
	assert.match(result.output, reason);
}

test('przykładowa witryna buduje się: wpisy, kategorie, RSS, sitemap, 404, dodatek', (t) => {
	const w = workspace(t);
	const result = w.build();
	assert.equal(result.status, 0, result.output);
	for (const path of ['index.html', '404.html', 'wpisy/index.html', 'wpisy/demo-wideo/index.html', 'wpisy/demo-bez-wideo/index.html',
		'wpisy/demo-premiera/index.html', 'kategorie/pierwsza/index.html', 'kategorie/pusta/index.html', 'rss.xml', 'sitemap-index.xml', 'dodatek/index.html']) {
		assert.ok(existsSync(join(w.root, 'dist', path)), path);
	}
	assert.match(w.dist('rss.xml'), /https:\/\/fixture\.example\/wpisy\/demo-wideo\//);
	assert.match(w.dist('kategorie/pusta/index.html'), /Nie ma jeszcze wpisów w tej kategorii/);
	assert.match(w.dist('dodatek/index.html'), /Trasa dodatku/);
	assert.match(w.dist('wpisy/demo-wideo/index.html'), /class="pozdrowienie"/, 'komponent MDX z dodatku działa bez importu');
	assert.match(w.dist('index.html'), /logo-test/, 'logo z slotu bloga');
});

test('wpis z filmem: odtwarzacz, spis z minutami, „tylko we wpisie”, canonical i OG', (t) => {
	const w = workspace(t);
	assert.equal(w.build().status, 0);
	const html = w.dist('wpisy/demo-wideo/index.html');
	assert.match(html, /<title>Wpis z filmem \| Blog Testowy<\/title>/);
	assert.match(html, /rel="canonical" href="https:\/\/fixture\.example\/wpisy\/demo-wideo\/"/);
	assert.match(html, /data-id="abc123XYZ09"/);
	assert.doesNotMatch(html, /<iframe/, 'iframe YouTube ładuje się dopiero po kliknięciu');
	assert.deepEqual([...html.matchAll(/data-chapter-at="(\d+)"/g)].map((m) => m[1]), ['0', '41', '120']);
	assert.match(html, /href="https:\/\/www\.youtube\.com\/watch\?v=abc123XYZ09&amp;t=41s"/);
	assert.match(html, /time-none[^>]*>·<\/span><a class="toc-link" href="#dodatek-tylko-we-wpisie"/);
	assert.match(html, /<figure>.*<figcaption>Podpis pod obrazem<\/figcaption><\/figure>/s);
	assert.match(html, /class="reading-scroll"/);
});

test('wpis bez filmu nie ma odtwarzacza ani spisu; przed premierą jest plakietka i okładka w OG', (t) => {
	const w = workspace(t);
	assert.equal(w.build().status, 0);
	const plain = w.dist('wpisy/demo-bez-wideo/index.html');
	assert.doesNotMatch(plain, /data-video|data-toc/);
	const soon = w.dist('wpisy/demo-premiera/index.html');
	assert.match(soon, /Premiera wkrótce/);
	assert.doesNotMatch(soon, /data-chapter-at="/);
	assert.match(soon, /og:image" content="https:\/\/fixture\.example\/_astro\//);
});

test('szkice w drafts/ i pliki poza src/content/posts nie trafiają do buildu', (t) => {
	const w = workspace(t);
	mkdirSync(join(w.root, 'drafts/tajny'), { recursive: true });
	writeFileSync(join(w.root, 'drafts/tajny/index.mdx'), post('', 'SZKIC_TAJNY_71\n').replace('slug: proba', 'slug: tajny'));
	assert.equal(w.build().status, 0);
	assert.ok(!existsSync(join(w.root, 'dist/wpisy/tajny')));
	assert.doesNotMatch(w.dist('rss.xml'), /tajny/);
});

test('data z przyszłości przerywa build i wskazuje plik', (t) => {
	const w = workspace(t);
	w.write('przyszly', post().replace('2026-09-01', '2999-01-01').replace('slug: proba', 'slug: przyszly'));
	fails(w.build(), /przyszly\/index\.mdx.*przyszła data publikacji 2999-01-01/s);
});

test('nieznana kategoria przerywa build', (t) => {
	const w = workspace(t);
	w.write('zla-kategoria', post('categories: [nie-ma-takiej]\n'));
	fails(w.build(), /nie-ma-takiej|categories/);
});

test('powtórzony slug przerywa build i podaje oba pliki', (t) => {
	const w = workspace(t);
	w.write('kopia', post().replace('slug: proba', 'slug: demo-bez-wideo'));
	fails(w.build(), /Powtórzony slug „demo-bez-wideo”.*(kopia|demo-bez-wideo)\/index\.mdx/s);
});

test('nieznane pole front matter przerywa build (schemat ścisły)', (t) => {
	const w = workspace(t);
	w.write('nieznane', post('draft: true\n'));
	fails(w.build(), /draft/);
});

test('tytuł rozdziału różny od nagłówka ## przerywa build', (t) => {
	const w = workspace(t);
	w.edit('demo-wideo', (s) => s.replace('title: "Jak to działa"', 'title: "Jak to nie działa"'));
	fails(w.build(), /tytuł rozdziału „Jak to nie działa” nie jest równy żadnemu nagłówkowi ##/);
});

test('więcej rozdziałów niż nagłówków ## przerywa build', (t) => {
	const w = workspace(t);
	w.write('za-duzo', post('video:\n  duration: "1:00"\n  chapters:\n    - { at: 0, title: "Sekcja" }\n    - { at: 10, title: "B" }\n    - { at: 20, title: "C" }\n'));
	fails(w.build(), /film ma 3 rozdziałów, a w treści jest tylko 1 nagłówków ##/);
});

test('pierwszy rozdział inny niż at: 0 przerywa build', (t) => {
	const w = workspace(t);
	w.edit('demo-wideo', (s) => s.replace('{ at: 0, title: "Wstęp" }', '{ at: 4, title: "Wstęp" }'));
	fails(w.build(), /Pierwszy rozdział musi zaczynać się w sekundzie 0/);
});

test('obraz spoza katalogu wpisu, symlink i brakujący plik przerywają build', (t) => {
	const w = workspace(t);
	writeFileSync(join(w.root, 'poza.png'), 'x');
	w.write('obraz-poza', post('', '![Opis](../../../../poza.png)\n'));
	fails(w.build(), /obraz-poza\/index\.mdx.*Obraz wychodzi poza katalog artykułu/s);
	rmSync(join(w.posts, 'obraz-poza'), { recursive: true });
	w.write('brak', post('', '![Opis](./nie-ma.png)\n'));
	fails(w.build(), /Brak pliku obrazu/);
	rmSync(join(w.posts, 'brak'), { recursive: true });
	w.write('sym', post('', '![Opis](./wyciek.png)\n'));
	symlinkSync(join(w.root, 'poza.png'), join(w.posts, 'sym', 'wyciek.png'));
	fails(w.build(), /Symlink obrazu/);
});

test('surowy znacznik medium w MDX przerywa build, komponent z wielkiej litery przechodzi', (t) => {
	const w = workspace(t);
	w.write('surowy', post('', '<img src="/x.png" alt="x" />\n'));
	fails(w.build(), /Surowy HTML mediów/);
	rmSync(join(w.posts, 'surowy'), { recursive: true });
	w.write('komponent', post('', '## Sekcja\n\nTekst.\n'));
	assert.equal(w.build().status, 0);
});
