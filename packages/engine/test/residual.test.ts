// @vitest-environment happy-dom
import { convert } from '../src/pipeline';
import { sanitizeInline } from '../src/capture/freeze';
import type { ResidualRule } from '../src/ir/types';
import { cn, text, capture, validateAgainstRegistry } from './helpers';

const R = ( y: number, h: number ) => ( { rect: { x: 0, y, w: 1440, h } } );

function page() {
	return cn( 'body', {}, [
		cn( 'section', { 'padding-top': '80px' }, [
			text( 'h1', 'Glow', { 'background-image': 'linear-gradient(90deg, rgb(124, 58, 237), rgb(37, 99, 235))', 'background-clip': 'text', color: 'rgba(0, 0, 0, 0)' } ),
			cn( 'div', { 'padding-top': '8px', transform: 'matrix(1, 0, 0, 1, 0, -8)', 'backdrop-filter': 'blur(12px)' }, [ text( 'p', 'a' ), text( 'p', 'b' ) ], { mobile: { transform: 'none' } } ),
		], R( 0, 600 ) ),
	], R( 0, 600 ) );
}

describe( 'residual CSS (G6)', () => {
	const result = convert( capture( page() ), 'res' );
	const rules = result.document.residual;

	it( 'keeps gradient text on headings, targeting the title element', () => {
		const r = rules.find( ( x ) => x.decls[ 'background-clip' ] === 'text' )!;
		expect( r ).toMatchObject( { target: ' .elementor-heading-title', breakpoint: 'desktop', label: 'Hero' } );
		expect( r.decls ).toMatchObject( { color: 'transparent', '-webkit-text-fill-color': 'transparent', 'background-image': expect.stringContaining( 'linear-gradient' ) } );
		const heading = result.document.content[ 0 ]!.elements.find( ( e ) => e.widgetType === 'heading' )!;
		expect( heading.settings._css_classes ).toBe( r.className );
	} );

	it( 'keeps transforms and backdrop filters, with responsive resets', () => {
		const box = result.document.content[ 0 ]!.elements.find( ( e ) => e.elType === 'container' )!;
		const cls = box.settings.css_classes as string;
		const mine = rules.filter( ( r ) => r.className === cls );
		expect( mine.map( ( r ) => r.breakpoint ) ).toEqual( [ 'desktop', 'mobile' ] );
		expect( mine[ 0 ]!.decls ).toEqual( { transform: 'matrix(1, 0, 0, 1, 0, -8)', 'backdrop-filter': 'blur(12px)', '-webkit-backdrop-filter': 'blur(12px)' } );
		expect( mine[ 1 ]!.decls ).toEqual( { transform: 'none' } );
		expect( validateAgainstRegistry( result.document.content ) ).toEqual( [] );
	} );

	it( 'turns gradient-text spans into classes with a rule', () => {
		const d = document.createElement( 'h1' );
		d.innerHTML = 'Build <span style="background-image: linear-gradient(90deg, red, blue); background-clip: text; color: transparent">faster</span>';
		document.body.appendChild( d );
		const found: ResidualRule[] = [];
		const html = sanitizeInline( d, window, found );
		expect( html ).toMatch( /^Build <span class="a2k-gt-[a-z0-9]+">faster<\/span>$/ );
		expect( found ).toHaveLength( 1 );
		expect( found[ 0 ]!.decls[ '-webkit-background-clip' ] ).toBe( 'text' );
	} );
} );
