/**
 * Leaf mapping (FR-15). Deterministic rules in priority order; each rule is a
 * small predicate so it can be unit-tested on its own.
 */
import type { CapturedNode, NodeContent, NodeKind, StyleMap } from '../ir/types';
import { isTransparent } from '../util/color';
import { px } from '../util/units';

export type Classification = { kind: NodeKind; content?: NodeContent; fallbackReason?: string };

const HEADING = /^h[1-6]$/;

export function lucideName( cls: string | undefined ): string | undefined {
	if ( ! cls ) return undefined;
	const m = cls.match( /\blucide-([a-z0-9-]+)/ );
	if ( m && m[ 1 ] !== 'icon' ) return m[ 1 ];
	return undefined;
}

export function isButtonLike( s: StyleMap ): boolean {
	const padV = ( px( s[ 'padding-top' ] ) ?? 0 ) + ( px( s[ 'padding-bottom' ] ) ?? 0 );
	const padH = ( px( s[ 'padding-left' ] ) ?? 0 ) + ( px( s[ 'padding-right' ] ) ?? 0 );
	const hasBg = ! isTransparent( s[ 'background-color' ] ) || /gradient/.test( s[ 'background-image' ] ?? '' );
	const hasBorder = ( px( s[ 'border-top-width' ] ) ?? 0 ) > 0 && s[ 'border-top-style' ] !== 'none';
	return padV >= 4 && padH >= 8 && ( hasBg || hasBorder );
}

/** "Large bold single-line text" is a heading even without an h-tag. */
export function isDisplayText( node: CapturedNode ): boolean {
	const s = node.styles.desktop;
	const size = px( s[ 'font-size' ] ) ?? 16;
	const weight = parseInt( s[ 'font-weight' ] ?? '400', 10 );
	const lh = px( s[ 'line-height' ] ) ?? size * 1.3;
	const text = node.text ?? '';
	return size >= 28 && weight >= 600 && text.length <= 90 && node.rect.h <= lh * 1.6;
}

export function textOf( n: CapturedNode ): string {
	if ( n.text !== undefined ) return n.text;
	return n.children.map( textOf ).filter( Boolean ).join( ' ' ).trim();
}

function findSvg( n: CapturedNode ): CapturedNode | undefined {
	if ( n.tag === 'svg' ) return n;
	for ( const c of n.children ) {
		const f = findSvg( c );
		if ( f ) return f;
	}
	return undefined;
}

function videoFromIframe( src: string ): NodeContent | null {
	const yt = src.match( /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/ );
	if ( yt ) return { videoType: 'youtube', src: `https://www.youtube.com/watch?v=${ yt[ 1 ] }` };
	const vm = src.match( /vimeo\.com\/(?:video\/)?(\d+)/ );
	if ( vm ) return { videoType: 'vimeo', src: `https://vimeo.com/${ vm[ 1 ] }` };
	return null;
}

/** Icon list: a ul/ol whose items each carry an icon. */
export function asIconList( node: CapturedNode ): NodeContent | null {
	if ( node.tag !== 'ul' && node.tag !== 'ol' ) return null;
	const items = node.children.filter( ( c ) => c.tag === 'li' );
	if ( items.length < 2 || items.length !== node.children.length ) return null;
	const out: NonNullable< NodeContent[ 'items' ] > = [];
	for ( const li of items ) {
		const svg = findSvg( li );
		if ( ! svg ) return null;
		const text = textOf( li );
		if ( ! text ) return null;
		const item: NonNullable< NodeContent[ 'items' ] >[ number ] = { text };
		const icon = lucideName( svg.attrs.class ?? li.attrs[ 'data-a2k-icon' ] );
		if ( icon ) item.iconName = icon;
		if ( svg.svg ) item.svg = svg.svg;
		const a = li.attrs.href ? li : li.children.find( ( c ) => c.tag === 'a' );
		if ( a?.attrs.href ) item.href = a.attrs.href;
		out.push( item );
	}
	const first = items[ 0 ]!;
	const svg0 = findSvg( first );
	const content: NodeContent = { items: out, tag: node.tag };
	if ( svg0 && svg0.rect.w > 0 && svg0.rect.w <= 128 ) content.iconSize = svg0.rect.w;
	const liGap = px( first.styles.desktop[ 'column-gap' ] );
	if ( liGap ) content.iconGap = liGap;
	return content;
}

