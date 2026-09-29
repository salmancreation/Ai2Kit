import { convert, analyze, emit, suggestedModes } from '../src/pipeline';
import type { V3Element } from '../src/emit/v3';
import { capture, cn, resetKeys, text, validateAgainstRegistry } from './helpers';
import { gridColumns } from '../src/emit/v3';
import { landing } from './fixtures/landing';

function all( els: V3Element[] ): V3Element[] {
	return els.flatMap( ( e ) => [ e, ...all( e.elements ) ] );
}
const widgets = ( els: V3Element[], type: string ) => all( els ).filter( ( e ) => e.widgetType === type );

describe( 'emit-v3 on a landing page', () => {
	const result = convert( capture( landing() ), 'job-1' );
	const els = result.document.content as V3Element[];

	it( 'produces only settings that exist in the Elementor 4.3 control registry', () => {
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
	} );

	it( 'emits one top-level container per section, labelled semantically', () => {
		expect( els.map( ( e ) => e.settings._title ) ).toEqual( [ 'Header', 'Hero', 'Features grid', 'Footer' ] );
		expect( els.every( ( e ) => e.elType === 'container' && e.isInner === false ) ).toBe( true );
		expect( els[ 0 ]!.settings.html_tag ).toBe( 'header' );
		expect( els[ 2 ]!.settings._element_id ).toBe( 'features' );
	} );

	it( 'maps the hero: boxed width, gradient, responsive padding, centered content', () => {
		const hero = els[ 1 ]!.settings;
		expect( hero.content_width ).toBe( 'boxed' );
		expect( hero.boxed_width ).toEqual( { unit: 'px', size: 1200, sizes: [] } );
		expect( hero.background_background ).toBe( 'gradient' );
		expect( hero.background_gradient_angle ).toEqual( { unit: 'deg', size: 135, sizes: [] } );
		expect( hero.padding ).toMatchObject( { unit: 'px', top: '96', bottom: '96', isLinked: false } );
		expect( hero.padding_mobile ).toMatchObject( { top: '56', bottom: '56' } );
		expect( hero.flex_align_items ).toBe( 'center' );
	} );

	it( 'maps headings with tag, inline HTML, typography and responsive sizes', () => {
		const h1 = widgets( els, 'heading' ).find( ( h ) => h.settings.header_size === 'h1' )!;
		expect( h1.settings.title ).toBe( 'Build <strong>faster</strong> with AI' );
		expect( h1.settings.align ).toBe( 'center' );
		expect( h1.settings.__globals__ ).toMatchObject( { typography_typography: expect.stringMatching( /^globals\/typography\?id=a2k/ ) } );
		const h3 = widgets( els, 'heading' ).find( ( h ) => h.settings.header_size === 'h3' )!;
		expect( h3.settings.typography_typography ).toBeUndefined(); // H3 matched a global
	} );

	it( 'maps buttons with link, colors, radius, padding and icons', () => {
		const btns = widgets( els, 'button' );
		const start = btns.find( ( b ) => b.settings.text === 'Get started' )!.settings;
		expect( start.link ).toEqual( { url: 'http://site.test/start', is_external: '', nofollow: '', custom_attributes: '' } );
		// The source's own SVG, not a Font Awesome look-alike.
		expect( start.selected_icon ).toMatchObject( { library: 'svg', value: { url: expect.stringMatching( /^data:image\/svg\+xml;base64,/ ) } } );
		expect( start.icon_align ).toBe( 'row-reverse' );
		expect( start.border_radius ).toMatchObject( { top: '8', left: '8', isLinked: true } );
		expect( start.text_padding ).toMatchObject( { top: '12', right: '24' } );
		const docs = btns.find( ( b ) => b.settings.text === 'Docs' )!.settings;
		expect( ( docs.link as Record< string, string > ).is_external ).toBe( 'on' );
		expect( docs.border_border ).toBe( 'solid' );
		expect( docs.background_background ).toBe( 'classic' );
		expect( docs.background_color ).toBe( '#00000000' ); // outline buttons stay transparent
	} );

	it( 'maps grids with responsive columns and zeroes default gaps', () => {
		const grid = all( els ).find( ( e ) => e.settings.container_type === 'grid' )!.settings;
		expect( grid.grid_columns_grid ).toEqual( { unit: 'fr', size: 3, sizes: [] } );
		expect( grid.grid_columns_grid_tablet ).toEqual( { unit: 'fr', size: 2, sizes: [] } );
		expect( grid.grid_columns_grid_mobile ).toEqual( { unit: 'fr', size: 1, sizes: [] } );
		expect( grid.grid_gaps ).toMatchObject( { row: '32', column: '32' } );
		expect( grid.grid_rows_grid ).toEqual( { unit: 'custom', size: 'auto', sizes: [] } );
		// Every flex container writes its gap (Elementor's kit default is 20px).
		expect( all( els ).filter( ( e ) => e.elType === 'container' && e.settings.container_type !== 'grid' ).every( ( e ) => 'flex_gap' in e.settings ) ).toBe( true );
	} );

	it( 'uses the source\'s own SVG for every icon (identical, not a Font Awesome look-alike)', () => {
		const icons = widgets( els, 'icon' );
		expect( icons.map( ( i ) => ( i.settings.selected_icon as { library: string } ).library ) ).toEqual( [ 'svg', 'svg', 'svg' ] );
		expect( ( icons[ 2 ]!.settings.selected_icon as { value: { url: string } } ).value.url ).toMatch( /^data:image\/svg\+xml;base64,/ );
		expect( icons[ 0 ]!.settings.__globals__ ).toEqual( { primary_color: 'globals/colors?id=primary' } );
	} );

	it( 'maps icon lists, dividers, videos and badges', () => {
		const list = widgets( els, 'icon-list' )[ 0 ]!.settings;
		expect( ( list.icon_list as Array< { text: string } > ).map( ( i ) => i.text ) ).toEqual( [ 'Unlimited pages', 'Local-first' ] );
		expect( widgets( els, 'divider' ) ).toHaveLength( 1 );
		expect( widgets( els, 'video' )[ 0 ]!.settings ).toMatchObject( { video_type: 'youtube', youtube_url: 'https://www.youtube.com/watch?v=abcdefghijk' } );
		const badge = widgets( els, 'text-editor' ).find( ( t ) => String( t.settings.editor ).includes( 'New' ) )!.settings;
		expect( badge._element_width ).toBe( 'auto' );
		expect( badge._background_background ).toBe( 'classic' );
		expect( badge._border_radius ).toMatchObject( { top: '999' } );
	} );

	it( 'keeps forms as labelled HTML fallbacks and reports it', () => {
		const html = widgets( els, 'html' )[ 0 ]!;
		expect( html.settings.html ).toBe( '<form><input name="email"></form>' );
		expect( html.settings._title ).toMatch( /^HTML \(kept\) — / );
		const features = result.sections.find( ( s ) => s.semantic === 'features' )!;
		expect( features.warnings.join( ' ' ) ).toMatch( /Kept as HTML/ );
		expect( features.score.fallbackRatio ).toBeGreaterThan( 0 );
	} );

	it( 'uses global color references where tokens match', () => {
		const json = JSON.stringify( els );
		expect( json ).toContain( 'globals/colors?id=' );
		expect( result.tokens.colors.length ).toBeGreaterThan( 2 );
	} );

	it( 'reports a score, summary and suggested mode per section', () => {
		expect( result.sections ).toHaveLength( 4 );
		for ( const s of result.sections ) {
			expect( s.score.score ).toBeGreaterThanOrEqual( 0 );
			expect( s.score.score ).toBeLessThanOrEqual( 100 );
		}
		expect( result.sections[ 1 ]!.summary ).toMatch( /button/ );
		expect( result.overall ).toBeGreaterThan( 60 );
		expect( Object.values( suggestedModes( result ) ).every( ( m ) => m === 'native' || m === 'html' ) ).toBe( true );
	} );

	it( 'is deterministic for the same seed', () => {
		expect( JSON.stringify( convert( capture( landing() ), 'job-1' ) ) ).toBe( JSON.stringify( result ) );
		expect( convert( capture( landing() ), 'job-2' ).document.content[ 0 ]!.id ).not.toBe( els[ 0 ]!.id );
	} );
} );

