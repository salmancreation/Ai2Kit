// @vitest-environment happy-dom
import { captureTree, captureStyles, applyBreakpoint, captureMeta, renderedFontStack, KEY_ATTR } from '../src/capture/capture';
import { freezeElement, sanitizeInline, serializeSvg } from '../src/capture/freeze';
import type { CapturedNode, Rect } from '../src/ir/types';

const measure = ( el: Element ): Rect => {
	const r = el.getAttribute( 'data-rect' );
	if ( r ) {
		const [ x, y, w, h ] = r.split( ',' ).map( Number ) as [ number, number, number, number ];
		return { x, y, w, h };
	}
	return { x: 0, y: 0, w: 100, h: 20 };
};

const env = () => ( { doc: document, win: window, measure } );

function find( n: CapturedNode, pred: ( n: CapturedNode ) => boolean ): CapturedNode | undefined {
	if ( pred( n ) ) return n;
	for ( const c of n.children ) {
		const f = find( c, pred );
		if ( f ) return f;
	}
	return undefined;
}

beforeEach( () => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
} );

describe( 'captureTree', () => {
	it( 'walks visible elements, stamps keys, skips scripts and hidden nodes', () => {
		document.body.innerHTML = `
			<div id="root"><section style="padding-top: 96px; background-color: rgb(1, 2, 3)">
				<h1 style="font-size: 56px">Build <strong>faster</strong></h1>
				<p>Hello <a href="/x">world</a></p>
				<div style="display:none">hidden</div>
				<div hidden>also hidden</div>
				<script>alert(1)</script>
			</section></div>`;
		const root = captureTree( env() );
		expect( root.tag ).toBe( 'body' );
		const section = find( root, ( n ) => n.tag === 'section' )!;
		expect( section.styles.desktop[ 'padding-top' ] ).toBe( '96px' );
		expect( section.styles.desktop[ 'background-color' ] ).toBe( 'rgb(1, 2, 3)' );
		expect( section.children.map( ( c ) => c.tag ) ).toEqual( [ 'h1', 'p' ] );

		const h1 = section.children[ 0 ]!;
		expect( h1.text ).toBe( 'Build faster' );
		expect( h1.html ).toBe( 'Build <strong>faster</strong>' );
		expect( h1.children ).toHaveLength( 0 );

		const p = section.children[ 1 ]!;
		expect( p.html ).toMatch( /Hello <a href="[^"]*\/x">world<\/a>/ );
		expect( document.querySelectorAll( `[${ KEY_ATTR }]` ).length ).toBeGreaterThan( 3 );
	} );

	it( 'synthesizes text nodes when text is mixed with block children', () => {
		document.body.innerHTML = '<div>Loose text<div>block</div></div>';
		const root = captureTree( env() );
		const div = root.children[ 0 ]!;
		expect( div.children[ 0 ]!.tag ).toBe( '#text' );
		expect( div.children[ 0 ]!.text ).toBe( 'Loose text' );
	} );

	it( 'captures buttons and links with icons as leaves', () => {
		document.body.innerHTML = '<a href="#go" style="padding: 12px 24px; background-color: rgb(109, 74, 255)">Go <svg class="lucide lucide-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor"/></svg></a>';
		const a = captureTree( env() ).children[ 0 ]!;
		expect( a.text ).toBe( 'Go' );
		expect( a.svg ).toContain( '<path' );
		expect( a.attrs[ 'data-a2k-icon' ] ).toContain( 'lucide-arrow-right' );
		expect( a.attrs[ 'data-a2k-icon-pos' ] ).toBe( 'after' );
		expect( a.children ).toHaveLength( 0 );
	} );

	it( 'freezes forms for HTML fallback', () => {
		document.body.innerHTML = '<form onsubmit="x()"><input name="email" placeholder="Email"><button>Send</button></form>';
		const form = captureTree( env() ).children[ 0 ]!;
		expect( form.frozen ).toContain( '<form' );
		expect( form.frozen ).not.toContain( 'onsubmit' );
	} );

	it( 'resolves picture to its img', () => {
		document.body.innerHTML = '<picture><source srcset="a.webp"><img src="http://site.test/a.png" alt="A"></picture>';
		const pic = captureTree( env() ).children[ 0 ]!;
		expect( pic.tag ).toBe( 'img' );
		expect( pic.attrs.src ).toBe( 'http://site.test/a.png' );
		expect( pic.attrs.alt ).toBe( 'A' );
	} );

	it( 'throws when nothing is visible', () => {
		document.body.setAttribute( 'style', 'display:none' );
		expect( () => captureTree( env() ) ).toThrow( /no visible content/ );
		document.body.removeAttribute( 'style' );
	} );
} );

describe( 'renderedFontStack', () => {
	it( 'drops families that measure the same as every fallback', () => {
		const widths: Record< string, number > = { monospace: 100, serif: 90, 'sans-serif': 80, '"Inter", monospace': 100, '"Inter", serif': 90, '"Inter", sans-serif': 80, '"Loaded", monospace': 77, '"Loaded", serif': 77, '"Loaded", sans-serif': 77 };
		let font = '';
		const fakeDoc = {
			createElement: () => ( {
				getContext: () => ( {
					set font( f: string ) {
						font = f.replace( /^72px /, '' );
					},
					measureText: () => ( { width: widths[ font ] ?? 50 } ),
				} ),
			} ),
		} as unknown as Document;
		expect( renderedFontStack( fakeDoc, 'Inter, ui-sans-serif, system-ui' ) ).toBe( 'ui-sans-serif, system-ui' );
		expect( renderedFontStack( fakeDoc, '"Loaded", sans-serif' ) ).toBe( '"Loaded", sans-serif' );
		expect( renderedFontStack( fakeDoc, 'Inter' ) ).toBe( 'Inter' ); // nothing renders → keep the author's intent
	} );
} );