/** Plain list of text-only items → one Text Editor widget with list markup. */
export function asTextList( node: CapturedNode ): NodeContent | null {
	if ( node.tag !== 'ul' && node.tag !== 'ol' ) return null;
	if ( ! node.children.length || node.children.some( ( c ) => c.tag !== 'li' || c.children.length > 0 ) ) return null;
	const lis = node.children.map( ( li ) => `<li>${ li.html ?? li.text ?? '' }</li>` ).join( '' );
	return { html: `<${ node.tag }>${ lis }</${ node.tag }>`, text: node.children.map( ( c ) => c.text ).join( ' ' ) };
}

export function hasVisualBox( s: StyleMap ): boolean {
	return (
		! isTransparent( s[ 'background-color' ] ) ||
		( s[ 'background-image' ] !== undefined && s[ 'background-image' ] !== 'none' ) ||
		[ 'top', 'right', 'bottom', 'left' ].some( ( side ) => ( px( s[ `border-${ side }-width` ] ) ?? 0 ) > 0 ) ||
		( s[ 'box-shadow' ] !== undefined && s[ 'box-shadow' ] !== 'none' )
	);
}

export function classify( node: CapturedNode ): Classification {
	const tag = node.tag;
	const a = node.attrs;
	const s = node.styles.desktop;

	if ( tag === '#text' ) return { kind: 'text', content: { text: node.text ?? '', html: node.html ?? '' } };

	if ( HEADING.test( tag ) && node.children.length === 0 ) {
		return { kind: 'heading', content: { text: node.text ?? textOf( node ), html: node.html ?? '', tag } };
	}

	if ( tag === 'img' ) {
		const content: NodeContent = { src: a.src ?? '', alt: a.alt ?? '' };
		return content.src ? { kind: 'image', content } : { kind: 'spacer' };
	}

	if ( tag === 'svg' ) {
		const content: NodeContent = { svg: node.svg ?? '' };
		const name = lucideName( a.class );
		if ( name ) content.iconName = name;
		return { kind: 'icon', content };
	}

	if ( tag === 'video' ) return { kind: 'video', content: { videoType: 'hosted', src: a.src ?? '' } };

	if ( tag === 'iframe' ) {
		const v = videoFromIframe( a.src ?? '' );
		if ( v ) return { kind: 'video', content: v };
		return { kind: 'embed', fallbackReason: 'Embedded frame', content: { src: a.src ?? '' } };
	}

	if ( tag === 'hr' ) return { kind: 'divider' };

	if ( tag === 'form' ) return { kind: 'form', fallbackReason: 'Forms need Pro to map natively' };
	if ( node.frozen ) {
		return { kind: 'embed', fallbackReason: `No Elementor widget for <${ tag }>` };
	}

	if ( ( tag === 'a' || tag === 'button' ) && node.children.length === 0 ) {
		const text = node.text ?? '';
		const iconName = lucideName( a[ 'data-a2k-icon' ] );
		const href = a.href ?? '';
		if ( ! text && node.svg ) {
			const content: NodeContent = { svg: node.svg };
			if ( iconName ) content.iconName = iconName;
			if ( href ) content.href = href;
			return { kind: 'icon', content };
		}
		if ( isButtonLike( s ) || ( tag === 'button' && text ) ) {
			const content: NodeContent = { text, href };
			if ( a.target ) content.target = a.target;
			if ( iconName ) content.iconName = iconName;
			if ( node.svg ) content.svg = node.svg;
			if ( a[ 'data-a2k-icon-pos' ] === 'after' ) content.iconPos = 'after';
			const iconSize = parseFloat( a[ 'data-a2k-icon-size' ] ?? '' );
			if ( iconSize > 0 ) content.iconSize = iconSize;
			return { kind: 'button', content };
		}
		const html = href ? `<a href="${ href.replace( /"/g, '&quot;' ) }">${ node.html ?? text }</a>` : node.html ?? text;
		return { kind: 'text', content: { text, html } };
	}

	const iconList = asIconList( node );
	if ( iconList ) return { kind: 'list', content: iconList };
	const textList = asTextList( node );
	if ( textList ) return { kind: 'text', content: textList };

	if ( node.children.length === 0 && node.text ) {
		if ( isDisplayText( node ) ) return { kind: 'heading', content: { text: node.text, html: node.html ?? '', tag: 'div' } };
		const html = tag === 'blockquote' ? `<blockquote>${ node.html ?? '' }</blockquote>` : node.html ?? '';
		return { kind: 'text', content: { text: node.text, html } };
	}

	if ( node.children.length === 0 ) {
		if ( hasVisualBox( s ) ) return { kind: 'container' };
		return { kind: 'spacer' };
	}

	return { kind: 'container' };
}