describe( 'gridColumns', () => {
	it( 'keeps equal tracks as N fr and unequal tracks as a custom fr template', () => {
		expect( gridColumns( '373.328px 373.328px 373.344px' ) ).toEqual( { unit: 'fr', size: 3, sizes: [] } );
		expect( gridColumns( '760px 380px' ) ).toEqual( { unit: 'custom', size: '2fr 1fr', sizes: [] } );
		expect( gridColumns( 'none' ) ).toEqual( { unit: 'fr', size: 1, sizes: [] } );
	} );
} );

describe( 'review choices', () => {
	it( 'switches a section to HTML using frozen markup and keeps IDs valid', () => {
		const analysis = analyze( capture( landing() ), 'job-3' );
		const hero = analysis.sections[ 1 ]!;
		expect( analysis.freezeKeys ).toContain( hero.key );
		const out = emit( analysis, { modes: { [ hero.id ]: 'html' }, frozen: { [ hero.key! ]: '<section>frozen</section>' } } );
		const heroEl = out.document.content[ 1 ] as V3Element;
		expect( heroEl.elements[ 0 ]!.widgetType ).toBe( 'html' );
		expect( heroEl.elements[ 0 ]!.settings.html ).toBe( '<section>frozen</section>' );
		expect( out.sections[ 1 ]!.mode ).toBe( 'html' );
		// The native score is still reported so the toggle stays informed.
		expect( out.sections[ 1 ]!.score.score ).toBeGreaterThan( 0 );
		expect( validateAgainstRegistry( out.document.content ) ).toEqual( [] );
	} );

	it( 'rewrites asset URLs to imported media', () => {
		const out = convert( capture( landing() ), 'job-4', { assets: { 'http://site.test/assets/hero.png': { url: 'http://wp.test/wp-content/uploads/hero.png', id: 42 } } } );
		const img = widgets( out.document.content as V3Element[], 'image' )[ 0 ]!.settings.image;
		expect( img ).toMatchObject( { url: 'http://wp.test/wp-content/uploads/hero.png', id: 42, alt: 'App screenshot' } );
	} );
} );

