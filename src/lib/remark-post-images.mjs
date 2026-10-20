import { realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

function fail(source, message) {
	throw new Error(`${source}: ${message}`);
}

function inside(directory, target) {
	const path = relative(directory, target);
	return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function validatePostSource(source, postsRoot) {
	const path = resolve(source);
	const root = resolve(postsRoot);
	if (dirname(dirname(path)) !== root || !/^index\.mdx?$/.test(basename(path))) fail(source, 'Wpis musi być w katalogu src/content/posts/<wpis>/index.mdx (albo index.md).');
	const article = realpathSync(dirname(path));
	if (!inside(realpathSync(root), article) || !inside(article, realpathSync(path))) {
		fail(source, 'Symlink źródła prowadzi poza katalog publikacji lub artykułu.');
	}
}

export function validateImagePath(url, source) {
	let decoded;
	try {
		decoded = decodeURIComponent(url);
	} catch {
		fail(source, `Niepoprawna ścieżka obrazu: ${url}`);
	}
	if (!decoded || /^[a-z][a-z\d+.-]*:/i.test(decoded) || isAbsolute(decoded)
		|| /[\\?#\u0000-\u001f]/.test(decoded)) {
		fail(source, `Obraz musi mieć względną lokalną ścieżkę bez URL, query ani fragmentu: ${url}`);
	}
	const directory = resolve(dirname(source));
	const target = resolve(directory, decoded);
	if (!inside(directory, target)) fail(source, `Obraz wychodzi poza katalog artykułu: ${url}`);
	let actual;
	try {
		actual = realpathSync(target);
		if (!statSync(actual).isFile()) fail(source, `Obraz nie jest plikiem: ${url}`);
	} catch (error) {
		if (error.code === 'ENOENT' || error.code === 'ENOTDIR') fail(source, `Brak pliku obrazu: ${url}`);
		throw error;
	}
	if (!inside(realpathSync(directory), actual)) fail(source, `Symlink obrazu prowadzi poza katalog artykułu: ${url}`);
	// Normalize percent-encoding before Astro resolves the import.
	return `./${relative(directory, target).split(sep).join('/')}`;
}

function walk(node, callback) {
	callback(node);
	for (const child of node.children ?? []) walk(child, callback);
}

const identifier = (value) => value.replace(/\s+/g, ' ').trim().toUpperCase();

export default function remarkPostImages({ postsRoot } = {}) {
	return (tree, file) => {
		const source = file.path;
		if (!source) throw new Error('Walidacja obrazów wymaga ścieżki pliku Markdown.');
		if (postsRoot) validatePostSource(source, postsRoot);
		const definitions = new Map();
		walk(tree, (node) => {
			if (node.type === 'definition' && !definitions.has(identifier(node.identifier))) {
				definitions.set(identifier(node.identifier), node);
			}
			// Prevent raw HTML from bypassing Markdown image validation. Code blocks
			// and inline code are separate nodes and may demonstrate HTML freely.
			// W MDX znaczniki mediów to elementy JSX; komponenty (wielka litera) są dozwolone.
			if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement')
				&& /^(?:img|picture|source|video|audio|iframe|object|embed|svg|image|script|style|link)$/i.test(node.name ?? '')) {
				fail(source, 'Surowy HTML mediów nie jest obsługiwany. Użyj ![opis](./obraz.jpg "Podpis").');
			}
			if (node.type === 'html' && (/<\s*\/?\s*(?:img|picture|source|video|audio|iframe|object|embed|svg|image|script|style|link)\b/i.test(node.value)
				|| /\b(?:src|srcset|poster|background|style)\s*=/i.test(node.value))) {
				fail(source, 'Surowy HTML mediów nie jest obsługiwany. Użyj ![opis](./obraz.jpg "Podpis").');
			}
		});
		walk(tree, (node) => {
			if (node.type === 'imageReference') {
				const definition = definitions.get(identifier(node.identifier));
				if (!definition) fail(source, `Brak definicji obrazu: ${node.identifier}`);
				node.type = 'image';
				node.url = definition.url;
				node.title = definition.title;
				delete node.identifier;
				delete node.referenceType;
				delete node.label;
			}
			if (node.type !== 'image') return;
			if (!node.alt?.trim()) fail(source, `Obraz wymaga niepustego tekstu alternatywnego: ${node.url}`);
			node.url = validateImagePath(node.url, source);
		});

		// Lift figures out of phrasing containers while preserving links and
		// emphasis around the image, and keep image nodes for Astro's collector.
		function captionParts(node) {
			if (node.type === 'image' && node.title) {
				const title = node.title;
				node.title = null;
				return [{
					type: 'postFigure', data: { hName: 'figure' }, children: [node,
						{ type: 'paragraph', data: { hName: 'figcaption' }, children: [{ type: 'text', value: title }] },
					],
				}];
			}
			if (!['link', 'linkReference', 'emphasis', 'strong', 'delete'].includes(node.type)) return [node];
			const parts = [];
			let inline = [];
			for (const child of node.children.flatMap(captionParts)) {
				if (child.type === 'postFigure') {
					if (inline.length) parts.push({ ...node, children: inline });
					inline = [];
					child.children[0] = { ...node, children: [child.children[0]] };
					parts.push(child);
				} else inline.push(child);
			}
			if (inline.length) parts.push({ ...node, children: inline });
			return parts;
		}

		// Split surrounding paragraphs so figures never end up inside <p>.
		function captions(node) {
			if (!node.children) return;
			for (const child of node.children) captions(child);
			if (!['paragraph', 'heading', 'tableCell'].includes(node.type)) return;
			const parts = node.children.flatMap(captionParts);
			if (!parts.some((child) => child.type === 'postFigure')) return;
			const children = [];
			let inline = [];
			const flush = () => {
				if (inline.length) children.push({
					type: node.type === 'heading' ? 'heading' : 'paragraph',
					depth: node.depth, children: inline,
				});
				inline = [];
			};
			for (const child of parts) {
				if (child.type === 'postFigure') {
					flush();
					children.push(child);
				} else inline.push(child);
			}
			flush();
			if (node.type !== 'tableCell') {
				node.type = 'postImageGroup';
				node.data = { hName: 'div' };
			}
			node.children = children;
		}
		captions(tree);
	};
}
