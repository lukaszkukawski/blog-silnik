// Native keyboard scrolling without client-side JavaScript. Keep the table's
// semantic display type and put the overflow on a labelled wrapper instead.
export default function rehypeReadingBlocks() {
	return (tree) => {
		function wrap(node) {
			if (!node.children) return;
			node.children = node.children.map((child) => {
				wrap(child);
				if (child.type !== 'element' || !['table', 'pre'].includes(child.tagName)) return child;
				return {
					type: 'element', tagName: 'div',
					properties: {
						className: ['reading-scroll'], tabIndex: 0, role: 'region',
						ariaLabel: child.tagName === 'table' ? 'Tabela — przewijaj strzałkami w poziomie' : 'Blok kodu — przewijaj strzałkami w poziomie',
					},
					children: [child],
				};
			});
		}
		wrap(tree);
	};
}
