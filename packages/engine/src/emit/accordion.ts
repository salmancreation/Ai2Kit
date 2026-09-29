/**
 * Accordion / FAQ → Elementor's native (nested) Accordion widget.
 *
 * Nested Accordion is Elementor Free, starts all-collapsed like Radix/shadcn,
 * and holds each answer in a real container. Its stock look (1px grey borders
 * on titles and answers, 20px titles, 10px padding, icon on the left) is
 * overridden with the source's values. Controls verified against
 * tests/fixtures/elementor/controls-v3.json (`nested-accordion`).
 */
import type { AccordionItem, AccordionMeta, IRNode, StyleMap } from '../ir/types';
import { parseBox, px, round } from '../util/units';
import { isTransparent } from '../util/color';
import { dims, slider, type Settings } from './settings';
import { borderSettings, boxSetting, colorSetting, commonWidget, iconSetting, iconValue, typography, widget, type EmitContext, type IconSetting, type V3Element } from './v3';

/** Chevron-down opens to chevron-up, plus to minus; anything else keeps its icon. */
const ACTIVE_ICON: Record< string, string > = { 'chevron-down': 'chevron-up', 'chevron-right': 'chevron-down', plus: 'minus', 'arrow-down': 'arrow-up' };

/** The SVG turned by `deg` about its viewBox center (the open-state icon). */
export function rotateSvg( svg: string, deg: number ): string {
	const vb = /viewBox="([-\d.\s,]+)"/.exec( svg )?.[ 1 ]?.split( /[\s,]+/ ).map( Number );
	if ( ! vb || vb.length !== 4 || vb.some( Number.isNaN ) ) return svg;
	const cx = vb[ 0 ]! + vb[ 2 ]! / 2;
	const cy = vb[ 1 ]! + vb[ 3 ]! / 2;
	return svg.replace( /(<svg\b[^>]*>)([\s\S]*)(<\/svg>\s*)$/, `$1<g transform="rotate(${ deg } ${ cx } ${ cy })">$2</g>$3` );
}

/** One-character pseudo icons ("+", "−", "▾") → Font Awesome (bundled with Elementor Free). */
const GLYPH_FA: Record< string, string > = {
	'+': 'fas fa-plus', '＋': 'fas fa-plus',
	'−': 'fas fa-minus', '-': 'fas fa-minus', '–': 'fas fa-minus', '—': 'fas fa-minus',
	'×': 'fas fa-times', '✕': 'fas fa-times', x: 'fas fa-times',
	'▾': 'fas fa-caret-down', '▼': 'fas fa-caret-down', '⌄': 'fas fa-chevron-down', 'v': 'fas fa-chevron-down', '∨': 'fas fa-chevron-down',
	'▴': 'fas fa-caret-up', '▲': 'fas fa-caret-up', '⌃': 'fas fa-chevron-up', '^': 'fas fa-chevron-up', '∧': 'fas fa-chevron-up',
	'▸': 'fas fa-caret-right', '▶': 'fas fa-caret-right', '›': 'fas fa-chevron-right', '>': 'fas fa-chevron-right',
};
const fa = ( value: string ): IconSetting => ( { value, library: 'fa-solid' } );

/** Where the icon sits: the source's (a marker or ::before is at the start). */
export function iconAtStart( item: AccordionItem ): boolean {
	if ( item.svg ) return !! item.iconStart;
	if ( item.panel?.glyph ) return item.panel.glyph.position === 'start';
	return !! item.panel?.marker;
}

/**
 * Closed and open icons: the source's own SVG (open = the same SVG with the
 * rotation the source applies when open), or Font Awesome when no SVG exists.
 */
function icons( item: AccordionItem ): { normal: IconSetting; active: IconSetting } | null {
	if ( item.svg ) {
		const rot = item.panel?.iconRotate ?? 0;
		return {
			normal: iconSetting( undefined, item.svg )!,
			active: iconSetting( undefined, rot ? rotateSvg( item.svg, rot ) : item.svg )!,
		};
	}
	// A "+"/"−" drawn by ::after, or the browser's ▸/▾ disclosure marker (<details>).
	const g = item.panel?.glyph;
	if ( g && GLYPH_FA[ g.closed ] ) return { normal: fa( GLYPH_FA[ g.closed ]! ), active: fa( GLYPH_FA[ g.open ] ?? GLYPH_FA[ g.closed ]! ) };
	if ( item.panel?.marker ) return { normal: fa( 'fas fa-caret-right' ), active: fa( 'fas fa-caret-down' ) };
	const normal = iconValue( item.iconName );
	if ( ! normal ) return null;
	return { normal, active: iconValue( ACTIVE_ICON[ item.iconName ?? '' ] ?? item.iconName ) ?? normal };
}

