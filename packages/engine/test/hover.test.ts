// @vitest-environment happy-dom
import { convert } from '../src/pipeline';
import type { V3Element } from '../src/emit/v3';
import type { V4Element } from '../src/emit/v4';
import { baseSelector, rewriteHoverSelector } from '../src/capture/hover';
import { matrixParts, transitionSeconds } from '../src/util/units';
import { capture, cn, resetKeys, text, validateAgainstRegistry } from './helpers';

type El = V3Element | V4Element;
/** A color setting's value: a hex, or its global reference when bound to a token. */
const colorOf = ( s: Record< string, unknown >, key: string ): unknown => s[ key ] ?? ( s.__globals__ as Record< string, string > | undefined )?.[ key ];
const all = ( els: El[] ): El[] => els.flatMap( ( e ) => [ e, ...all( e.elements as El[] ) ] );

describe( 'hover selector rewrite', () => {
	it( 'replaces :hover in the last compound only', () => {
		expect( rewriteHoverSelector( '.btn:hover' ) ).toBe( '.btn[data-a2k-hover]' );
		expect( rewriteHoverSelector( 'nav a:hover' ) ).toBe( 'nav a[data-a2k-hover]' );
		expect( rewriteHoverSelector( '.hover\\:bg-primary\\/90:hover' ) ).toBe( '.hover\\:bg-primary\\/90[data-a2k-hover]' );
		expect( rewriteHoverSelector( '.card:hover:not(.x)' ) ).toBe( '.card[data-a2k-hover]:not(.x)' );
		expect( rewriteHoverSelector( '.a > .b:hover' ) ).toBe( '.a > .b[data-a2k-hover]' );
	} );

	it( 'skips hover on an ancestor (group-hover), bare :hover and look-alikes', () => {
		expect( rewriteHoverSelector( '.group:hover .group-hover\\:x' ) ).toBeNull();
		expect( rewriteHoverSelector( ':hover' ) ).toBeNull();
		expect( rewriteHoverSelector( '.btn' ) ).toBeNull();
		expect( rewriteHoverSelector( '.x:hover-ish' ) ).toBeNull();
	} );

	it( 'derives the selector of elements the rule can apply to', () => {
		expect( baseSelector( 'nav a[data-a2k-hover]' ) ).toBe( 'nav a' );
	} );
} );

describe( 'hover values', () => {
	it( 'reads transition durations', () => {
		expect( transitionSeconds( '0.15s' ) ).toBe( 0.15 );
		expect( transitionSeconds( '0s, 200ms' ) ).toBe( 0.2 );
		expect( transitionSeconds( '0s' ) ).toBeNull();
		expect( transitionSeconds( undefined ) ).toBeNull();
	} );

	it( 'splits matrices into translate/rotate/scale numbers', () => {
		expect( matrixParts( 'matrix(1, 0, 0, 1, 0, -4)' ) ).toMatchObject( { x: 0, y: -4, rotate: 0, scaleX: 1 } );
		expect( matrixParts( 'none' ) ).toMatchObject( { x: 0, y: 0, scaleX: 1 } );
		expect( matrixParts( 'matrix(1, 0, 0.5, 1, 0, 0)' ) ).toBeNull();
	} );
} );

