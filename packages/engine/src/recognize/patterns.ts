/**
 * Interactive pattern detection (FR-16) from the stable ARIA / data-state
 * attributes Radix, shadcn, Embla and Swiper leave in the DOM.
 * Free detects and reports; native mapping of these patterns is Pro.
 */
import type { CapturedNode, Pattern } from '../ir/types';
import { textOf } from './leaf';

function descendants( n: CapturedNode, pred: ( n: CapturedNode ) => boolean, out: CapturedNode[] = [] ): CapturedNode[] {
	for ( const c of n.children ) {
		if ( pred( c ) ) out.push( c );
		descendants( c, pred, out );
	}
	return out;
}

const isTrigger = ( n: CapturedNode ): boolean =>
	n.attrs[ 'aria-expanded' ] !== undefined &&
	( n.tag === 'button' || n.attrs.role === 'button' ) &&
	( n.attrs[ 'data-radix-collection-item' ] !== undefined || n.attrs[ 'data-state' ] !== undefined || n.attrs[ 'aria-controls' ] !== undefined );

export function detectPattern( node: CapturedNode ): Pattern | undefined {
	const a = node.attrs;
	const cls = a.class ?? '';

	if ( a[ 'aria-roledescription' ] === 'carousel' || /\b(embla|swiper)\b/.test( cls ) || a[ 'data-embla' ] !== undefined ) {
		const slides = descendants( node, ( c ) => c.attrs[ 'aria-roledescription' ] === 'slide' || /\b(swiper-slide|embla__slide)\b/.test( c.attrs.class ?? '' ) );
		return { type: 'carousel', confidence: slides.length ? 0.95 : 0.7, meta: { slides: slides.length } };
	}

	const tablist = node.children.find( ( c ) => c.attrs.role === 'tablist' );
	if ( tablist ) {
		const tabs = descendants( tablist, ( c ) => c.attrs.role === 'tab' );
		const panels = node.children.filter( ( c ) => c.attrs.role === 'tabpanel' );
		if ( tabs.length >= 2 ) {
			return { type: 'tabs', confidence: panels.length ? 0.95 : 0.75, meta: { titles: tabs.map( textOf ) } };
		}
	}

	// Accordion: ≥2 sibling items each holding one expand trigger, and no deeper accordion.
	const items = node.children.filter( ( c ) => descendants( c, isTrigger ).length === 1 || isTrigger( c ) );
	if ( items.length >= 2 && items.length >= node.children.length * 0.8 ) {
		const titles = items.map( ( i ) => textOf( isTrigger( i ) ? i : descendants( i, isTrigger )[ 0 ]! ) );
		const radix = items.some( ( i ) => i.attrs[ 'data-orientation' ] !== undefined || i.attrs[ 'data-state' ] !== undefined );
		return { type: 'accordion', confidence: radix ? 0.95 : 0.8, meta: { titles } };
	}

	if ( a[ 'aria-haspopup' ] === 'dialog' ) return { type: 'dialog', confidence: 0.8, meta: { trigger: textOf( node ) } };

	return undefined;
}
