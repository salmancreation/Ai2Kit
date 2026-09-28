import { createIdGenerator } from '../src/util/ids';
import { parseColor, toHex, deltaE, hslTripletToHex, isTransparent, chroma } from '../src/util/color';
import { px, parseBox, parseShadow, parseLinearGradient, firstFamily, normalizeGradient, decomposeMatrix } from '../src/util/units';

describe( 'createIdGenerator', () => {
	it( 'produces 7-char lowercase hex ids', () => {
		const next = createIdGenerator( 'job-1' );
		for ( let i = 0; i < 50; i++ ) {
			expect( next() ).toMatch( /^[0-9a-f]{7}$/ );
		}
	} );

	it( 'is deterministic per seed and unique within a document', () => {
		const a = createIdGenerator( 'seed' );
		const b = createIdGenerator( 'seed' );
		const seqA = Array.from( { length: 500 }, () => a() );
		const seqB = Array.from( { length: 500 }, () => b() );
		expect( seqA ).toEqual( seqB );
		expect( new Set( seqA ).size ).toBe( 500 );
	} );

	it( 'differs across seeds', () => {
		expect( createIdGenerator( 'x' )() ).not.toBe( createIdGenerator( 'y' )() );
	} );
} );

describe( 'color', () => {
	it( 'parses rgb, rgba, hex and hsl', () => {
		expect( toHex( parseColor( 'rgb(109, 74, 255)' )! ) ).toBe( '#6D4AFF' );
		expect( toHex( parseColor( '#6d4aff' )! ) ).toBe( '#6D4AFF' );
		expect( toHex( parseColor( '#fff' )! ) ).toBe( '#FFFFFF' );
		expect( toHex( parseColor( 'hsl(0, 100%, 50%)' )! ) ).toBe( '#FF0000' );
		expect( parseColor( 'rgba(0, 0, 0, 0.5)' )!.a ).toBeCloseTo( 0.5 );
		expect( toHex( parseColor( 'rgba(0, 0, 0, 0.5)' )! ) ).toBe( '#00000080' );
		expect( parseColor( 'rgb(10 20 30 / 50%)' )!.a ).toBeCloseTo( 0.5 );
		expect( parseColor( 'currentcolor' ) ).toBeNull();
	} );

	it( 'converts shadcn HSL triplets', () => {
		expect( hslTripletToHex( '0 0% 100%' ) ).toBe( '#FFFFFF' );
		expect( hslTripletToHex( '222.2 84% 4.9%' ) ).toBe( '#020817' );
		expect( hslTripletToHex( 'hsl(0 0% 0%)' ) ).toBe( '#000000' );
		expect( hslTripletToHex( 'not a color' ) ).toBeNull();
	} );

	it( 'detects transparency and computes ΔE and chroma', () => {
		expect( isTransparent( 'rgba(0, 0, 0, 0)' ) ).toBe( true );
		expect( isTransparent( 'transparent' ) ).toBe( true );
		expect( isTransparent( 'rgb(0, 0, 0)' ) ).toBe( false );
		expect( deltaE( parseColor( '#6D4AFF' )!, parseColor( '#6D4BFF' )! ) ).toBeLessThan( 3 );
		expect( deltaE( parseColor( '#000000' )!, parseColor( '#FFFFFF' )! ) ).toBeGreaterThan( 90 );
		expect( chroma( parseColor( '#808080' )! ) ).toBeLessThan( 1 );
		expect( chroma( parseColor( '#6D4AFF' )! ) ).toBeGreaterThan( 40 );
	} );
} );

describe( 'units', () => {
	it( 'parses px values', () => {
		expect( px( '24px' ) ).toBe( 24 );
		expect( px( '1.5px' ) ).toBe( 1.5 );
		expect( px( 'normal' ) ).toBeNull();
		expect( px( undefined ) ).toBeNull();
	} );

	it( 'parses box shorthands from longhands', () => {
		expect( parseBox( { 'padding-top': '96px', 'padding-right': '24px', 'padding-bottom': '96px', 'padding-left': '24px' }, 'padding' ) ).toEqual( {
			top: 96,
			right: 24,
			bottom: 96,
			left: 24,
		} );
		expect( parseBox( {}, 'margin' ) ).toBeNull();
	} );

	it( 'parses box-shadow', () => {
		expect( parseShadow( 'rgba(16, 24, 40, 0.1) 0px 6px 16px -4px' ) ).toEqual( {
			color: 'rgba(16, 24, 40, 0.1)',
			x: 0,
			y: 6,
			blur: 16,
			spread: -4,
			inset: false,
		} );
		expect( parseShadow( 'none' ) ).toBeNull();
	} );

	it( 'parses a 2-stop linear gradient', () => {
		expect( parseLinearGradient( 'linear-gradient(135deg, rgb(109, 74, 255) 0%, rgb(46, 144, 250) 100%)' ) ).toEqual( {
			angle: 135,
			from: 'rgb(109, 74, 255)',
			fromStop: 0,
			to: 'rgb(46, 144, 250)',
			toStop: 100,
		} );
		expect( parseLinearGradient( 'linear-gradient(to right, rgb(0, 0, 0), rgb(255, 255, 255))' )?.angle ).toBe( 90 );
		expect( parseLinearGradient( 'url(a.png)' ) ).toBeNull();
	} );

	it( 'extracts the first font family', () => {
		expect( firstFamily( '"Inter", ui-sans-serif, system-ui' ) ).toBe( 'Inter' );
		expect( firstFamily( 'ui-sans-serif, system-ui' ) ).toBeNull();
	} );
} );

describe( 'converter-friendly CSS', () => {
	it( 'normalizes gradients to angle + explicit stops', () => {
		expect( normalizeGradient( 'linear-gradient(to right bottom, rgb(253, 230, 138), rgb(255, 237, 213), rgb(245, 245, 244))' ) ).toBe(
			'linear-gradient(135deg, rgb(253, 230, 138) 0%, rgb(255, 237, 213) 50%, rgb(245, 245, 244) 100%)'
		);
		expect( normalizeGradient( 'linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))' ) ).toBe( 'linear-gradient(180deg, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)' );
		expect( normalizeGradient( 'linear-gradient(90deg, red 10%, blue 90%)' ) ).toBe( 'linear-gradient(90deg, red 10%, blue 90%)' );
		expect( normalizeGradient( 'radial-gradient(red, blue)' ) ).toBe( 'radial-gradient(red, blue)' );
		expect( normalizeGradient( 'linear-gradient(90deg, red 10px, blue)' ) ).toBe( 'linear-gradient(90deg, red 10px, blue)' );
	} );

	it( 'decomposes 2D matrices into translate/rotate/scale', () => {
		expect( decomposeMatrix( 'matrix(0.999848, 0.0174524, -0.0174524, 0.999848, 0, 0)' ) ).toBe( 'rotate(1deg)' );
		expect( decomposeMatrix( 'matrix(1, 0, 0, 1, 0, -8)' ) ).toBe( 'translate(0px, -8px)' );
		expect( decomposeMatrix( 'matrix(1.05, 0, 0, 1.05, 0, 0)' ) ).toBe( 'scale(1.05, 1.05)' );
		expect( decomposeMatrix( 'matrix(1, 0, 0, 1, 0, 0)' ) ).toBe( 'none' );
		expect( decomposeMatrix( 'matrix(1, 0, 0.5, 1, 0, 0)' ) ).toBe( 'matrix(1, 0, 0.5, 1, 0, 0)' ); // skew stays
		expect( decomposeMatrix( 'rotate(3deg)' ) ).toBe( 'rotate(3deg)' );
	} );
} );
