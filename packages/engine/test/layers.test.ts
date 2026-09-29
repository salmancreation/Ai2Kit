import { convert } from '../src/pipeline';
import type { V3Element } from '../src/emit/v3';
import type { V4Element } from '../src/emit/v4';
import type { CapturedNode } from '../src/ir/types';
import { bgPosition } from '../src/emit/v3';
import { fadeColors } from '../src/emit/v4';
import { covers, withAlpha } from '../src/normalize/layers';
import { capture, cn, resetKeys, text, validateAgainstRegistry } from './helpers';

type El = V3Element | V4Element;
const all = ( els: El[] ): El[] => els.flatMap( ( e ) => [ e, ...all( e.elements as El[] ) ] );
const HERO = { x: 0, y: 0, w: 1440, h: 520 };
const OVERLAY = 'linear-gradient(rgba(11, 31, 56, 0.35) 0%, rgba(11, 31, 56, 0.55) 55%, rgba(11, 31, 56, 0.92) 100%)';

function hero( layers: CapturedNode[], heroStyles: Record< string, string > = {} ) {
	const content = cn( 'div', { position: 'relative', display: 'flex', 'flex-direction': 'column', 'padding-top': '160px' }, [ text( 'h1', 'Chalet Les Pelerins', { 'font-size': '56px', color: 'rgb(255, 255, 255)' } ) ], { rect: { x: 0, y: 200, w: 1440, h: 320 } } );
	const section = cn( 'section', { position: 'relative', display: 'flex', 'min-height': '520px', 'background-color': 'rgb(11, 31, 56)', ...heroStyles }, [ ...layers, content ], { rect: HERO, attrs: { class: 'hero' } } );
	return capture( cn( 'body', {}, [ section ] ) );
}

/** A `.hero__bg` div: absolute, inset 0, background image, with a ::after gradient. */
function bgDiv( withOverlay = true ): CapturedNode {
	const n = cn( 'div', { position: 'absolute', 'background-image': 'url("https://site.test/hero.jpg")', 'background-size': 'cover', 'background-position': '50% 50%', 'background-repeat': 'no-repeat' }, [], { rect: HERO } );
	if ( withOverlay ) n.pseudoLayers = { after: { position: 'absolute', top: '0px', right: '0px', bottom: '0px', left: '0px', 'background-image': OVERLAY, opacity: '1' } };
	return n;
}

const heroOf = ( els: El[] ): V3Element => els[ 0 ] as V3Element;

