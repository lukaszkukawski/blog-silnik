import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeConfig, publicConfig } from '../src/config.mjs';

const ok = { site: 'https://przyklad.pl', name: 'Blog', categories: { a: 'A' } };

test('minimalna konfiguracja dostaje wartości domyślne', () => {
	const c = normalizeConfig(ok);
	assert.equal(c.postsPath, 'blog');
	assert.equal(c.lang, 'pl');
	assert.equal(c.site, 'https://przyklad.pl');
	assert.equal(c.listPage, true);
});

test('brak `site` przerywa z komunikatem po polsku', () => {
	assert.throws(() => normalizeConfig({ name: 'Blog' }), /pole `site` jest wymagane/);
	assert.throws(() => normalizeConfig({ ...ok, site: 'nie-adres' }), /nie jest poprawnym adresem/);
	assert.throws(() => normalizeConfig({ ...ok, site: 'ftp://x.pl' }), /https/);
});

test('niepoprawne pola kończą się błędem', () => {
	assert.throws(() => normalizeConfig({ ...ok, name: '' }), /`name`/);
	assert.throws(() => normalizeConfig({ ...ok, postsPath: 'Duże/Litery' }), /postsPath/);
	assert.throws(() => normalizeConfig({ ...ok, postsPath: 'kategorie' }), /kategorie/);
	assert.throws(() => normalizeConfig({ ...ok, categories: { 'Zły Id': 'A' } }), /niepoprawny identyfikator/);
	assert.throws(() => normalizeConfig({ ...ok, categories: { a: '' } }), /musi mieć nazwę/);
	assert.throws(() => normalizeConfig({ ...ok, extendSchema: {} }), /extendSchema/);
	assert.throws(() => normalizeConfig({ ...ok, nav: [{ label: 'x' }] }), /label.*href/);
});

test('dodatek może mieć tylko trasy i komponenty, nie zmienia schematu', () => {
	assert.doesNotThrow(() => normalizeConfig({ ...ok, addons: [{ id: 'pracownia', routes: [{ pattern: '/pracownia', entrypoint: './x.astro' }], components: {} }] }));
	assert.throws(() => normalizeConfig({ ...ok, addons: [{ id: 'pracownia', schema: {} }] }), /nie jest dozwolone/);
	assert.throws(() => normalizeConfig({ ...ok, addons: [{ id: 'a' }, { id: 'a' }] }), /dwa razy/);
	assert.throws(() => normalizeConfig({ ...ok, addons: [{ id: 'a', routes: [{ pattern: '/a' }] }] }), /pattern.*entrypoint/);
});

test('publicConfig nie zawiera funkcji ani ścieżek do plików', () => {
	const pub = publicConfig(normalizeConfig({ ...ok, extendSchema: () => ({}), theme: './t.css', slots: { logo: './l.astro' } }));
	assert.deepEqual(Object.keys(pub).sort(), ['categories', 'description', 'lang', 'listPage', 'name', 'nav', 'postsPath', 'site', 'tagline']);
});
