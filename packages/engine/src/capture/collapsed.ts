/**
 * Collapsed panel capture (FR-16, accordions / FAQ).
 *
 * Radix and most accordion libraries don't render a closed panel at all, so
 * a normal DOM walk never sees FAQ answers. For each group of ≥2 expand
 * triggers, every item is opened (a real click, so the library renders it),
 * its panel is read, and every trigger is then clicked back to its original
 * state. Whether several items can be open at once is observed, not guessed.
 */
import type { PanelCapture, StyleMap } from '../ir/types';
import { sanitizeInline } from './freeze';

type ReadStyles = ( el: Element, win: Window ) => StyleMap;

const TRIGGER = 'button[aria-expanded], [role="button"][aria-expanded], details > summary';

/** A native <details> summary (the browser's own accordion). */
const isSummary = ( el: Element ): boolean => el.tagName.toLowerCase() === 'summary' && el.parentElement?.tagName.toLowerCase() === 'details';

/** Triggers that open an in-page panel (not menus, dialogs or popovers). */
function isPanelTrigger( el: Element ): boolean {
	if ( el.hasAttribute( 'aria-haspopup' ) ) return false;
	if ( el.closest( 'nav, header, [role="menu"], [role="menubar"], [role="dialog"]' ) ) return false;
	if ( isSummary( el ) ) return true;
	return el.hasAttribute( 'aria-controls' ) || el.hasAttribute( 'data-state' ) || el.hasAttribute( 'data-radix-collection-item' );
}

/** A <details> element's content: everything but its <summary>. */
function detailsContent( summary: Element ): Element[] {
	return Array.from( summary.parentElement!.children ).filter( ( c ) => c !== summary && c.tagName.toLowerCase() !== 'summary' );
}

/** Group triggers by the nearest ancestor holding ≥2 of them (the accordion root). */
export function groupTriggers( triggers: Element[] ): Element[][] {
	const groups = new Map< Element, Element[] >();
	for ( const t of triggers ) {
		let p = t.parentElement;
		while ( p ) {
			const n = triggers.filter( ( o ) => p!.contains( o ) ).length;
			if ( n >= 2 ) break;
			p = p.parentElement;
		}
		if ( ! p ) continue;
		const list = groups.get( p ) ?? [];
		list.push( t );
		groups.set( p, list );
	}
	return [ ...groups.values() ].filter( ( g ) => g.length >= 2 );
}

/** The panel a trigger controls: its aria-controls target, else the item's region. */
function panelOf( trigger: Element, doc: Document ): Element | null {
	if ( isSummary( trigger ) ) {
		// One content element (the usual <div class="answer">) is the panel; otherwise the whole <details>.
		const content = detailsContent( trigger );
		return content.length === 1 ? content[ 0 ]! : trigger.parentElement;
	}
	const id = trigger.getAttribute( 'aria-controls' );
	const byId = id ? doc.getElementById( id ) : null;
	if ( byId ) return byId;
	let item: Element | null = trigger;
	while ( item?.parentElement && item.parentElement.querySelectorAll( TRIGGER ).length === 1 ) item = item.parentElement;
	return item?.querySelector( '[role="region"], [data-state="open"]:not(button)' ) ?? null;
}

const BLOCK = new Set( [ 'p', 'div', 'ul', 'ol', 'blockquote', 'h3', 'h4', 'h5', 'h6' ] );

/** Rich text of a panel: paragraphs and lists kept, inline formatting sanitized. */
export function panelHtml( panel: Element, win: Window ): string {
	const blocks = Array.from( panel.children ).filter( ( c ) => BLOCK.has( c.tagName.toLowerCase() ) );
	if ( ! blocks.length ) {
		// A <details> with inline answer text: everything but the summary.
		let src = panel;
		if ( panel.tagName.toLowerCase() === 'details' ) {
			src = panel.cloneNode( true ) as Element;
			Array.from( src.children ).filter( ( c ) => c.tagName.toLowerCase() === 'summary' ).forEach( ( s ) => s.remove() );
		}
		const inner = sanitizeInline( src, panel === src ? win : undefined );
		return inner ? `<p>${ inner }</p>` : '';
	}
	const out: string[] = [];
	for ( const b of blocks ) {
		const tag = b.tagName.toLowerCase();
		if ( tag === 'ul' || tag === 'ol' ) {
			const items = Array.from( b.children ).filter( ( li ) => li.tagName.toLowerCase() === 'li' ).map( ( li ) => `<li>${ sanitizeInline( li, win ) }</li>` );
			out.push( `<${ tag }>${ items.join( '' ) }</${ tag }>` );
		} else if ( tag === 'div' && b.querySelector( 'p, ul, ol' ) ) {
			out.push( panelHtml( b, win ) );
		} else {
			const inner = sanitizeInline( b, win );
			if ( inner ) out.push( `<p>${ inner }</p>` );
		}
	}
	return out.join( '' );
}

