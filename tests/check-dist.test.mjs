import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDist } from '../scripts/lib/check-dist.mjs';

function site(t, pages) {
	const dist = mkdtempSync(join(tmpdir(), 'dist-'));
	t.after(() => rmSync(dist, { recursive: true, force: true }));
	for (const file of ['sitemap-index.xml', 'rss.xml', '404.html']) writeFileSync(join(dist, file), '');
	for (const [path, html] of Object.entries(pages)) {
		mkdirSync(join(dist, path), { recursive: true });
		writeFileSync(join(dist, path, 'index.html'), html);
	}
	return dist;
}

test('poprawna witryna nie ma problemów; zewnętrzne linki i mailto są pomijane', (t) => {
	const dist = site(t, {
		'.': '<a href="/blog/">x</a><a href="https://example.com/nie">y</a><a href="mailto:a@b.pl">m</a>',
		blog: '<h2 id="cel">Cel</h2><a href="#cel">tu</a><a href="/blog/#cel">tam</a><a href="/">home</a>',
	});
	assert.deepEqual(checkDist(dist), []);
});

test('zepsute linki, kotwice i brakujące pliki są zgłaszane po polsku', (t) => {
	const dist = site(t, { '.': '<a href="/nie-ma/">x</a><a href="#brak">y</a><img src="/a.png">', blog: '<a href="/#obcy">z</a>' });
	const problems = checkDist(dist).join('\n');
	assert.match(problems, /link do nieistniejącej strony lub pliku: \/nie-ma\//);
	assert.match(problems, /kotwica #brak/);
	assert.match(problems, /\/a\.png/);
	assert.match(problems, /kotwica #obcy/);
});

test('brak sitemap lub RSS jest problemem', (t) => {
	const dist = mkdtempSync(join(tmpdir(), 'dist-'));
	t.after(() => rmSync(dist, { recursive: true, force: true }));
	assert.match(checkDist(dist).join('\n'), /sitemap-index\.xml/);
});