describe( 'background layers → the section\'s own Background / Background Overlay', () => {
	it( 'lifts a .hero__bg div and its ::after gradient into the hero (v3)', () => {
		resetKeys();
		const els = convert( hero( [ bgDiv() ] ), 'bg-1' ).document.content as V3Element[];
		const s = heroOf( els ).settings;
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
		expect( s.background_background ).toBe( 'classic' );
		expect( ( s.background_image as { url: string } ).url ).toBe( 'https://site.test/hero.jpg' );
		expect( s.background_size ).toBe( 'cover' );
		expect( s.background_position ).toBe( 'center center' );
		expect( s.background_overlay_background ).toBe( 'gradient' );
		expect( s.background_overlay_color ).toBe( '#0B1F3859' );
		expect( s.background_overlay_color_b ).toBe( '#0B1F38EB' );
		expect( s.background_overlay_opacity ).toEqual( { unit: 'px', size: 1, sizes: [] } );
		// No absolutely positioned layer container is left behind.
		expect( all( els ).filter( ( e ) => e.elType === 'container' && ( e as V3Element ).settings.position === 'absolute' ) ).toHaveLength( 0 );
	} );

	it( 'lifts <img class="absolute inset-0 object-cover"> + a bg-black/50 div (the Tailwind pattern)', () => {
		resetKeys();
		const img = cn( 'img', { position: 'absolute', 'object-fit': 'cover', 'object-position': '50% 0%' }, [], { rect: HERO, attrs: { src: 'https://site.test/beach.jpg', alt: '' } } );
		const shade = cn( 'div', { position: 'absolute', 'background-color': 'rgba(0, 0, 0, 0.5)' }, [], { rect: HERO } );
		const els = convert( hero( [ img, shade ] ), 'bg-2' ).document.content as V3Element[];
		const s = heroOf( els ).settings;
		expect( ( s.background_image as { url: string } ).url ).toBe( 'https://site.test/beach.jpg' );
		expect( s.background_position ).toBe( 'top center' );
		expect( s.background_overlay_background ).toBe( 'classic' );
		expect( s.background_overlay_color ).toBe( '#00000080' );
		expect( all( els ).some( ( e ) => e.widgetType === 'image' ) ).toBe( false );
	} );

	it( 'turns a faded image over the section color into image + color overlay', () => {
		resetKeys();
		const img = cn( 'img', { position: 'absolute', 'object-fit': 'cover', opacity: '0.4' }, [], { rect: HERO, attrs: { src: 'https://site.test/a.jpg' } } );
		const s = heroOf( convert( hero( [ img ] ), 'bg-3' ).document.content as V3Element[] ).settings;
		// The section color, as a hex or its Global Color.
		expect( s.background_overlay_color ?? ( s.__globals__ as Record< string, string > ).background_overlay_color ).toMatch( /^(#0B1F38|globals\/colors\?id=\w+)$/ );
		expect( s.background_overlay_opacity ).toEqual( { unit: 'px', size: 0.6, sizes: [] } );
	} );

	it( 'leaves layers alone when they don\'t cover the section, sit above the content, or hold content', () => {
		resetKeys();
		const small = cn( 'div', { position: 'absolute', 'background-image': 'url("https://site.test/blob.png")' }, [], { rect: { x: 1000, y: 0, w: 300, h: 300 } } );
		const withText = cn( 'div', { position: 'absolute', 'background-image': 'url("https://site.test/x.jpg")' }, [ text( 'span', 'Badge' ) ], { rect: HERO } );
		const els = convert( hero( [ small, withText ] ), 'bg-4' ).document.content as V3Element[];
		expect( heroOf( els ).settings.background_image ).toBeUndefined();
	} );

	it( 'writes the overlay as a background layer in v4 (validated shape, converter-friendly shorthand)', () => {
		resetKeys();
		const els = convert( hero( [ bgDiv() ] ), 'bg-5', { format: 'v4' } ).document.content as El[];
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
		const css = ( els[ 0 ] as V4Element ).css?.desktop ?? '';
		expect( css ).toContain( 'background: linear-gradient(180deg, rgba(11, 31, 56, 0.35) 0%, rgba(11, 31, 56, 0.55) 55%, rgba(11, 31, 56, 0.92) 100%), url("https://site.test/hero.jpg") 50% 50% / cover no-repeat, rgb(11, 31, 56);' );
		expect( all( els ).length ).toBeLessThan( 6 ); // No layer element.
	} );
} );

describe( 'layer helpers', () => {
	it( 'checks coverage within 2px', () => {
		expect( covers( { x: -1, y: 0, w: 1442, h: 520 }, HERO ) ).toBe( true );
		expect( covers( { x: 0, y: 0, w: 1400, h: 520 }, HERO ) ).toBe( false );
	} );

	it( 'maps background positions to Elementor options', () => {
		expect( bgPosition( '50% 50%' ) ).toBe( 'center center' );
		expect( bgPosition( '50% 0%' ) ).toBe( 'top center' );
		expect( bgPosition( '100% 100%' ) ).toBe( 'bottom right' );
		expect( bgPosition( 'top center' ) ).toBe( 'top center' );
		expect( bgPosition( '30% 70%' ) ).toBeUndefined();
	} );

	it( 'fades colors by an opacity', () => {
		expect( withAlpha( 'rgb(0, 0, 0)', 0.5 ) ).toBe( 'rgba(0, 0, 0, 0.5)' );
		expect( fadeColors( 'linear-gradient(90deg, rgba(0, 0, 0, 0.5) 0%, rgb(255, 255, 255) 100%)', 0.5 ) ).toBe( 'linear-gradient(90deg, rgba(0, 0, 0, 0.25) 0%, rgba(255, 255, 255, 0.5) 100%)' );
	} );
} );

describe( 'boxed hero keeps its vertical placement', () => {
	it( 'a section with align-items:flex-end keeps its content at the bottom after the inner box merges', () => {
		resetKeys();
		const inner = cn( 'div', { 'max-width': '1080px', 'margin-left': '180px', 'margin-right': '180px', 'padding-top': '160px', 'padding-bottom': '64px' }, [ text( 'h1', 'Chalet', { 'font-size': '56px' } ) ], { rect: { x: 180, y: 200, w: 1080, h: 320 } } );
		const section = cn( 'section', { display: 'flex', 'align-items': 'flex-end', 'min-height': '520px', 'background-color': 'rgb(11, 31, 56)' }, [ bgDiv(), inner ], { rect: HERO } );
		const els = convert( capture( cn( 'body', {}, [ section ] ) ), 'bg-6' ).document.content as V3Element[];
		const s = els[ 0 ]!.settings;
		expect( s.background_overlay_background ).toBe( 'gradient' );
		expect( s.flex_direction ).toBe( 'column' );
		expect( s.flex_justify_content ).toBe( 'flex-end' );
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
	} );
} );
