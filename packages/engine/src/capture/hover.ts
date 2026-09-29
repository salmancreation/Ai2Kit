/**
 * Hover capture (PRD FR-22: "Hover transitions map to widget hover controls").
 *
 * `:hover` can't be triggered from script, so each stylesheet rule whose last
 * compound selector has `:hover` is copied with `:hover` replaced by an
 * attribute. Setting that attribute on one element at a time, with
 * transitions off, gives the element's computed hover style; the diff from its
 * normal style is what the emitters map. Hover that restyles a *descendant*
 * (Tailwind `group-hover:`) has no Elementor control and is not captured.
 */
import type { StyleMap } from '../ir/types';
import { splitTopLevel } from '../util/units';

export const HOVER_ATTR = 'data-a2k-hover';

/** Properties read in the hover state. */
export const HOVER_PROPS = [
	'color',
	'background-color',
	'background-image',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'box-shadow',
	'transform',
	'opacity',
	'text-decoration-line',
	'filter',
];

/** Transition longhands recorded next to the hover diff (kept only when something changes on hover). */
const TRANSITION_PROPS = [ 'transition-property', 'transition-duration', 'transition-timing-function' ];

const COMBINATOR = /[\s>+~]/;

/**
 * Rewrite one selector so the element in its last compound matches
 * `[data-a2k-hover]` instead of `:hover`. Returns null when `:hover` is not in
 * the last compound (a descendant or sibling of the hovered element changes),
 * or when the selector is only `:hover`.
 */
export function rewriteHoverSelector( selector: string ): string | null {
	const sel = selector.trim();
	if ( ! sel.includes( ':hover' ) ) return null;
	// The last compound starts after the last top-level combinator.
	let depth = 0;
	let start = 0;
	for ( let i = 0; i < sel.length; i++ ) {
		const ch = sel[ i ]!;
		if ( ch === '(' || ch === '[' ) depth++;
		else if ( ch === ')' || ch === ']' ) depth--;
		else if ( ch === '\\' ) i++;
		else if ( depth === 0 && COMBINATOR.test( ch ) ) start = i + 1;
	}
	const head = sel.slice( 0, start );
	const last = sel.slice( start );
	if ( head.includes( ':hover' ) || ! /:hover(?![-\w])/.test( last ) ) return null;
	const replaced = last.replace( /:hover(?![-\w])/g, `[${ HOVER_ATTR }]` );
	if ( replaced === `[${ HOVER_ATTR }]` ) return null;
	return head + replaced;
}

/** The selector with the hover attribute removed: which elements a rule can apply to. */
export function baseSelector( rewritten: string ): string {
	return rewritten.split( `[${ HOVER_ATTR }]` ).join( '' );
}

type HoverRule = { selector: string; body: string };

/** Resolve a nested rule's selector against its parent (CSS nesting, used by Tailwind v4). */
function nestSelector( child: string, parent: string | null ): string {
	if ( ! parent ) return child;
	const parents = splitTopLevel( parent, ',' ).map( ( p ) => p.trim() );
	return splitTopLevel( child, ',' )
		.map( ( c ) => c.trim() )
		.flatMap( ( c ) => parents.map( ( p ) => ( c.includes( '&' ) ? c.split( '&' ).join( `:is(${ p })` ) : `:is(${ p }) ${ c }` ) ) )
		.join( ', ' );
}

