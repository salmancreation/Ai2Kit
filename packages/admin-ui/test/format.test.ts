import { band, bytes, fileKind, localDate, resolveTheme } from '../src/lib/format';

describe( 'format helpers', () => {
	it( 'formats bytes', () => {
		expect( bytes( 512 ) ).toBe( '512 B' );
		expect( bytes( 4682 ) ).toBe( '5 KB' );
		expect( bytes( 5 * 1024 * 1024 ) ).toBe( '5.0 MB' );
	} );

	it( 'classifies uploads', () => {
		expect( fileKind( 'site.ZIP' ) ).toBe( 'zip' );
		expect( fileKind( 'page.htm' ) ).toBe( 'html' );
		expect( fileKind( 'shell.php' ) ).toBe( 'other' );
		expect( fileKind( 'noext' ) ).toBe( 'other' );
	} );

	it( 'maps scores to the DESIGN.md scale', () => {
		expect( band( 90 ) ).toBe( 'high' );
		expect( band( 89 ) ).toBe( 'mid' );
		expect( band( 70 ) ).toBe( 'mid' );
		expect( band( 69 ) ).toBe( 'low' );
	} );

	it( 'resolves the theme', () => {
		expect( resolveTheme( 'system', true ) ).toBe( 'dark' );
		expect( resolveTheme( 'system', false ) ).toBe( 'light' );
		expect( resolveTheme( 'light', true ) ).toBe( 'light' );
	} );

	it( 'formats dates defensively', () => {
		expect( localDate( null ) ).toBe( '—' );
		expect( localDate( 'nonsense' ) ).toBe( '—' );
		expect( localDate( '2026-09-29T01:00:00+00:00', 'en-US' ) ).toMatch( /2026/ );
	} );
} );
