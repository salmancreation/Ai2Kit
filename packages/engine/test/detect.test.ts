import { detectSource } from '../src/detect/source';
import { scoreSection, overallScore, scoreBand } from '../src/score/fidelity';

describe( 'source detection (FR-3)', () => {
	it( 'detects Lovable builds', () => {
		const r = detectSource( {
			files: [ 'index.html', 'assets/index-Bx12.js', 'assets/index-C3.css' ],
			html: '<html><head><meta name="author" content="Lovable"><script type="module" src="/assets/index-Bx12.js"></script></head><body><div id="root"></div></body></html>',
		} );
		expect( r ).toMatchObject( { type: 'lovable', label: 'Lovable (Vite + React)', spa: true } );
		expect( r.evidence ).toContain( 'Found <div id="root">' );
	} );

	it( 'detects generic Vite, Bolt and Next exports', () => {
		expect( detectSource( { files: [ 'index.html', 'assets/index-a.js' ], html: '<div id="root"></div><script src="/assets/index-a.js">' } ).type ).toBe( 'vite-spa' );
		expect( detectSource( { files: [ 'index.html' ], html: '<div id="root"></div><!-- bolt.new -->' } ).type ).toBe( 'bolt' );
		expect( detectSource( { files: [ 'index.html', '_next/static/chunks/a.js' ], html: '' } ).type ).toBe( 'next-export' );
	} );

	it( 'detects AI single-file HTML, templates and plain HTML', () => {
		expect( detectSource( { files: [ 'index.html' ], html: '<script src="https://cdn.tailwindcss.com"></script>' } ) ).toMatchObject( { type: 'ai-html', spa: false } );
		expect( detectSource( { files: [ 'index.html', 'about.html', 'css/style.css' ], html: '<p>x</p>' } ).type ).toBe( 'html-template' );
		expect( detectSource( { files: [ 'index.html' ], html: '<p>x</p>' } ).type ).toBe( 'html' );
		expect( detectSource( { files: [ 'readme.md' ], html: '' } ).type ).toBe( 'unknown' );
	} );

	it( 'flags unbuilt source ZIPs', () => {
		expect( detectSource( { files: [ 'package.json', 'src/App.tsx' ], html: '' } ).type ).toBe( 'source-zip' );
		expect( detectSource( { files: [ 'package.json', 'index.html', 'src/main.tsx' ], html: '<div id="root"></div>' } ).type ).toBe( 'source-zip' );
		expect( detectSource( { files: [ 'package.json', 'dist/index.html', 'src/main.tsx' ], html: '<div id="root"></div>' } ).type ).toBe( 'vite-spa' );
	} );
} );

describe( 'fidelity score (FR-29)', () => {
	const stats = ( o: Partial< Parameters< typeof scoreSection >[ 0 ] > ) => ( { relevant: 10, mapped: 10, leaves: 4, nativeLeaves: 4, fallbacks: 0, widgets: {}, warnings: [], unmapped: {}, penalty: 0, handled: [], ...o } );
	it( 'scores fully native, fully mapped sections at 100', () => {
		expect( scoreSection( stats( {} ) ).score ).toBe( 100 );
	} );
	it( 'penalizes fallbacks and unmapped styles', () => {
		const s = scoreSection( stats( { mapped: 5, nativeLeaves: 2, fallbacks: 2 } ) );
		expect( s ).toEqual( { score: 50, structure: 0.5, styles: 0.5, fallbackRatio: 0.5 } );
		expect( scoreBand( 95 ) ).toBe( 'high' );
		expect( scoreBand( 75 ) ).toBe( 'mid' );
		expect( scoreBand( 40 ) ).toBe( 'low' );
	} );
	it( 'weights the overall score by area', () => {
		expect( overallScore( [ { score: scoreSection( stats( {} ) ), area: 900 }, { score: { score: 0, structure: 0, styles: 0, fallbackRatio: 1 }, area: 100 } ] ) ).toBe( 90 );
		expect( overallScore( [] ) ).toBe( 0 );
	} );
} );
