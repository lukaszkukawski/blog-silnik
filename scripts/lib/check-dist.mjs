import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function htmlFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return htmlFiles(path);
		return entry.name.endsWith('.html') ? [path] : [];
	});
}

function resolveTarget(dist, pathname) {
	let path = decodeURIComponent(pathname);
	const base = join(dist, path);
	if (path.endsWith('/')) return existsSync(join(base, 'index.html')) ? join(base, 'index.html') : null;
	if (existsSync(base) && statSync(base).isFile()) return base;
	return existsSync(join(base, 'index.html')) ? join(base, 'index.html') : null;
}

/**
 * Sprawdza zbudowaną witrynę (dist/): wymagane pliki, linki wewnętrzne (href/src zaczynające się od „/”)
 * i kotwice (#id) na tej samej stronie lub na stronie docelowej. Zwraca listę problemów po polsku.
 */
export function checkDist(dist) {
	const problems = [];
	for (const required of ['sitemap-index.xml', 'rss.xml', '404.html']) {
		if (!existsSync(join(dist, required))) problems.push(`brak pliku ${required} w ${dist}`);
	}
	if (!existsSync(dist)) return problems;
	const ids = new Map();
	const idsOf = (file) => {
		if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
		return ids.get(file);
	};
	for (const file of htmlFiles(dist)) {
		const page = file.slice(dist.length);
		const html = readFileSync(file, 'utf8');
		for (const [, , value] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
			if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue; // zewnętrzne, mailto:, data:
			const raw = value.replaceAll('&amp;', '&');
			const [withoutHash, hash = ''] = raw.split('#');
			const pathname = withoutHash.split('?')[0];
			if (!pathname.startsWith('/') && pathname !== '') continue; // linki względne omija ten test
			const target = pathname === '' ? file : resolveTarget(dist, pathname);
			if (!target) {
				problems.push(`${page}: link do nieistniejącej strony lub pliku: ${value}`);
				continue;
			}
			if (hash && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(hash))) {
				problems.push(`${page}: kotwica #${hash} nie istnieje na stronie ${pathname || page}`);
			}
		}
	}
	return problems;
}