/** Rotation (deg) from a computed transform matrix and/or the `rotate` property. */
export function rotationOf( transform: string | undefined, rotate?: string ): number {
	let deg = 0;
	const m = ( transform ?? '' ).match( /^matrix\(([^,]+),\s*([^,]+)/ );
	if ( m ) deg += ( Math.atan2( parseFloat( m[ 2 ]! ), parseFloat( m[ 1 ]! ) ) * 180 ) / Math.PI;
	const r = ( rotate ?? '' ).match( /^(-?[\d.]+)deg$/ );
	if ( r ) deg += parseFloat( r[ 1 ]! );
	deg = Math.round( ( ( deg % 360 ) + 360 ) % 360 );
	return deg === 360 ? 0 : deg;
}

const expanded = ( t: Element ): boolean => ( isSummary( t ) ? ( t.parentElement as HTMLDetailsElement ).open : t.getAttribute( 'aria-expanded' ) === 'true' );

/** The summary shows the browser's disclosure triangle (not hidden with list-style:none). */
function hasMarker( summary: Element, win: Window ): boolean {
	const cs = win.getComputedStyle( summary );
	return cs.display === 'list-item' && cs.listStyleType !== 'none';
}

/** A one-character icon drawn by the trigger's ::before/::after ("+" that becomes "−"). */
export function pseudoGlyph( el: Element, win: Window ): { char: string; position: 'start' | 'end'; size?: number } | undefined {
	for ( const [ which, position ] of [ [ '::after', 'end' ], [ '::before', 'start' ] ] as const ) {
		try {
			const cs = win.getComputedStyle( el, which );
			const m = /^["'](.{1,2})["']$/u.exec( cs.content ?? '' );
			const size = parseFloat( cs.fontSize );
			if ( m && m[ 1 ]!.trim() ) return { char: m[ 1 ]!.trim(), position, ...( size > 0 ? { size } : {} ) };
		} catch {
			/* not supported */
		}
	}
	return undefined;
}

/** Wait until `done()` holds (frameworks render clicks asynchronously), up to `ms`. */
async function until( win: Window, done: () => boolean, ms = 400 ): Promise< boolean > {
	const start = Date.now();
	while ( ! done() ) {
		if ( Date.now() - start > ms ) return false;
		await new Promise( ( r ) => win.setTimeout( r, 16 ) );
	}
	return true;
}

/** Click a trigger and wait for its state to flip. */
async function toggle( win: Window, t: Element ): Promise< void > {
	const was = expanded( t );
	// <details>: set `open` directly (a page may intercept summary clicks). Exclusive groups
	// (<details name="faq">) still close the others, so "multiple" is observed correctly.
	if ( isSummary( t ) ) ( t.parentElement as HTMLDetailsElement ).open = ! was;
	else ( t as HTMLElement ).click();
	await until( win, () => expanded( t ) !== was );
}

/**
 * Open every accordion item, read its panel, restore the original state.
 * Returns panels keyed by the trigger's capture key, and per-group behaviour
 * keyed by the first trigger's key.
 */
export async function captureCollapsed(
	doc: Document,
	win: Window,
	keyAttr: string,
	readStyles: ReadStyles
): Promise< { panels: Map< string, PanelCapture >; groups: Map< string, { multiple: boolean } > } > {
	const panels = new Map< string, PanelCapture >();
	const groups = new Map< string, { multiple: boolean } >();
	const triggers = Array.from( doc.querySelectorAll( TRIGGER ) ).filter( ( t ) => t.hasAttribute( keyAttr ) && isPanelTrigger( t ) );
	for ( const group of groupTriggers( triggers ) ) {
		const initial = group.map( expanded );
		try {
			for ( const t of group ) {
				const closedGlyph = ! expanded( t ) ? pseudoGlyph( t, win ) : undefined;
				if ( ! expanded( t ) ) await toggle( win, t );
				const openGlyph = pseudoGlyph( t, win );
				await until( win, () => ( panelOf( t, doc )?.textContent ?? '' ).trim().length > 0 );
				const panel = panelOf( t, doc );
				if ( ! panel ) continue;
				const textEl = panel.querySelector( 'p, li' ) ?? panel;
				// shadcn rotates the chevron when open ([data-state=open]>svg{rotate:180deg}).
				const iconEl = t.querySelector( 'svg' );
				const iconCs = iconEl ? win.getComputedStyle( iconEl ) : null;
				const iconOpen = iconCs ? rotationOf( iconCs.transform, iconCs.getPropertyValue( 'rotate' ) ) : 0;
				const summaryText = isSummary( t ) && panel === t.parentElement ? ( t.textContent ?? '' ) : '';
				panels.set( t.getAttribute( keyAttr )!, {
					html: panelHtml( panel, win ),
					text: ( panel.textContent ?? '' ).replace( summaryText, '' ).replace( /\s+/g, ' ' ).trim(),
					styles: readStyles( panel, win ),
					textStyles: readStyles( textEl, win ),
					open: initial[ group.indexOf( t ) ]!,
					...( iconOpen ? { iconRotate: iconOpen } : {} ),
					...( isSummary( t ) && hasMarker( t, win ) ? { marker: true } : {} ),
					...( closedGlyph && openGlyph && closedGlyph.position === openGlyph.position ? { glyph: { closed: closedGlyph.char, open: openGlyph.char, position: closedGlyph.position, ...( closedGlyph.size ? { size: closedGlyph.size } : {} ) } } : {} ),
				} );
			}
			// Opened one after another without closing: all still open means "multiple".
			const openedNow = group.filter( ( t, i ) => ! initial[ i ] && expanded( t ) ).length;
			const closedBefore = initial.filter( ( x ) => ! x ).length;
			const multiple = closedBefore >= 2 && openedNow === closedBefore;
			groups.set( group[ 0 ]!.getAttribute( keyAttr )!, { multiple } );
			for ( const t of group ) {
				const p = panels.get( t.getAttribute( keyAttr )! );
				if ( p ) p.multiple = multiple;
			}
		} finally {
			// Restore: close what we opened (reverse order), re-open what was open.
			for ( let i = group.length - 1; i >= 0; i-- ) {
				if ( expanded( group[ i ]! ) !== initial[ i ] ) await toggle( win, group[ i ]! );
			}
			for ( let i = 0; i < group.length; i++ ) {
				if ( expanded( group[ i ]! ) !== initial[ i ] ) await toggle( win, group[ i ]! );
			}
		}
	}
	return { panels, groups };
}