describe( 'applyBreakpoint', () => {
	it( 'stores only diffs and marks hidden nodes', () => {
		document.body.innerHTML = '<div id="a" style="padding-top: 96px; flex-direction: row; display: flex"><span id="b">x</span></div><p id="c">keep</p>';
		const root = captureTree( env() );
		( document.getElementById( 'a' ) as HTMLElement ).style.paddingTop = '56px';
		( document.getElementById( 'a' ) as HTMLElement ).style.flexDirection = 'column';
		( document.getElementById( 'c' ) as HTMLElement ).style.display = 'none';
		applyBreakpoint( root, 'tablet', captureStyles( env() ) );
		const a = root.children[ 0 ]!;
		expect( a.styles.tablet ).toEqual( { 'padding-top': '56px', 'flex-direction': 'column' } );
		expect( root.children[ 1 ]!.styles.tablet ).toEqual( { display: 'none' } );
		expect( a.rects?.tablet ).toEqual( { x: 0, y: 0, w: 100, h: 20 } );

		// Font stacks resolve the same way at every breakpoint: no spurious font-family diff.
		expect( a.styles.tablet?.[ 'font-family' ] ).toBeUndefined();
		// Same values again on mobile are inherited from tablet, so no mobile diff.
		applyBreakpoint( root, 'mobile', captureStyles( env() ) );
		expect( a.styles.mobile ).toBeUndefined();
	} );
} );

describe( 'captureMeta', () => {
	it( 'reads shadcn root vars and Google Fonts families', () => {
		document.documentElement.style.setProperty( '--primary', '262 83% 58%' );
		document.head.innerHTML = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Space+Grotesk">';
		document.title = 'My site';
		const meta = captureMeta( env(), { desktop: 1440, tablet: 1024, mobile: 390 } );
		expect( meta.rootVars.primary ).toBe( '262 83% 58%' );
		expect( meta.fontFamilies ).toEqual( [ 'Inter', 'Space Grotesk' ] );
		expect( meta.title ).toBe( 'My site' );
	} );
} );

describe( 'freeze helpers', () => {
	it( 'sanitizeInline drops javascript: links and unknown tags', () => {
		const d = document.createElement( 'div' );
		d.innerHTML = 'a <a href="javascript:alert(1)">x</a> <em>y</em> <img src=x onerror=alert(1)>';
		expect( sanitizeInline( d ) ).toBe( 'a <a>x</a> <em>y</em>' );
	} );

	it( 'sanitizeInline keeps differing typography on spans as inline styles', () => {
		const d = document.createElement( 'div' );
		d.setAttribute( 'style', 'font-size: 44px; color: rgb(15, 23, 42)' );
		d.innerHTML = '$19<span style="font-size: 16px; color: rgb(100, 116, 139)"> / mo</span> <span>plain</span>';
		document.body.appendChild( d );
		expect( sanitizeInline( d, window ) ).toBe( '$19<span style="color:rgb(100, 116, 139);font-size:16px"> / mo</span> plain' );
	} );

	it( 'serializeSvg strips handlers and resolves currentColor', () => {
		const wrap = document.createElement( 'div' );
		wrap.innerHTML = '<svg onload="alert(1)" style="color: rgb(255, 0, 0)" class="x"><script>1</script><path fill="currentColor"/></svg>';
		document.body.appendChild( wrap );
		const out = serializeSvg( wrap.firstElementChild!, window );
		expect( out ).not.toMatch( /onload|script|class=/ );
		expect( out ).toContain( 'fill="rgb(255, 0, 0)"' );
	} );

	it( 'freezeElement adds scoped media queries from breakpoint diffs', () => {
		const wrap = document.createElement( 'div' );
		wrap.innerHTML = '<div data-a2k-key="n9" style="display: flex; padding-top: 64px"><p>a</p></div>';
		document.body.appendChild( wrap );
		const out = freezeElement( wrap.firstElementChild!, window, new Map( [ [ 'n9', { mobile: { 'flex-direction': 'column', 'padding-top': '40px' } } ] ] ) );
		expect( out ).toMatch( /^<style>@media \(max-width:767px\)\{\[data-a2k-r="n9"\]\{flex-direction:column!important;padding-top:40px!important\}\}<\/style><div /  );
		expect( out ).toContain( 'data-a2k-r="n9"' );
		expect( out ).not.toContain( 'data-a2k-key' );
	} );

	it( 'freezeElement inlines styles and strips scripts, classes and handlers', () => {
		const wrap = document.createElement( 'div' );
		wrap.innerHTML = '<div class="card" onclick="x()" style="padding-top: 8px"><script>1</script><b>hi</b></div>';
		document.body.appendChild( wrap );
		const out = freezeElement( wrap.firstElementChild!, window );
		expect( out ).toContain( 'padding-top:8px' );
		expect( out ).not.toMatch( /class=|onclick|<script/ );
	} );
} );
