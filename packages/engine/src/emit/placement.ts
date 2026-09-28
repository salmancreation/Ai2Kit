/**
 * How a child sits inside its parent, derived from captured geometry.
 *
 * Elementor stretches children of column containers and gives nested
 * containers `--width: 100%`, so content-sized, max-width'd or centered
 * children need explicit widths and self-alignment to match the source.
 */
import type { IRNode } from '../ir/types';
import { px } from '../util/units';

export type Placement = {
	/** Narrower than the parent's content box. */
	narrow: boolean;
	/** Spans the parent's content box. */
	full: boolean;
	/** Content-sized (inline, inline-block, inline-flex). */
	inline: boolean;
	align: 'flex-start' | 'center' | 'flex-end';
};

export function innerBox( parent: IRNode ): { x: number; w: number } | null {
	if ( ! parent.rect ) return null;
	const s = parent.styles.desktop;
	const pl = ( px( s[ 'padding-left' ] ) ?? 0 ) + ( px( s[ 'border-left-width' ] ) ?? 0 );
	const pr = ( px( s[ 'padding-right' ] ) ?? 0 ) + ( px( s[ 'border-right-width' ] ) ?? 0 );
	let x = parent.rect.x + pl;
	let w = parent.rect.w - pl - pr;
	// A boxed section's content box is its boxed width, centered.
	if ( parent.innerMaxWidth && parent.innerMaxWidth < w ) {
		x += ( w - parent.innerMaxWidth ) / 2;
		w = parent.innerMaxWidth;
	}
	return w > 0 ? { x, w } : null;
}

export function isRowParent( parent: IRNode | undefined ): boolean {
	return !! parent && parent.layout?.display === 'flex' && parent.layout.direction === 'row';
}

export function isColumnParent( parent: IRNode | undefined ): boolean {
	if ( ! parent?.layout ) return false;
	return parent.layout.display === 'block' || ( parent.layout.display === 'flex' && parent.layout.direction === 'column' );
}

export function placement( node: IRNode, parent: IRNode | undefined ): Placement | null {
	if ( ! parent || ! node.rect || ! isColumnParent( parent ) ) return null;
	if ( node.styles.desktop.position === 'absolute' || node.styles.desktop.position === 'fixed' ) return null;
	const box = innerBox( parent );
	if ( ! box ) return null;
	const left = node.rect.x - box.x;
	const right = box.x + box.w - ( node.rect.x + node.rect.w );
	const narrow = node.rect.w < box.w - 2;
	let align: Placement[ 'align' ] = 'flex-start';
	if ( narrow ) {
		if ( left > 2 && Math.abs( left - right ) <= 3 ) align = 'center';
		else if ( left > 2 && right <= 2 ) align = 'flex-end';
	}
	const display = node.styles.desktop.display ?? 'block';
	return { narrow, full: ! narrow, inline: display.startsWith( 'inline' ), align };
}

/** Whether the parent already centers its children (align-items: center in a column). */
export function parentCenters( parent: IRNode | undefined ): boolean {
	return parent?.layout?.display === 'flex' && parent.layout.direction === 'column' && parent.layout.align === 'center';
}

/**
 * Extra height beyond what the children need: the source had an explicit
 * height or min-height (e.g. a 72px header bar, a full-screen hero).
 */
export function explicitMinHeight( node: IRNode ): number | null {
	if ( ! node.rect || ! node.children.length ) return null;
	const s = node.styles.desktop;
	const padV = ( px( s[ 'padding-top' ] ) ?? 0 ) + ( px( s[ 'padding-bottom' ] ) ?? 0 ) + ( px( s[ 'border-top-width' ] ) ?? 0 ) + ( px( s[ 'border-bottom-width' ] ) ?? 0 );
	const kids = node.children.filter( ( c ) => c.rect && c.styles.desktop.position !== 'absolute' && c.styles.desktop.position !== 'fixed' );
	if ( ! kids.length ) return null;
	const top = Math.min( ...kids.map( ( c ) => c.rect!.y ) );
	const bottom = Math.max( ...kids.map( ( c ) => c.rect!.y + c.rect!.h ) );
	const needed = bottom - top + padV;
	return node.rect.h - needed > 4 ? node.rect.h : null;
}
