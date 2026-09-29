// @vitest-environment happy-dom
import { serializeSvg } from '../src/capture/freeze';
import { rotationOf } from '../src/capture/collapsed';
import { rotateSvg } from '../src/emit/accordion';
import { iconSetting } from '../src/emit/v3';

const NS = 'http://www.w3.org/2000/svg';

function mount( html: string, css = '' ): SVGElement {
	document.head.innerHTML = css ? `<style>${ css }</style>` : '';
	document.body.innerHTML = html;
	return document.querySelector( 'svg' )!;
}

describe( 'serializeSvg: icons render the same outside the source page', () => {
	it( 'bakes CSS-driven fill onto shapes (e.g. `.pill svg { fill }`) and resolves currentColor', () => {
		const svg = mount(
			`<span class="pill" style="color: rgb(245, 158, 11)"><svg xmlns="${ NS }" class="star" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg></span>`,
			'.pill svg { fill: rgb(245, 158, 11); }'
		);
		const out = serializeSvg( svg, window );
		expect( out ).toContain( 'fill="rgb(245, 158, 11)"' );
		expect( out ).toContain( 'stroke="rgb(245, 158, 11)"' );
		expect( out ).not.toMatch( /currentColor|class=/i );
	} );

	it( 'keeps outline icons outlined: shapes carry fill="none"', () => {
		const svg = mount( `<svg xmlns="${ NS }" viewBox="0 0 24 24" fill="none" stroke="rgb(0, 0, 0)"><path d="M5 12h14"/><circle cx="12" cy="12" r="3"/></svg>` );
		const out = serializeSvg( svg, window );
		expect( out.match( /<(path|circle)[^>]*fill="none"/g ) ).toHaveLength( 2 );
	} );

	it( 'drops scripts, handlers, style elements and inline styles', () => {
		const svg = mount( `<svg xmlns="${ NS }" viewBox="0 0 10 10" onload="x()"><style>path{fill:red}</style><script>alert(1)</script><path d="M0 0h10" style="fill: blue" onclick="y()"/></svg>` );
		const out = serializeSvg( svg, window );
		expect( out ).not.toMatch( /<script|<style|onload|onclick|style=/ );
	} );

	it( 'inlines sprite references so the icon is self-contained', () => {
		const svg = mount( `<svg style="display:none"><symbol id="i-check" viewBox="0 0 20 20"><path d="M4 10l4 4 8-8"/></symbol></svg><button><svg xmlns="${ NS }" width="20" height="20"><use href="#i-check"/></svg></button>` );
		const icon = document.querySelectorAll( 'svg' )[ 1 ]!;
		expect( svg ).toBeDefined();
		const out = serializeSvg( icon, window );
		expect( out ).toContain( 'd="M4 10l4 4 8-8"' );
		expect( out ).not.toContain( '<use' );
		expect( out ).toContain( 'viewBox="0 0 20 20"' );
	} );

	it( 'keeps gradients: absolute paint URLs become local, shared <defs> are copied in', () => {
		mount( `<svg style="position:absolute;width:0;height:0"><defs><linearGradient id="shared"><stop offset="0" stop-color="#f97316"/></linearGradient></defs></svg><svg id="icon" xmlns="${ NS }" viewBox="0 0 10 10"><rect width="10" height="10" fill="url(#shared)"/></svg>` );
		const icon = document.getElementById( 'icon' )!;
		// Browsers report paint servers as absolute URLs.
		icon.querySelector( 'rect' )!.setAttribute( 'fill', 'url("http://site.test/page/index.html#shared")' );
		const out = serializeSvg( icon, window );
		expect( out ).toContain( 'fill="url(#shared)"' );
		expect( out ).toMatch( /<defs><linearGradient id="shared">/ );
		expect( out ).not.toContain( 'site.test' );
	} );

	it( 'adds a viewBox from width/height so a resized icon scales instead of cropping', () => {
		const svg = mount( `<svg xmlns="${ NS }" width="32" height="16"><rect width="32" height="16"/></svg>` );
		expect( serializeSvg( svg, window ) ).toContain( 'viewBox="0 0 32 16"' );
	} );
} );

describe( 'icon settings', () => {
	it( 'prefers the exact SVG; Font Awesome only without one', () => {
		expect( iconSetting( 'check', '<svg/>' )?.library ).toBe( 'svg' );
		expect( iconSetting( 'check', undefined ) ).toEqual( { value: 'fas fa-check', library: 'fa-solid' } );
		expect( iconSetting( 'no-such-icon', undefined ) ).toBeUndefined();
	} );

	it( 'rotates an SVG about its viewBox center for the accordion open state', () => {
		expect( rotateSvg( '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>', 180 ) ).toBe( '<svg viewBox="0 0 24 24"><g transform="rotate(180 12 12)"><path d="m6 9 6 6 6-6"/></g></svg>' );
		expect( rotateSvg( '<svg><path/></svg>', 90 ) ).toBe( '<svg><path/></svg>' );
	} );

	it( 'reads rotation from a computed matrix or the rotate property', () => {
		expect( rotationOf( 'matrix(-1, 0, 0, -1, 0, 0)' ) ).toBe( 180 );
		expect( rotationOf( 'none', '180deg' ) ).toBe( 180 );
		expect( rotationOf( 'none', 'none' ) ).toBe( 0 );
	} );
} );
