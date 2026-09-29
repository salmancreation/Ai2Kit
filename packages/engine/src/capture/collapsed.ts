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

const TRIGGER = 'button[aria-expanded], [role="button"][aria-expanded]';

/** Triggers that open an in-page panel (not menus, dialogs or popovers). */
function isPanelTrigger( el: Element ): boolean {
	if ( el.hasAttribute( 'aria-haspopup' ) ) return false;
	if ( el.closest( 'nav, header, [role="menu"], [role="menubar"], [role="dialog"]' ) ) return false;
	return el.hasAttribute( 'aria-controls' ) || el.hasAttribute( 'data-state' ) || el.hasAttribute( 'data-radix-collection-item' );
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
		const inner = sanitizeInline( panel, win );
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

const expanded = ( t: Element ): boolean => t.getAttribute( 'aria-expanded' ) === 'true';

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
	( t as HTMLElement ).click();
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
				if ( ! expanded( t ) ) await toggle( win, t );
				await until( win, () => ( panelOf( t, doc )?.textContent ?? '' ).trim().length > 0 );
				const panel = panelOf( t, doc );
				if ( ! panel ) continue;
				const textEl = panel.querySelector( 'p, li' ) ?? panel;
				panels.set( t.getAttribute( keyAttr )!, {
					html: panelHtml( panel, win ),
					text: ( panel.textContent ?? '' ).replace( /\s+/g, ' ' ).trim(),
					styles: readStyles( panel, win ),
					textStyles: readStyles( textEl, win ),
					open: initial[ group.indexOf( t ) ]!,
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
