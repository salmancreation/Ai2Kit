import type { CapturedNode, Capture, StyleMap } from '../src/ir/types';
import type { V3Element } from '../src/emit/v3';
import registry from '../../../tests/fixtures/elementor/controls-v3.json';

let n = 0;
export function resetKeys(): void {
	n = 0;
}

type Extra = Partial< Omit< CapturedNode, 'tag' | 'children' | 'styles' > > & { tablet?: StyleMap; mobile?: StyleMap };

/** Terse CapturedNode builder for tests. */
export function cn( tag: string, desktop: StyleMap = {}, children: CapturedNode[] = [], extra: Extra = {} ): CapturedNode {
	const { tablet, mobile, ...rest } = extra;
	const styles: CapturedNode[ 'styles' ] = { desktop: { display: 'block', ...desktop } };
	if ( tablet ) styles.tablet = tablet;
	if ( mobile ) styles.mobile = mobile;
	return { key: `k${ ++n }`, tag, attrs: {}, rect: { x: 0, y: 0, w: 1440, h: 100 }, styles, children, ...rest };
}

export const text = ( tag: string, t: string, desktop: StyleMap = {}, extra: Extra = {} ): CapturedNode =>
	cn( tag, { color: 'rgb(17, 21, 28)', 'font-size': '16px', 'font-weight': '400', 'line-height': '24px', 'font-family': 'Inter, sans-serif', ...desktop }, [], { text: t, html: t, ...extra } );

export function capture( root: CapturedNode, rootVars: Record< string, string > = {} ): Capture {
	return {
		meta: { title: 'Test page', lang: 'en', viewport: { desktop: 1440, tablet: 1024, mobile: 390 }, rootVars, fontFamilies: [], baseUrl: 'http://site.test/' },
		root,
	};
}

type Control = { type: string; options?: string[]; responsive?: boolean; fields?: string[] };
type Registry = { elements: Record< string, Record< string, Control > >; widgets: Record< string, Record< string, Control > > };
const reg = registry as unknown as Registry;

/** Settings keys that Elementor stores outside the control registry. */
const META_KEYS = new Set( [ '__globals__', '__dynamic__', '_title' ] );
const DEVICES = [ '_tablet', '_mobile' ];

/**
 * Validate an emitted element tree against the exported control registry:
 * every key must exist (or be a responsive variant of one that does), every
 * select/choose value must be a registered option, IDs must be unique 7-hex.
 */
export function validateAgainstRegistry( elements: V3Element[] ): string[] {
	const errors: string[] = [];
	const ids = new Set< string >();
	const visit = ( el: V3Element, path: string ): void => {
		if ( ! /^[0-9a-f]{7}$/.test( el.id ) ) errors.push( `${ path }: bad id ${ el.id }` );
		if ( ids.has( el.id ) ) errors.push( `${ path }: duplicate id ${ el.id }` );
		ids.add( el.id );
		const controls = el.elType === 'container' ? reg.elements.container : reg.widgets[ el.widgetType ?? '' ];
		if ( ! controls ) {
			errors.push( `${ path }: unknown element ${ el.elType }/${ el.widgetType }` );
			return;
		}
		for ( const [ key, value ] of Object.entries( el.settings ) ) {
			if ( META_KEYS.has( key ) ) continue;
			let base = key;
			let control = controls[ key ];
			if ( ! control ) {
				const dev = DEVICES.find( ( d ) => key.endsWith( d ) );
				if ( dev ) {
					base = key.slice( 0, -dev.length );
					control = controls[ base ];
					if ( control && ! control.responsive ) errors.push( `${ path }: ${ key } — ${ base } is not responsive` );
				}
			}
			if ( ! control ) {
				errors.push( `${ path }: unknown setting "${ key }" on ${ el.widgetType ?? 'container' }` );
				continue;
			}
			if ( ( control.type === 'select' || control.type === 'choose' ) && control.options && typeof value === 'string' && value !== '' ) {
				if ( ! control.options.includes( value ) ) errors.push( `${ path }: ${ key }="${ value }" not in [${ control.options.join( ', ' ) }]` );
			}
			if ( control.type === 'dimensions' ) {
				const v = value as Record< string, unknown >;
				if ( ! v.unit || typeof v.isLinked !== 'boolean' ) errors.push( `${ path }: ${ key } dimensions missing unit/isLinked` );
			}
			if ( control.type === 'slider' ) {
				const v = value as Record< string, unknown >;
				if ( typeof v.unit !== 'string' || ! ( 'size' in v ) ) errors.push( `${ path }: ${ key } slider missing unit/size` );
			}
			if ( control.type === 'repeater' && Array.isArray( value ) && control.fields ) {
				for ( const item of value as Array< Record< string, unknown > > ) {
					for ( const f of Object.keys( item ) ) {
						if ( ! control.fields.includes( f ) ) errors.push( `${ path }: ${ key}[].${ f } not a repeater field` );
					}
				}
			}
		}
		const globals = ( el.settings.__globals__ ?? {} ) as Record< string, string >;
		for ( const [ k, ref ] of Object.entries( globals ) ) {
			if ( ! controls[ k ] ) errors.push( `${ path }: __globals__.${ k } is not a control` );
			if ( ! /^globals\/(colors|typography)\?id=[\w-]+$/.test( ref ) ) errors.push( `${ path }: bad global ref ${ ref }` );
		}
		el.elements.forEach( ( c, i ) => visit( c, `${ path }/${ c.widgetType ?? 'container' }[${ i }]` ) );
	};
	elements.forEach( ( e, i ) => visit( e, `[${ i }]` ) );
	return errors;
}