describe( 'v4 text fallback', () => {
	it( 'keeps styled inline text in classic widgets (atomic text drops attributes)', async () => {
		const { needsClassicText } = await import( '../src/emit/v4' );
		expect( needsClassicText( '$19<span style="font-size:16px"> / mo</span>' ) ).toBe( true );
		expect( needsClassicText( 'for <span class="a2k-gt-abc">slow</span>' ) ).toBe( true );
		expect( needsClassicText( 'Build <strong>faster</strong> with <a href="x">AI</a>' ) ).toBe( false );
	} );
} );

describe( 'v4 fonts', () => {
	it( 'states web fonts by name and moves system stacks to residual CSS on the style class', async () => {
		const { cn, text, capture } = await import( './helpers' );
		const { convert } = await import( '../src/pipeline' );
		const page = cn( 'body', {}, [ cn( 'section', { 'padding-top': '8px' }, [
			text( 'h2', 'Web font', { 'font-family': '"DM Sans", sans-serif' } ),
			text( 'p', 'System font', { 'font-family': 'ui-sans-serif, system-ui, sans-serif' } ),
		], { rect: { x: 0, y: 0, w: 1440, h: 200 } } ) ], { rect: { x: 0, y: 0, w: 1440, h: 200 } } );
		const doc = convert( capture( page ), 'fonts', { format: 'v4' } ).document;
		const json = JSON.stringify( doc.content );
		expect( json ).toContain( 'font-family: DM Sans;' );
		expect( json ).not.toContain( 'system-ui' );
		const p = ( doc.content[ 0 ]!.elements as Array< { id: string; widgetType?: string } > ).find( ( e ) => e.widgetType === 'e-paragraph' )!;
		expect( doc.residual ).toContainEqual( expect.objectContaining( { className: `e-${ p.id }-a2k`, decls: { 'font-family': 'ui-sans-serif, system-ui, sans-serif' } } ) );
	} );
} );

describe( 'grids on mobile', () => {
	it( 'writes the mobile column count when a grid stays multi-column (Elementor would fall back to 1)', () => {
		resetKeys();
		const cells = [ 'A', 'B', 'C', 'D' ].map( ( t ) => text( 'div', t, {}, { rect: { x: 0, y: 0, w: 300, h: 40 } } ) );
		const grid = cn( 'div', { display: 'grid', 'grid-template-columns': '300px 300px', 'row-gap': '16px', 'column-gap': '16px' }, cells, { rect: { x: 0, y: 0, w: 616, h: 96 }, mobile: { 'grid-template-columns': '171px 171px' } } );
		const els = convert( capture( cn( 'body', {}, [ cn( 'section', { 'padding-top': '40px' }, [ grid ] ) ] ) ), 'grid-m' ).document.content as V3Element[];
		const g = JSON.parse( JSON.stringify( els ) ).flatMap( function flat( e: V3Element ): V3Element[] { return [ e, ...e.elements.flatMap( flat ) ]; } ).find( ( e: V3Element ) => e.settings.container_type === 'grid' ) as V3Element;
		expect( g.settings.grid_columns_grid ).toEqual( { unit: 'fr', size: 2, sizes: [] } );
		expect( g.settings.grid_columns_grid_mobile ).toEqual( { unit: 'fr', size: 2, sizes: [] } );
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
	} );
} );
