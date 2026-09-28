/**
 * CapturedNode tree → IR tree: classification, layout, wrapper collapsing
 * (FR-13) and flex-child widths.
 */
import type { CapturedNode, IRNode, StyleMap } from '../ir/types';
import { classify, hasVisualBox } from '../recognize/leaf';
import { layoutOf } from '../recognize/layout';
import { detectPattern } from '../recognize/patterns';
import { px, round } from '../util/units';

const SEMANTIC_TAGS = new Set( [ 'header', 'footer', 'nav', 'section', 'article', 'aside', 'form' ] );

export function buildIR( captured: CapturedNode, nextId: () => string ): IRNode {
	const c = classify( captured );
	const node: IRNode = {
		id: nextId(),
		key: captured.key,
		tag: captured.tag,
		kind: c.kind,
		styles: captured.styles,
		rect: captured.rect,
		children: [],
	};
	if ( captured.rects ) node.rects = captured.rects;
	if ( c.content ) node.content = c.content;
	if ( c.fallbackReason ) {
		node.fallback = { reason: c.fallbackReason, html: captured.frozen ?? '', css: '' };
	}
	if ( captured.attrs.id && /^[A-Za-z][\w-]*$/.test( captured.attrs.id ) ) node.anchor = captured.attrs.id;

	if ( node.kind === 'container' ) {
		node.layout = layoutOf( captured.styles.desktop );
		const pattern = detectPattern( captured );
		if ( pattern ) node.pattern = pattern;
		if ( captured.attrs.href ) node.content = { ...node.content, href: captured.attrs.href };
		node.children = captured.children.map( ( ch ) => buildIR( ch, nextId ) ).filter( ( ch ) => ! isHidden( ch ) );
		assignWidths( node );
	}
	return node;
}

function isHidden( n: IRNode ): boolean {
	return n.styles.desktop.display === 'none' && ! n.styles.tablet && ! n.styles.mobile;
}

/**
 * Share of the parent's content box, for flex-row children (Elementor
 * `width` in %). Only when the children behave like columns — they grow,
 * have a basis, or together fill the row. Content-sized children (a logo
 * and a nav in a header) are left to size themselves.
 */
function assignWidths( parent: IRNode ): void {
	if ( ! parent.rect || parent.layout?.display !== 'flex' || parent.layout.direction !== 'row' ) return;
	const s = parent.styles.desktop;
	const inner = parent.rect.w - ( px( s[ 'padding-left' ] ) ?? 0 ) - ( px( s[ 'padding-right' ] ) ?? 0 );
	if ( inner <= 0 ) return;
	const kids = parent.children.filter( ( c ) => c.rect && c.styles.desktop.position !== 'absolute' );
	const gap = parent.layout.gap?.column ?? 0;
	const used = kids.reduce( ( sum, c ) => sum + c.rect!.w, 0 ) + gap * Math.max( 0, kids.length - 1 );
	const fills = used >= inner * 0.95;
	for ( const ch of parent.children ) {
		if ( ch.kind !== 'container' || ! ch.rect ) continue;
		const grow = parseFloat( ch.styles.desktop[ 'flex-grow' ] ?? '0' ) > 0;
		const basis = ch.styles.desktop[ 'flex-basis' ];
		if ( ! grow && ! basis && ! fills ) continue;
		const pct = round( ( ch.rect.w / inner ) * 100 );
		if ( pct > 0 && pct < 99 ) ch.widthPct = pct;
	}
}

/** Visual styles that make a wrapper meaningful (it can't be collapsed away). */
export function hasOwnVisual( s: StyleMap ): boolean {
	if ( hasVisualBox( s ) ) return true;
	for ( const side of [ 'top', 'right', 'bottom', 'left' ] ) {
		if ( ( px( s[ `padding-${ side }` ] ) ?? 0 ) > 0 ) return true;
	}
	if ( s.opacity && s.opacity !== '1' ) return true;
	if ( s.transform && s.transform !== 'none' ) return true;
	if ( s.position === 'absolute' || s.position === 'fixed' || s.position === 'sticky' ) return true;
	return false;
}

function hasMargin( s: StyleMap ): boolean {
	return [ 'top', 'bottom' ].some( ( side ) => ( px( s[ `margin-${ side }` ] ) ?? 0 ) !== 0 );
}

function isPlainWrapper( n: IRNode ): boolean {
	return (
		n.kind === 'container' &&
		! n.pattern &&
		! n.content?.href &&
		! SEMANTIC_TAGS.has( n.tag ?? '' ) &&
		! hasOwnVisual( n.styles.desktop ) &&
		! n.styles.tablet?.display &&
		! n.styles.mobile?.display
	);
}

/**
 * FR-13: remove nodes with no visual styles, a single child and no semantic
 * role. The wrapper's max-width (a centering "container" div) is kept on the
 * survivor so sections can become boxed.
 */
export function collapseWrappers( node: IRNode ): IRNode {
	node.children = node.children.map( collapseWrappers );
	if ( node.kind !== 'container' || node.children.length !== 1 ) return node;
	const only = node.children[ 0 ]!;

	// Invisible parent → the child replaces it.
	if ( isPlainWrapper( node ) && ! hasMargin( node.styles.desktop ) && node.tag !== 'body' ) {
		const maxW = node.styles.desktop[ 'max-width' ];
		if ( maxW && ! only.styles.desktop[ 'max-width' ] ) only.styles = { ...only.styles, desktop: { ...only.styles.desktop, 'max-width': maxW } };
		if ( node.widthPct && ! only.widthPct ) only.widthPct = node.widthPct;
		if ( node.anchor && ! only.anchor ) only.anchor = node.anchor;
		return only;
	}
	// Visible parent + invisible container child → parent adopts the child's layout and children.
	if ( only.kind === 'container' && isPlainWrapper( only ) && ! hasMargin( only.styles.desktop ) ) {
		node.layout = only.layout;
		node.children = only.children;
		const maxW = only.styles.desktop[ 'max-width' ];
		if ( maxW ) node.innerMaxWidth = px( maxW ) ?? undefined;
		// Keep the child's responsive layout overrides.
		for ( const bp of [ 'tablet', 'mobile' ] as const ) {
			const src = only.styles[ bp ];
			if ( ! src ) continue;
			const pick: StyleMap = {};
			for ( const k of [ 'flex-direction', 'flex-wrap', 'row-gap', 'column-gap', 'grid-template-columns', 'justify-content', 'align-items' ] ) {
				if ( src[ k ] !== undefined ) pick[ k ] = src[ k ]!;
			}
			if ( Object.keys( pick ).length ) node.styles = { ...node.styles, [ bp ]: { ...node.styles[ bp ], ...pick } };
		}
		for ( const k of [ 'flex-direction', 'flex-wrap', 'row-gap', 'column-gap', 'grid-template-columns', 'justify-content', 'align-items', 'display' ] ) {
			const v = only.styles.desktop[ k ];
			if ( v !== undefined ) node.styles = { ...node.styles, desktop: { ...node.styles.desktop, [ k ]: v } };
		}
	}
	return node;
}