/** Collect hover rules from every readable stylesheet, including nested, @media and @layer blocks. */
export function collectHoverRules( doc: Document, win: Window ): HoverRule[] {
	const out: HoverRule[] = [];
	const visit = ( rules: CSSRuleList, parent: string | null ): void => {
		for ( const rule of Array.from( rules ) ) {
			const anyRule = rule as CSSRule & { selectorText?: string; style?: CSSStyleDeclaration; cssRules?: CSSRuleList; media?: MediaList; conditionText?: string };
			if ( anyRule.media && ! anyRule.selectorText ) {
				// @media: only rules that apply at the capture width.
				const cond = anyRule.conditionText ?? anyRule.media.mediaText;
				if ( cond && typeof win.matchMedia === 'function' && ! win.matchMedia( cond ).matches ) continue;
			}
			if ( anyRule.selectorText !== undefined ) {
				const full = nestSelector( anyRule.selectorText, parent );
				const body = anyRule.style?.cssText ?? '';
				if ( body && full.includes( ':hover' ) ) {
					for ( const part of splitTopLevel( full, ',' ) ) {
						const rewritten = rewriteHoverSelector( part );
						if ( rewritten ) out.push( { selector: rewritten, body } );
					}
				}
				if ( anyRule.cssRules?.length ) visit( anyRule.cssRules, full );
				continue;
			}
			if ( anyRule.cssRules?.length ) visit( anyRule.cssRules, parent );
		}
	};
	for ( const sheet of Array.from( doc.styleSheets ) ) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue; // Cross-origin sheet.
		}
		visit( rules, null );
	}
	return out;
}

function read( win: Window, el: Element, props: string[] ): StyleMap {
	const cs = win.getComputedStyle( el );
	const out: StyleMap = {};
	for ( const p of props ) out[ p ] = cs.getPropertyValue( p ).trim();
	return out;
}

/**
 * Hover diffs for captured elements (those carrying `keyAttr`), keyed by
 * capture key. Each diff also carries the element's transition longhands.
 */
export function captureHover( doc: Document, win: Window, keyAttr: string, limit = 3000 ): Map< string, StyleMap > {
	const result = new Map< string, StyleMap >();
	const rules = collectHoverRules( doc, win );
	if ( ! rules.length ) return result;

	const candidates = new Set< Element >();
	for ( const r of rules ) {
		try {
			doc.querySelectorAll( baseSelector( r.selector ) ).forEach( ( el ) => {
				if ( el.hasAttribute( keyAttr ) ) candidates.add( el );
			} );
		} catch {
			/* A selector this browser can't parse. */
		}
		if ( candidates.size > limit ) break;
	}
	if ( ! candidates.size ) return result;

	// Transition longhands are read before transitions are switched off, and with the
	// capture's settle style (which zeroes every duration) disabled for the moment —
	// synchronously, so nothing renders or animates in between.
	const transitions = new Map< Element, StyleMap >();
	const settle = doc.getElementById( 'a2k-settle' ) as HTMLStyleElement | null;
	if ( settle?.sheet ) settle.sheet.disabled = true;
	try {
		candidates.forEach( ( el ) => transitions.set( el, read( win, el, TRANSITION_PROPS ) ) );
	} finally {
		if ( settle?.sheet ) settle.sheet.disabled = false;
	}

	const style = doc.createElement( 'style' );
	style.setAttribute( 'data-a2k', 'hover' );
	// Transitions off for the whole pass, so leaving the hover state doesn't animate either.
	const css = [ '*, *::before, *::after { transition: none !important; }' ];
	for ( const r of rules ) css.push( `${ r.selector } { ${ r.body } }` );
	style.textContent = css.join( '\n' );
	( doc.head ?? doc.documentElement ).appendChild( style );
	try {
		candidates.forEach( ( el ) => {
			const normal = read( win, el, HOVER_PROPS );
			el.setAttribute( HOVER_ATTR, '' );
			const hover = read( win, el, HOVER_PROPS );
			el.removeAttribute( HOVER_ATTR );
			const diff: StyleMap = {};
			for ( const p of HOVER_PROPS ) if ( hover[ p ] !== normal[ p ] ) diff[ p ] = hover[ p ]!;
			if ( ! Object.keys( diff ).length ) return;
			const tr = transitions.get( el )!;
			for ( const p of TRANSITION_PROPS ) if ( tr[ p ] ) diff[ p ] = tr[ p ]!;
			result.set( el.getAttribute( keyAttr )!, diff );
		} );
	} finally {
		style.remove();
	}
	return result;
}
