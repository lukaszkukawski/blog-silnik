import assert from 'node:assert/strict';
import test from 'node:test';
import { mmss, planToc } from '../src/lib/video.ts';

const h2 = (text) => ({ depth: 2, slug: text.toLowerCase().replace(/\s+/g, '-'), text });
const headings = [h2('Wstęp'), { depth: 3, slug: 'pod', text: 'Podsekcja' }, h2('Środek'), h2('Dodatek'), h2('Koniec')];

test('mmss formatuje sekundy jako m:ss', () => {
	assert.equal(mmss(0), '0:00');
	assert.equal(mmss(9), '0:09');
	assert.equal(mmss(69), '1:09');
	assert.equal(mmss(681), '11:21');
});

test('spis: rozdział przy sekcji o tym samym tytule, reszta „tylko we wpisie”', () => {
	const items = planToc('wpis', headings, [{ at: 0, title: 'Wstęp' }, { at: 37, title: 'Środek' }, { at: 90, title: 'Koniec' }]);
	assert.deepEqual(items.map((i) => [i.text, i.time]), [['Wstęp', 0], ['Środek', 37], ['Dodatek', null], ['Koniec', 90]]);
});

test('spis bez rozdziałów ma wszystkie sekcje bez minut; podsekcje ### nie wchodzą', () => {
	const items = planToc('wpis', headings, []);
	assert.equal(items.length, 4);
	assert.ok(items.every((i) => i.time === null));
});

test('extraToc dokłada pozycje po wskazanej sekcji', () => {
	const items = planToc('wpis', headings, [{ at: 0, title: 'Wstęp' }], [{ id: 'test-na-zywo', label: 'Test na żywo', after: 2 }]);
	assert.deepEqual(items.map((i) => i.slug), ['wstęp', 'środek', 'test-na-zywo', 'dodatek', 'koniec']);
	assert.equal(items[2].extra, true);
});

test('błędy po polsku: za dużo rozdziałów, obcy tytuł, zła kolejność, pierwszy nie od zera', () => {
	const many = Array.from({ length: 5 }, (_, i) => ({ at: i * 10, title: `R${i}` }));
	assert.throws(() => planToc('w.mdx', headings, many), /w\.mdx: film ma 5 rozdziałów, a w treści jest tylko 4 nagłówków ##/);
	assert.throws(() => planToc('w.mdx', headings, [{ at: 0, title: 'Wstęp' }, { at: 5, title: 'Inny tytuł' }]), /tytuł rozdziału „Inny tytuł” nie jest równy żadnemu nagłówkowi/);
	assert.throws(() => planToc('w.mdx', headings, [{ at: 0, title: 'Środek' }, { at: 5, title: 'Wstęp' }]), /w złej kolejności/);
	assert.throws(() => planToc('w.mdx', headings, [{ at: 3, title: 'Wstęp' }]), /pierwszy rozdział musi zaczynać się w sekundzie 0/);
});
