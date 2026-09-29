/**
 * Interactive pattern detection (FR-16) from the stable ARIA / data-state
 * attributes Radix, shadcn, Embla and Swiper leave in the DOM.
 * Accordions map to Elementor's native Accordion in Free; tabs, carousels
 * and dialogs are detected and reported.
 */
import type { AccordionItem, AccordionMeta, CapturedNode, Pattern } from '../ir/types';
import { lucideName, textOf } from './leaf';

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

/** One accordion item: title, trigger/item styles, chevron and the captured panel. */
function accordionItem( item: CapturedNode, trigger: CapturedNode ): AccordionItem {
	const svg = descendants( trigger, ( c ) => c.tag === 'svg' )[ 0 ];
	const out: AccordionItem = {
		title: textOf( trigger ),
		trigger: trigger.styles,
		item: item.styles,
	};
	const iconName = lucideName( trigger.attrs[ 'data-a2k-icon' ] ?? svg?.attrs.class );
	if ( iconName ) out.iconName = iconName;
	if ( trigger.svg ?? svg?.svg ) out.svg = trigger.svg ?? svg?.svg;
	const size = svg?.rect.w || parseFloat( trigger.attrs[ 'data-a2k-icon-size' ] ?? '' );
	if ( size ) out.iconSize = size;
	// Space a closed item has beyond its trigger and borders (e.g. a margin on the Radix <h3> header).
	const s = item.styles.desktop;
	const borders = ( parseFloat( s[ 'border-top-width' ] ?? '0' ) || 0 ) + ( parseFloat( s[ 'border-bottom-width' ] ?? '0' ) || 0 );
	const extra = Math.round( item.rect.h - trigger.rect.h - borders );
	if ( item !== trigger && ! trigger.panel?.open && extra > 0 && extra <= 48 ) out.extraBottom = extra;
	if ( trigger.panel ) out.panel = trigger.panel;
	return out;
}

/** An accordion pattern's meta, when it carries the item data (captures with panels). */
export function accordionMeta( p: Pattern | undefined ): AccordionMeta | undefined {
	if ( p?.type !== 'accordion' ) return undefined;
	const m = p.meta as Partial< AccordionMeta >;
	return Array.isArray( m.items ) ? ( m as AccordionMeta ) : undefined;
}

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
		const triggers = items.map( ( i ) => ( isTrigger( i ) ? i : descendants( i, isTrigger )[ 0 ]! ) );
		const titles = triggers.map( textOf );
		const radix = items.some( ( i ) => i.attrs[ 'data-orientation' ] !== undefined || i.attrs[ 'data-state' ] !== undefined );
		const meta: AccordionMeta = {
			titles,
			items: items.map( ( item, i ) => accordionItem( item, triggers[ i ]! ) ),
			multiple: triggers.some( ( t ) => t.panel?.multiple ),
		};
		return { type: 'accordion', confidence: radix ? 0.95 : 0.8, meta };
	}

	if ( a[ 'aria-haspopup' ] === 'dialog' ) return { type: 'dialog', confidence: 0.8, meta: { trigger: textOf( node ) } };

	return undefined;
}
