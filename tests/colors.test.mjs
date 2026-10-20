import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);

test('w silniku nie ma kolorów na sztywno poza definicjami tokenów (--nazwa: #kolor)', () => {
	const offenders = [];
	for (const file of files(src).filter((f) => /\.(astro|css)$/.test(f))) {
		readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
			if (!/#[0-9a-fA-F]{3,6}\b/.test(line)) return;
			if (/^\s*--[\w-]+:\s*#[0-9a-fA-F]{3,6};/.test(line)) return;
			offenders.push(`${file.replace(src, 'src/')}:${i + 1}: ${line.trim()}`);
		});
	}
	assert.deepEqual(offenders, []);
});

test('rgb()/hsl() z liczbami też są tylko w tokenach', () => {
	const offenders = [];
	for (const file of files(src).filter((f) => /\.(astro|css)$/.test(f))) {
		readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
			if (/\b(?:rgb|hsl)a?\(\s*\d/.test(line) && !/^\s*--[\w-]+:/.test(line)) offenders.push(`${file}:${i + 1}`);
		});
	}
	assert.deepEqual(offenders, []);
});
