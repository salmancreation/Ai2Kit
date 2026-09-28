import { colorsFromShadcn, clusterColors, colorsFromUsage, extractFonts, extractTokens, tokenIndex } from '../src/tokens/tokens';
import { buildIR } from '../src/normalize/build';
import { createIdGenerator } from '../src/util/ids';
import { cn, text, capture } from './helpers';

const shadcn = {
	background: '0 0% 100%',
	foreground: '222.2 84% 4.9%',
	primary: '262 83% 58%',
	'primary-foreground': '210 40% 98%',
	secondary: '210 40% 96.1%',
	accent: '210 40% 96.1%',
	muted: '210 40% 96.1%',
	border: '214.3 31.8% 91.4%',
};

describe( 'colors (FR-19)', () => {
	it( 'maps shadcn variables 1:1 onto system + custom globals', () => {
		const c = colorsFromShadcn( shadcn )!;
		expect( c.filter( ( t ) => t.system ).map( ( t ) => t.id ) ).toEqual( [ 'primary', 'secondary', 'text', 'accent' ] );
		expect( c.find( ( t ) => t.id === 'text' )!.hex ).toBe( '#020817' );
		// muted duplicates secondary's hex, so it's skipped; background is custom.
		expect( c.filter( ( t ) => ! t.system ).map( ( t ) => t.title ) ).toEqual( [ 'Background', 'Border', 'On primary' ] );
		expect( c.every( ( t ) => /^(primary|secondary|text|accent|a2k[0-9a-f]{4})$/.test( t.id ) ) ).toBe( true );
		expect( colorsFromShadcn( { primary: '0 0% 0%' } ) ).toBeNull();
	} );

	it( 'clusters near-identical colors (ΔE < 3)', () => {
		const clusters = clusterColors( [
			{ hex: '#6D4AFF', weight: 10, role: 'button' },
			{ hex: '#6D4BFF', weight: 5, role: 'bg' },
			{ hex: '#111111', weight: 3, role: 'text' },
		] );
		expect( clusters ).toHaveLength( 2 );
		expect( clusters[ 0 ] ).toMatchObject( { hex: '#6D4AFF', weight: 15 } );
	} );

	it( 'ranks usage into Text / Primary / Secondary / Accent', () => {
		const tree = cn( 'div', { 'background-color': 'rgb(255, 255, 255)' }, [
			text( 'p', 'lots of body copy here', { color: 'rgb(17, 21, 28)' } ),
			text( 'a', 'Go', { 'background-color': 'rgb(109, 74, 255)', color: 'rgb(255, 255, 255)', 'padding-top': '8px', 'padding-left': '16px' } ),
			cn( 'div', { 'background-color': 'rgb(46, 144, 250)' }, [], { rect: { x: 0, y: 0, w: 100, h: 100 } } ),
			cn( 'div', { 'background-color': 'rgb(247, 144, 9)' }, [], { rect: { x: 0, y: 0, w: 50, h: 50 } } ),
		] );
		const colors = colorsFromUsage( buildIR( tree, createIdGenerator( 'x' ) ) );
		const byId = Object.fromEntries( colors.map( ( c ) => [ c.id, c.hex ] ) );
		expect( byId.text ).toBe( '#11151C' );
		expect( byId.primary ).toBe( '#6D4AFF' );
		expect( byId.secondary ).toBe( '#2E90FA' );
		expect( byId.accent ).toBe( '#F79009' );
		expect( colors.length ).toBeLessThanOrEqual( 8 );
	} );
} );

describe( 'typography (FR-20)', () => {
	it( 'derives Primary (headings), Text (body), Accent (buttons) and H1–H3', () => {
		const tree = cn( 'div', {}, [
			text( 'h1', 'Title', { 'font-family': '"Space Grotesk", sans-serif', 'font-size': '56px', 'font-weight': '700', 'line-height': '64px' }, { mobile: { 'font-size': '36px' } } ),
			text( 'h2', 'Sub', { 'font-family': '"Space Grotesk", sans-serif', 'font-size': '36px', 'font-weight': '700', 'line-height': '44px' } ),
			text( 'p', 'Body copy that is long enough to win', { 'font-family': 'Inter, sans-serif', 'font-size': '16px', 'font-weight': '400' } ),
			text( 'button', 'Go', { 'font-family': 'Inter, sans-serif', 'font-weight': '600' } ),
		] );
		const fonts = extractFonts( buildIR( tree, createIdGenerator( 'x' ) ) );
		const by = Object.fromEntries( fonts.map( ( f ) => [ f.title, f ] ) );
		expect( by.Primary ).toMatchObject( { id: 'primary', family: 'Space Grotesk', weight: '700', system: true } );
		expect( by.Secondary ).toMatchObject( { family: 'Inter' } );
		expect( by.Text ).toMatchObject( { family: 'Inter', size: 16, weight: '400', lineHeight: 1.5 } );
		expect( by.Accent ).toMatchObject( { family: 'Inter', weight: '600' } );
		expect( by.H1 ).toMatchObject( { size: 56, sizeMobile: 36, lineHeight: 1.14, system: false } );
		expect( by.H2 ).toMatchObject( { size: 36 } );
		expect( by.H3 ).toBeUndefined();
	} );
} );

describe( 'token matching (FR-21)', () => {
	it( 'binds colors only when near-exact (ΔE < 1) and sized fonts exactly', () => {
		const root = buildIR( cn( 'div', {}, [ text( 'h1', 'T', { 'font-size': '56px', 'font-weight': '700' } ) ] ), createIdGenerator( 'x' ) );
		const table = extractTokens( capture( cn( 'body' ), shadcn ).meta, root );
		expect( table.source ).toBe( 'shadcn' );
		const idx = tokenIndex( table );
		expect( idx.color( 'rgb(124, 58, 237)' ) ).toBe( 'primary' ); // hsl(262 83% 58%)
		expect( idx.color( 'rgba(124, 58, 237, 0.5)' ) ).toBeUndefined();
		expect( idx.color( 'rgb(0, 200, 0)' ) ).toBeUndefined();
		expect( idx.color( 'rgb(127, 61, 237)' ) ).toBeUndefined(); // close, but a different color
		expect( idx.font( root.children[ 0 ]! )?.title ).toBe( 'H1' );
	} );
} );
