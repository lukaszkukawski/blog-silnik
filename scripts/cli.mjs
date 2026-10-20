#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env as zmienneSrodowiska } from 'node:process';
import { checkDist } from './lib/check-dist.mjs';

const engine = fileURLToPath(new URL('../', import.meta.url));
const [command] = process.argv.slice(2);

function run(label, args, cwd) {
	console.log(`\n▶ ${label}`);
	const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: { ...zmienneSrodowiska, ASTRO_TELEMETRY_DISABLED: '1' } });
	if (result.error) throw result.error;
	if (result.status !== 0) {
		console.error(`\n✖ Nie przeszło: ${label}`);
		process.exit(result.status ?? 1);
	}
}

function astroBin(from) {
	for (const base of [from, engine]) {
		const bin = join(base, 'node_modules/astro/bin/astro.mjs');
		if (existsSync(bin)) return bin;
	}
	console.error('Nie znaleziono Astro. Uruchom najpierw npm ci.');
	process.exit(1);
}

function verifySite(root) {
	run('build produkcyjny (schemat, daty, kategorie, obrazy, rozdziały)', [astroBin(root), 'build'], root);
	console.log('\n▶ linki wewnętrzne, sitemap i RSS');
	const problems = checkDist(join(root, 'dist'));
	if (problems.length) {
		console.error(problems.map((p) => `  - ${p}`).join('\n'));
		console.error(`\n✖ Znaleziono problemów: ${problems.length}`);
		process.exit(1);
	}
	console.log('  w porządku');
}

if (command === 'verify') {
	verifySite(process.cwd());
	console.log('\nWeryfikacja bloga zakończona.');
} else if (command === 'verify-engine') {
	run('testy jednostkowe', ['--test', ...['config', 'post-rules', 'post-images', 'video', 'colors', 'check-dist'].map((n) => join(engine, `tests/${n}.test.mjs`))], engine);
	run('testy buildu (zły wpis przerywa build)', ['--test', join(engine, 'tests/build.integration.mjs')], engine);
	verifySite(join(engine, 'tests/fixtures/site'));
	console.log('\nWeryfikacja silnika zakończona.');
} else {
	console.log('Użycie: blog-silnik verify   (w katalogu bloga: build + linki wewnętrzne + sitemap i RSS)');
	process.exit(command ? 1 : 0);
}
