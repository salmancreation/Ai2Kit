/**
 * Page → sections, and heuristic semantic labeling (FR-18). Position,
 * landmarks and keywords only; the optional AI pass (Pro) refines labels.
 */
import type { IRNode, Semantic } from '../ir/types';
import { hasOwnVisual } from '../normalize/build';
import { hasVisualBox } from './leaf';
import { px } from '../util/units';

const EXPANDABLE = new Set( [ 'body', 'main', 'div', 'span', '#root' ] );

function isFullWidth( n: IRNode, pageW: number ): boolean {
	return !! n.rect && n.rect.w >= pageW * 0.9;
}

/** A centered block (`max-w-6xl mx-auto`) stacked in the page flow acts as a section too. */
function isCenteredBlock( n: IRNode, pageW: number ): boolean {
	if ( ! n.rect || n.rect.w < pageW * 0.4 ) return false;
	const left = n.rect.x;
	const right = pageW - ( n.rect.x + n.rect.w );
	return left > 0 && Math.abs( left - right ) <= 4;
}

/** Content width of a border-box max-width wrapper (what Elementor's boxed width means). */
export function contentWidth( s: Record< string, string | undefined >, outer: number ): number {
	if ( s[ 'box-sizing' ] !== 'border-box' ) return outer;
	return outer - ( px( s[ 'padding-left' ] ) ?? 0 ) - ( px( s[ 'padding-right' ] ) ?? 0 );
}

/**
 * Descend through page-level wrappers (body, #root, main, unstyled divs) whose
 * children are stacked full-width blocks; everything else is a section.
 */
export function findSections( root: IRNode, pageW: number ): IRNode[] {
	const out: IRNode[] = [];
	const visit = ( n: IRNode, depth: number ): void => {
		const kids = n.children.filter( ( c ) => c.kind !== 'spacer' || ( c.rect?.h ?? 0 ) > 0 );
		const expandable =
			n.kind === 'container' &&
			kids.length > 0 &&
			depth < 8 &&
			( n.tag === 'body' || n.tag === 'main' || ( EXPANDABLE.has( n.tag ?? '' ) && ! hasOwnVisual( n.styles.desktop ) && ! n.pattern ) ) &&
			n.layout?.direction !== 'row' &&
			n.layout?.display !== 'grid' &&
			kids.every( ( c ) => isFullWidth( c, pageW ) || isCenteredBlock( c, pageW ) || ( c.styles.desktop.position ?? '' ) === 'fixed' );
		if ( expandable ) {
			kids.forEach( ( c ) => visit( c, depth + 1 ) );
			return;
		}
		out.push( n );
	};
	visit( root, 0 );
	return out;
}

/**
 * A section whose only child is a centered max-width wrapper (the classic
 * `.container mx-auto px-4`) becomes an Elementor boxed container: the
 * wrapper is hoisted, its max-width becomes the boxed width and its padding
 * merges into the section's.
 */
export function boxSection( section: IRNode, collapse: ( n: IRNode ) => IRNode ): IRNode {
	let s = section;
	for ( let guard = 0; guard < 3; guard++ ) {
		if ( s.kind !== 'container' || s.children.length !== 1 ) break;
		const inner = s.children[ 0 ]!;
		const d = inner.styles.desktop;
		const maxW = px( d[ 'max-width' ] );
		if ( inner.kind !== 'container' || ! maxW || inner.pattern || hasVisualBox( d ) ) break;
		const ml = px( d[ 'margin-left' ] ) ?? 0;
		const mr = px( d[ 'margin-right' ] ) ?? 0;
		const centered = Math.abs( ml - mr ) <= 2 || ( !! inner.rect && !! s.rect && Math.abs( inner.rect.x - s.rect.x - ( s.rect.x + s.rect.w - inner.rect.x - inner.rect.w ) ) <= 4 );
		if ( ! centered ) break;

		const merged = { ...s.styles.desktop };
		for ( const side of [ 'top', 'right', 'bottom', 'left' ] ) {
			const k = `padding-${ side }`;
			const sum = ( px( merged[ k ] ) ?? 0 ) + ( px( d[ k ] ) ?? 0 );
			if ( sum ) merged[ k ] = `${ sum }px`;
		}
		for ( const k of [ 'display', 'flex-direction', 'flex-wrap', 'row-gap', 'column-gap', 'justify-content', 'align-items', 'grid-template-columns' ] ) {
			if ( d[ k ] !== undefined ) merged[ k ] = d[ k ]!;
			else if ( k !== 'display' ) delete merged[ k ];
		}
		if ( d.display === undefined ) merged.display = 'block';
		const styles = { ...s.styles, desktop: merged };
		for ( const bp of [ 'tablet', 'mobile' ] as const ) {
			if ( inner.styles[ bp ] ) styles[ bp ] = { ...s.styles[ bp ], ...inner.styles[ bp ] };
		}
		s = { ...s, styles, layout: inner.layout, children: inner.children, innerMaxWidth: contentWidth( d, maxW ) };
		s = collapse( s );
	}
	return s;
}

/**
 * A section that is itself a centered max-width block becomes a boxed
 * container whose content width matches the source.
 */