function page() {
	resetKeys();
	const btn = text( 'a', 'Get started', {
		display: 'inline-flex',
		'background-color': 'rgb(109, 74, 255)',
		color: 'rgb(255, 255, 255)',
		'padding-top': '12px',
		'padding-bottom': '12px',
		'padding-left': '20px',
		'padding-right': '20px',
		'border-top-left-radius': '8px',
		'border-top-right-radius': '8px',
		'border-bottom-left-radius': '8px',
		'border-bottom-right-radius': '8px',
	}, { attrs: { href: 'https://site.test/start' }, rect: { x: 0, y: 0, w: 140, h: 44 } } );
	btn.styles.hover = { 'background-color': 'rgb(90, 60, 230)', transform: 'matrix(1, 0, 0, 1, 0, -2)', 'transition-property': 'all', 'transition-duration': '0.2s' };
	const link = text( 'a', 'Pricing', {}, { attrs: { href: 'https://site.test/pricing' }, rect: { x: 0, y: 0, w: 60, h: 24 } } );
	link.styles.hover = { color: 'rgb(109, 74, 255)', 'transition-property': 'color', 'transition-duration': '150ms' };
	const card = cn( 'div', {
		'background-color': 'rgb(255, 255, 255)',
		'border-top-width': '1px',
		'border-top-style': 'solid',
		'border-top-color': 'rgb(228, 231, 236)',
		'border-bottom-width': '1px',
		'border-bottom-style': 'solid',
		'border-left-width': '1px',
		'border-left-style': 'solid',
		'border-right-width': '1px',
		'border-right-style': 'solid',
		'padding-top': '24px',
	}, [ text( 'h3', 'Fast', { 'font-size': '20px' } ), text( 'p', 'Ships in minutes.' ) ], { rect: { x: 0, y: 200, w: 360, h: 160 } } );
	card.styles.hover = { 'box-shadow': 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px', 'border-top-color': 'rgb(109, 74, 255)', 'transition-property': 'box-shadow, border-color', 'transition-duration': '0.3s' };
	const section = cn( 'section', { display: 'flex', 'flex-direction': 'column', 'row-gap': '16px', 'padding-top': '64px' }, [ link, btn, card ] );
	return capture( cn( 'body', {}, [ section ] ) );
}

describe( 'hover → v3 hover controls', () => {
	const els = convert( page(), 'hover-v3' ).document.content as V3Element[];
	const flat = all( els ) as V3Element[];

	it( 'passes the control registry', () => {
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
	} );

	it( 'maps button hover background, lift and duration', () => {
		const b = flat.find( ( e ) => e.widgetType === 'button' )!.settings;
		expect( b.button_background_hover_background ).toBe( 'classic' );
		expect( b.button_background_hover_color ).toBe( '#5A3CE6' );
		expect( b.button_hover_transition_duration ).toEqual( { unit: 's', size: 0.2, sizes: [] } );
		expect( b._transform_translate_popover_hover ).toBe( 'transform' );
		expect( b._transform_translateY_effect_hover ).toEqual( { unit: 'px', size: -2, sizes: [] } );
		expect( b._transform_transition_hover ).toEqual( { unit: 'ms', size: 200, sizes: [] } );
	} );

	it( 'maps link hover color on text widgets', () => {
		const t = flat.find( ( e ) => e.widgetType === 'text-editor' && String( e.settings.editor ).includes( 'Pricing' ) )!.settings;
		expect( colorOf( t, 'link_hover_color' ) ).toMatch( /^(#6D4AFF|globals\/colors\?id=\w+)$/ );
		expect( t.link_hover_color_transition_duration ).toEqual( { unit: 's', size: 0.15, sizes: [] } );
	} );

	it( 'maps card hover shadow and border color on containers', () => {
		const c = flat.find( ( e ) => e.elType === 'container' && e.settings.box_shadow_hover_box_shadow_type === 'yes' )!.settings;
		expect( c.box_shadow_hover_box_shadow ).toEqual( { horizontal: 0, vertical: 10, blur: 15, spread: -3, color: 'rgba(0, 0, 0, 0.1)' } );
		expect( c.border_hover_border ).toBe( 'solid' );
		expect( colorOf( c, 'border_hover_color' ) ).toMatch( /^(#6D4AFF|globals\/colors\?id=\w+)$/ );
		expect( c.border_hover_transition ).toEqual( { unit: 'px', size: 0.3, sizes: [] } );
	} );
} );

describe( 'hover → v4 hover state', () => {
	const els = convert( page(), 'hover-v4', { format: 'v4' } ).document.content as El[];
	const flat = all( els ) as V4Element[];

	it( 'passes the atomic schema', () => {
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
	} );

	it( 'emits a hover block and a transition limited to the changed properties', () => {
		const b = flat.find( ( e ) => e.widgetType === 'e-button' )!;
		expect( b.css?.hover ).toBe( 'background-color: rgb(90, 60, 230); transform: translate(0px, -2px);' );
		expect( b.css?.desktop ).toContain( 'transition: background-color 0.2s, transform 0.2s;' );
		const card = flat.find( ( e ) => e.css?.hover?.includes( 'box-shadow' ) )!;
		expect( card.css?.hover ).toBe( 'border-color: rgb(109, 74, 255); box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.1);' );
		expect( card.css?.desktop ).toContain( 'transition: box-shadow 0.3s, border-color 0.3s;' );
		expect( card.css?.tablet ?? '' ).not.toContain( 'transition' );
	} );
} );

describe( 'hover capture in a DOM', () => {
	it( 'finds hover rules and diffs the hovered element', async () => {
		const { captureHover } = await import( '../src/capture/hover' );
		document.head.innerHTML = '<style>.btn{color:rgb(0, 0, 0);transition:color .2s}.btn:hover{color:rgb(255, 0, 0)}.group:hover .x{color:blue}</style>';
		document.body.innerHTML = '<a class="btn" data-a2k-key="n1">Go</a><div class="group"><span class="x" data-a2k-key="n2">x</span></div>';
		const map = captureHover( document, window, 'data-a2k-key' );
		expect( map.get( 'n1' )?.color ).toBe( 'rgb(255, 0, 0)' );
		expect( map.has( 'n2' ) ).toBe( false );
		expect( document.querySelector( 'style[data-a2k]' ) ).toBeNull();
	} );
} );