/** First side with a visible border: style, widths and color. */
function border( s: StyleMap | undefined ): { style: string; color?: string; box: { top: number; right: number; bottom: number; left: number } } | null {
	if ( ! s ) return null;
	const w = parseBox( s, 'border-width' );
	const side = ( [ 'top', 'bottom', 'left', 'right' ] as const ).find( ( sd ) => ( px( s[ `border-${ sd }-width` ] ) ?? 0 ) > 0 && ( s[ `border-${ sd }-style` ] ?? 'none' ) !== 'none' );
	if ( ! w || ! side ) return null;
	const style = s[ `border-${ side }-style` ]!;
	return { style: [ 'solid', 'double', 'dotted', 'dashed', 'groove' ].includes( style ) ? style : 'solid', color: s[ `border-${ side }-color` ], box: w };
}

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

/** Whether an accordion node can be emitted natively: every item's panel was captured. */
export function canEmitAccordion( meta: AccordionMeta | undefined ): meta is AccordionMeta {
	return !! meta && meta.items.length >= 2 && meta.items.every( ( i ) => i.panel && ( i.panel.html || i.panel.text ) );
}

export function emitAccordion( node: IRNode, meta: AccordionMeta, ctx: EmitContext, parent?: IRNode ): V3Element {
	const first = meta.items[ 0 ]!;
	const trig = first.trigger.desktop;
	const panel = first.panel!;
	const out: Settings = {};
	const consumed = new Set< string >();

	out.items = meta.items.map( ( it ) => ( { _id: ctx.nextId(), item_title: it.title } ) );
	out.default_state = meta.items[ 0 ]!.panel?.open ? 'expanded' : 'all_collapsed';
	out.max_items_expended = meta.multiple ? 'multiple' : 'one';

	// Title row: text left, icon right when the trigger spreads them (shadcn's justify-between).
	if ( trig[ 'justify-content' ] === 'space-between' ) out.accordion_item_title_position_horizontal = 'stretch';
	const ic = icons( first );
	if ( ic ) {
		out.accordion_item_title_icon = ic.normal;
		out.accordion_item_title_icon_active = ic.active;
		out.accordion_item_title_icon_position = iconAtStart( first ) ? 'start' : 'end';
		const fs = px( trig[ 'font-size' ] ) ?? 16;
		// No SVG to measure. A text "+" is ~0.7 of its font size wide (Font Awesome's fills its box);
		// the ▸ marker matches a caret at the title's size.
		const glyph = first.panel?.glyph;
		const size = first.iconSize ?? ( first.svg ? undefined : glyph ? round( ( glyph.size ?? fs ) * 0.7 ) : fs );
		if ( size ) out.icon_size = slider( size );
	} else {
		out.accordion_item_title_icon = { value: '', library: '' };
	}

	// Title typography, color and padding (Elementor's defaults are 20px, #1f2124, 10px).
	typography( out, 'title_typography', { id: `${ node.id }-t`, kind: 'text', styles: first.trigger, children: [] }, ctx, consumed );
	if ( ! out.title_typography_font_size && ! ( out.__globals__ as Record< string, string > | undefined )?.title_typography_typography && trig[ 'font-size' ] ) {
		out.title_typography_font_size = slider( px( trig[ 'font-size' ] ) ?? 16 );
	}
	for ( const state of [ 'normal', 'active' ] as const ) {
		colorSetting( out, `${ state }_title_color`, trig.color, ctx );
		colorSetting( out, `${ state }_icon_color`, trig.color, ctx );
	}
	const hover = first.trigger.hover?.color ?? trig.color;
	colorSetting( out, 'hover_title_color', hover, ctx );
	colorSetting( out, 'hover_icon_color', hover, ctx );
	// Title padding = the trigger's, plus the item's own padding around it (<details style="padding">).
	const pad = parseBox( trig, 'padding' ) ?? ZERO;
	const itemPad = parseBox( first.item.desktop, 'padding' ) ?? ZERO;
	out.accordion_padding = dims( {
		top: pad.top + itemPad.top,
		right: pad.right + itemPad.right,
		bottom: pad.bottom + itemPad.bottom + ( first.extraBottom ?? 0 ),
		left: pad.left + itemPad.left,
	} );

	// Borders: the source draws them on the item (title + answer); Elementor on the title and the answer box.
	const itemBorder = border( first.item.desktop ) ?? border( trig );
	if ( itemBorder ) {
		const bottomOnly = itemBorder.box.top === 0 && itemBorder.box.left === 0 && itemBorder.box.right === 0;
		out.accordion_border_normal_border = itemBorder.style;
		out.accordion_border_normal_width = dims( itemBorder.box );
		colorSetting( out, 'accordion_border_normal_color', itemBorder.color, ctx );
		if ( bottomOnly ) {
			// Open item: the rule moves below the answer.
			out.accordion_border_active_border = 'none';
			out.content_border_border = itemBorder.style;
			out.content_border_width = dims( { ...ZERO, bottom: itemBorder.box.bottom } );
			colorSetting( out, 'content_border_color', itemBorder.color, ctx );
		} else {
			// A card (border all round): closed = the whole card; open = the title keeps top and
			// sides, the answer box continues the sides and closes the bottom.
			out.accordion_border_active_border = itemBorder.style;
			out.accordion_border_active_width = dims( { ...itemBorder.box, bottom: 0 } );
			colorSetting( out, 'accordion_border_active_color', itemBorder.color, ctx );
			out.content_border_border = itemBorder.style;
			out.content_border_width = dims( { ...itemBorder.box, top: 0 } );
			colorSetting( out, 'content_border_color', itemBorder.color, ctx );
		}
	} else {
		out.accordion_border_normal_border = 'none';
		out.accordion_border_active_border = 'none';
		out.content_border_border = 'none';
	}
	// Space between items: their margin, or the list's flex/grid gap (separate cards).
	const rs = node.styles.desktop;
	const listGap = ( rs.display ?? '' ).includes( 'flex' ) || ( rs.display ?? '' ).includes( 'grid' ) ? px( rs[ 'row-gap' ] ) ?? 0 : 0;
	const gap = ( px( first.item.desktop[ 'margin-bottom' ] ) ?? 0 ) + listGap;
	if ( gap ) out.accordion_item_title_space_between = slider( gap );

	// Card corners: the title rounds all corners; the open answer rounds the bottom ones.
	const r = [ 'top-left', 'top-right', 'bottom-right', 'bottom-left' ].map( ( c ) => Math.min( 999, px( first.item.desktop[ `border-${ c }-radius` ] ) ?? 0 ) );
	if ( r.some( Boolean ) ) {
		out.accordion_border_radius = dims( { top: r[ 0 ]!, right: r[ 1 ]!, bottom: r[ 2 ]!, left: r[ 3 ]! } );
		out.content_border_radius = dims( { top: 0, right: 0, bottom: r[ 2 ]!, left: r[ 3 ]! } );
	}

	// Item background (a tinted card): behind the title in every state, and behind the answer.
	const bg = first.item.desktop[ 'background-color' ];
	if ( bg && ! isTransparent( bg ) ) {
		for ( const state of [ 'normal', 'hover', 'active' ] as const ) {
			out[ `accordion_background_${ state }_background` ] = 'classic';
			colorSetting( out, `accordion_background_${ state }_color`, bg, ctx );
		}
		out.content_background_background = 'classic';
		colorSetting( out, 'content_background_color', bg, ctx );
	}

	// The accordion's own box (a top rule above the first item, a card around it).
	commonWidget( out, node, ctx, parent, consumed, { boxStyles: true } );
	if ( ctx.stats ) {
		ctx.stats.leaves++;
		ctx.stats.nativeLeaves++;
	}

	const elements = meta.items.map( ( it, i ) => answer( it, i, ctx ) );
	const el = widget( 'nested-accordion', out, ctx );
	el.elements = elements;
	if ( ! panel.text ) ctx.stats?.warnings.push( 'Some accordion answers were empty in the source.' );
	return el;
}

/** One answer: a full-width container holding the answer text. */
function answer( it: AccordionItem, i: number, ctx: EmitContext ): V3Element {
	const p = it.panel!;
	const text: Settings = { editor: p.html || `<p>${ p.text }</p>`, paragraph_spacing: slider( 0 ) };
	const textNode: IRNode = { id: `${ i }-a`, kind: 'text', styles: { desktop: p.textStyles }, children: [] };
	colorSetting( text, 'text_color', p.textStyles.color, ctx );
	typography( text, 'typography', textNode, ctx, new Set() );
	const box: Settings = { _title: `Item #${ i + 1 }`, content_width: 'full', flex_gap: { unit: 'px', size: 0, column: '0', row: '0', isLinked: true } };
	boxSetting( box, 'padding', { desktop: p.styles }, 'padding', new Set(), false, true );
	const bg = p.styles[ 'background-color' ];
	if ( bg ) {
		box.background_background = 'classic';
		colorSetting( box, 'background_color', bg, ctx );
	}
	borderSettings( box, 'border', p.styles, ctx, new Set() );
	return { id: ctx.nextId(), elType: 'container', isInner: true, settings: box, elements: [ widget( 'text-editor', text, ctx ) ] };
}