export function boxSelf( section: IRNode, pageW: number ): void {
	if ( section.innerMaxWidth || ! section.rect || isFullWidth( section, pageW ) || ! isCenteredBlock( section, pageW ) ) return;
	const d = section.styles.desktop;
	const maxW = px( d[ 'max-width' ] ) ?? section.rect.w;
	section.innerMaxWidth = contentWidth( { ...d, 'box-sizing': d[ 'box-sizing' ] ?? 'border-box' }, Math.min( maxW, section.rect.w ) );
}

function allText( n: IRNode ): string {
	const own = n.content?.text ?? n.content?.items?.map( ( i ) => i.text ).join( ' ' ) ?? '';
	return [ own, ...n.children.map( allText ) ].join( ' ' ).toLowerCase();
}

function count( n: IRNode, pred: ( n: IRNode ) => boolean ): number {
	return ( pred( n ) ? 1 : 0 ) + n.children.reduce( ( s, c ) => s + count( c, pred ), 0 );
}

function hasPattern( n: IRNode, type: string ): boolean {
	return n.pattern?.type === type || n.children.some( ( c ) => hasPattern( c, type ) );
}

function firstHeading( n: IRNode ): string | undefined {
	if ( n.kind === 'heading' ) return n.content?.text;
	for ( const c of n.children ) {
		const h = firstHeading( c );
		if ( h ) return h;
	}
	return undefined;
}

export const SEMANTIC_LABELS: Record< Semantic, string > = {
	header: 'Header',
	nav: 'Navigation',
	hero: 'Hero',
	features: 'Features grid',
	pricing: 'Pricing',
	testimonials: 'Testimonials',
	faq: 'FAQ',
	cta: 'Call to action',
	footer: 'Footer',
	gallery: 'Gallery',
	stats: 'Stats',
	team: 'Team',
	logos: 'Logos',
	blog: 'Blog',
};

export function classifySection( n: IRNode, index: number, total: number, prev?: Semantic ): Semantic | undefined {
	const tag = n.tag ?? '';
	const idc = `${ n.anchor ?? '' }`.toLowerCase();
	const text = allText( n );
	const y = n.rect?.y ?? 0;
	const h = n.rect?.h ?? 0;
	const headings = count( n, ( c ) => c.kind === 'heading' );
	const images = count( n, ( c ) => c.kind === 'image' );
	const buttons = count( n, ( c ) => c.kind === 'button' );
	const hasH1 = count( n, ( c ) => c.kind === 'heading' && c.content?.tag === 'h1' ) > 0;

	if ( tag === 'header' || ( index === 0 && y < 120 && h < 160 && count( n, ( c ) => c.tag === 'nav' || ( c.kind === 'text' && /<a /.test( c.content?.html ?? '' ) ) ) > 0 ) ) {
		return 'header';
	}
	if ( tag === 'nav' ) return 'nav';
	if ( tag === 'footer' || ( index === total - 1 && /©|&copy;|copyright|all rights reserved/.test( text ) ) ) return 'footer';

	const kw = ( re: RegExp ): boolean => re.test( idc ) || re.test( ( firstHeading( n ) ?? '' ).toLowerCase() );
	if ( kw( /pricing|plans?\b/ ) || ( /\/\s?(mo|month|year|yr)\b/.test( text ) && /[$€£]\s?\d/.test( text ) ) ) return 'pricing';
	if ( kw( /faq|frequently asked|questions/ ) || hasPattern( n, 'accordion' ) ) return 'faq';
	if ( kw( /testimonial|reviews?|what (our )?(customers|clients|people) say|loved by/ ) ) return 'testimonials';
	if ( kw( /\b(our|the) team\b|meet the|our people|^team$/ ) ) return 'team';
	if ( kw( /blog|articles|latest (news|posts)/ ) ) return 'blog';
	if ( hasH1 && ( prev === undefined || prev === 'header' || prev === 'nav' ) ) return 'hero';
	if ( kw( /gallery|portfolio|our work/ ) || images >= 6 ) return 'gallery';
	if ( kw( /logos|trusted by|partners|clients/ ) || ( images >= 4 && headings <= 1 && h < 260 ) ) return 'logos';
	if ( ( text.match( /\b\d+(\.\d+)?\s?(k|m|%|\+|x)(?=\s|$)/g ) ?? [] ).length >= 3 && h < 500 ) return 'stats';
	if ( kw( /features?|why|how it works|services|benefits/ ) || hasPattern( n, 'repeat' ) ) return 'features';
	if ( buttons >= 1 && headings <= 2 && index >= total - 3 ) return 'cta';
	return undefined;
}

export function labelSections( sections: IRNode[] ): void {
	let prev: Semantic | undefined;
	const used = new Map< string, number >();
	sections.forEach( ( s, i ) => {
		const sem = classifySection( s, i, sections.length, prev );
		if ( sem ) s.semantic = sem;
		let label = sem ? SEMANTIC_LABELS[ sem ] : firstHeading( s )?.slice( 0, 40 ) ?? `Section ${ i + 1 }`;
		const n = ( used.get( label ) ?? 0 ) + 1;
		used.set( label, n );
		if ( n > 1 ) label = `${ label } ${ n }`;
		s.label = label;
		prev = sem;
	} );
}
