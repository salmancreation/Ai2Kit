import { classify, isButtonLike, lucideName, asIconList, isDisplayText } from '../src/recognize/leaf';
import { layoutOf, countTracks } from '../src/recognize/layout';
import { detectPattern } from '../src/recognize/patterns';
import { detectRepeats, similarity, signature } from '../src/recognize/repeat';
import { findSections, labelSections, classifySection } from '../src/recognize/sections';
import { buildIR, collapseWrappers } from '../src/normalize/build';
import { createIdGenerator } from '../src/util/ids';
import { cn, text } from './helpers';

const ids = () => createIdGenerator( 't' );

describe( 'leaf mapping (FR-15)', () => {
	it( 'maps headings, paragraphs and images', () => {
		expect( classify( text( 'h1', 'Hi' ) ).kind ).toBe( 'heading' );
		expect( classify( text( 'h1', 'Hi' ) ).content?.tag ).toBe( 'h1' );
		expect( classify( text( 'p', 'Body' ) ).kind ).toBe( 'text' );
		expect( classify( cn( 'img', {}, [], { attrs: { src: 'http://x/a.png', alt: 'A' } } ) ) ).toEqual( {
			kind: 'image',
			content: { src: 'http://x/a.png', alt: 'A' },
		} );
		expect( classify( cn( 'img' ) ).kind ).toBe( 'spacer' );
	} );

	it( 'treats large bold single-line text as a heading', () => {
		const n = text( 'div', 'Big claim', { 'font-size': '48px', 'font-weight': '700', 'line-height': '56px' }, { rect: { x: 0, y: 0, w: 500, h: 56 } } );
		expect( isDisplayText( n ) ).toBe( true );
		expect( classify( n ) ).toMatchObject( { kind: 'heading', content: { tag: 'div' } } );
	} );

	it( 'maps padded links with a background to buttons, plain links to text', () => {
		const btn = text( 'a', 'Start', { 'padding-top': '12px', 'padding-bottom': '12px', 'padding-left': '24px', 'padding-right': '24px', 'background-color': 'rgb(109, 74, 255)' }, { attrs: { href: 'http://x/start' } } );
		expect( isButtonLike( btn.styles.desktop ) ).toBe( true );
		expect( classify( btn ) ).toMatchObject( { kind: 'button', content: { text: 'Start', href: 'http://x/start' } } );

		const outline = text( 'a', 'Docs', { 'padding-top': '8px', 'padding-left': '16px', 'border-top-width': '1px', 'border-top-style': 'solid' }, { attrs: { href: '#' } } );
		expect( classify( outline ).kind ).toBe( 'button' );

		const plain = text( 'a', 'Read more', {}, { attrs: { href: 'http://x/more' } } );
		expect( classify( plain ) ).toMatchObject( { kind: 'text', content: { html: '<a href="http://x/more">Read more</a>' } } );
	} );

	it( 'maps icon-only links to icons, lucide svgs to named icons', () => {
		const a = cn( 'a', {}, [], { text: '', svg: '<svg/>', attrs: { href: 'http://gh', 'data-a2k-icon': 'lucide lucide-github' } } );
		expect( classify( a ) ).toMatchObject( { kind: 'icon', content: { iconName: 'github', href: 'http://gh' } } );
		expect( lucideName( 'lucide lucide-arrow-right h-4 w-4' ) ).toBe( 'arrow-right' );
		expect( lucideName( 'lucide-icon' ) ).toBeUndefined();
		expect( classify( cn( 'svg', {}, [], { svg: '<svg/>', attrs: { class: 'lucide-zap' } } ) ).content?.iconName ).toBe( 'zap' );
	} );

	it( 'maps video iframes, hr, forms and tables', () => {
		expect( classify( cn( 'iframe', {}, [], { attrs: { src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } } ) ).content ).toEqual( {
			videoType: 'youtube',
			src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		} );
		expect( classify( cn( 'iframe', {}, [], { attrs: { src: 'https://player.vimeo.com/video/123' } } ) ).content?.videoType ).toBe( 'vimeo' );
		expect( classify( cn( 'iframe', {}, [], { attrs: { src: 'https://maps.google.com' } } ) ).kind ).toBe( 'embed' );
		expect( classify( cn( 'hr' ) ).kind ).toBe( 'divider' );
		expect( classify( cn( 'form', {}, [], { frozen: '<form></form>' } ) ) ).toMatchObject( { kind: 'form', fallbackReason: expect.any( String ) } );
		expect( classify( cn( 'table', {}, [], { frozen: '<table></table>' } ) ).kind ).toBe( 'embed' );
		expect( classify( cn( 'video', {}, [], { attrs: { src: 'http://x/v.mp4' } } ) ).content?.videoType ).toBe( 'hosted' );
	} );

	it( 'detects icon lists and plain text lists', () => {
		const li = ( t: string ) => cn( 'li', { display: 'flex' }, [ cn( 'svg', {}, [], { svg: '<svg stroke="rgb(1, 2, 3)"/>', attrs: { class: 'lucide-check' } } ), text( 'span', t ) ] );
		const ul = cn( 'ul', {}, [ li( 'One' ), li( 'Two' ) ] );
		expect( asIconList( ul )?.items ).toEqual( [
			{ text: 'One', iconName: 'check', svg: '<svg stroke="rgb(1, 2, 3)"/>' },
			{ text: 'Two', iconName: 'check', svg: '<svg stroke="rgb(1, 2, 3)"/>' },
		] );
		const plain = cn( 'ul', {}, [ text( 'li', 'A' ), text( 'li', 'B' ) ] );
		expect( classify( plain ) ).toMatchObject( { kind: 'text', content: { html: '<ul><li>A</li><li>B</li></ul>' } } );
	} );

	it( 'keeps decorative empty boxes as containers, empty space as spacers', () => {
		expect( classify( cn( 'div', { 'background-color': 'rgb(0, 0, 0)' } ) ).kind ).toBe( 'container' );
		expect( classify( cn( 'div' ) ).kind ).toBe( 'spacer' );
	} );
} );

describe( 'layout mapping (FR-14)', () => {
	it( 'maps flex with direction, wrap, gap, justify and align', () => {
		expect( layoutOf( { display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'wrap', 'row-gap': '16px', 'column-gap': '24px', 'justify-content': 'space-between', 'align-items': 'center' } ) ).toEqual( {
			display: 'flex',
			direction: 'row',
			wrap: true,
			gap: { row: 16, column: 24 },
			justify: 'space-between',
			align: 'center',
		} );
		expect( layoutOf( { display: 'flex', 'flex-direction': 'column-reverse' } ).direction ).toBe( 'column' );
	} );

	it( 'maps grid tracks and block flow', () => {
		expect( layoutOf( { display: 'grid', 'grid-template-columns': '373.328px 373.328px 373.344px', 'row-gap': '32px', 'column-gap': '32px' } ) ).toEqual( {
			display: 'grid',
			gridCols: 3,
			gap: { row: 32, column: 32 },
		} );
		expect( countTracks( 'repeat(4, minmax(0px, 1fr))' ) ).toBe( 4 );
		expect( countTracks( '[full-start] 1fr [content-start] 2fr [content-end]' ) ).toBe( 2 );
		expect( countTracks( 'none' ) ).toBeUndefined();
		expect( layoutOf( {} ) ).toEqual( { display: 'block', direction: 'column' } );
	} );
} );

describe( 'wrapper collapsing (FR-13)', () => {
	it( 'removes invisible single-child wrappers and keeps max-width', () => {
		const tree = cn( 'section', { 'padding-top': '96px' }, [
			cn( 'div', { 'max-width': '1200px' }, [ cn( 'div', {}, [ text( 'h2', 'Title' ), text( 'p', 'Body' ) ] ) ] ),
		] );
		const ir = collapseWrappers( buildIR( tree, ids() ) );
		expect( ir.tag ).toBe( 'section' );
		expect( ir.innerMaxWidth ).toBe( 1200 );
		expect( ir.children.map( ( c ) => c.kind ) ).toEqual( [ 'heading', 'text' ] );
	} );

	it( 'keeps wrappers that carry visual styles, semantics or links', () => {
		const card = cn( 'div', { 'background-color': 'rgb(255, 255, 255)', 'padding-top': '24px' }, [ text( 'h3', 'Card' ) ] );
		expect( collapseWrappers( buildIR( cn( 'div', {}, [ card ] ), ids() ) ).styles.desktop[ 'background-color' ] ).toBe( 'rgb(255, 255, 255)' );
		const header = cn( 'header', {}, [ cn( 'div', { 'padding-top': '8px' }, [ text( 'p', 'x' ) ] ) ] );
		expect( collapseWrappers( buildIR( header, ids() ) ).tag ).toBe( 'header' );
		const linkCard = cn( 'a', {}, [ cn( 'div', { 'padding-top': '8px' }, [ text( 'h3', 'x' ), cn( 'img', {}, [], { attrs: { src: 'http://x/i.png' } } ) ] ) ], { attrs: { href: 'http://x' } } );
		expect( collapseWrappers( buildIR( linkCard, ids() ) ).content?.href ).toBe( 'http://x' );
	} );

	it( 'keeps anchors when collapsing', () => {
		const tree = cn( 'div', {}, [ cn( 'section', { 'padding-top': '8px' }, [ text( 'p', 'a' ), text( 'p', 'b' ) ] ) ], { attrs: { id: 'features' } } );
		expect( collapseWrappers( buildIR( tree, ids() ) ).anchor ).toBe( 'features' );
	} );

	it( 'assigns percentage widths to flex-row children', () => {
		const row = cn( 'div', { display: 'flex', 'flex-direction': 'row' }, [
			cn( 'div', { 'flex-grow': '1' }, [ text( 'p', 'a' ), text( 'p', 'b' ) ], { rect: { x: 0, y: 0, w: 720, h: 10 } } ),
			cn( 'div', { 'flex-grow': '1' }, [ text( 'p', 'c' ), text( 'p', 'd' ) ], { rect: { x: 720, y: 0, w: 720, h: 10 } } ),
		] );
		const ir = buildIR( row, ids() );
		expect( ir.children.map( ( c ) => c.widthPct ) ).toEqual( [ 50, 50 ] );
	} );
} );

describe( 'pattern detection (FR-16)', () => {
	const trigger = ( t: string ) => cn( 'button', {}, [], { text: t, attrs: { 'aria-expanded': 'false', 'data-state': 'closed', 'data-radix-collection-item': '' } } );
	it( 'detects Radix accordions', () => {
		const acc = cn( 'div', {}, [ cn( 'div', {}, [ cn( 'h3', {}, [ trigger( 'Q1' ) ] ) ], { attrs: { 'data-state': 'closed', 'data-orientation': 'vertical' } } ), cn( 'div', {}, [ cn( 'h3', {}, [ trigger( 'Q2' ) ] ) ], { attrs: { 'data-state': 'closed' } } ) ] );
		expect( detectPattern( acc ) ).toMatchObject( { type: 'accordion', meta: { titles: [ 'Q1', 'Q2' ] } } );
	} );

	it( 'detects tabs and carousels', () => {
		const tabs = cn( 'div', {}, [ cn( 'div', {}, [ cn( 'button', {}, [], { text: 'A', attrs: { role: 'tab' } } ), cn( 'button', {}, [], { text: 'B', attrs: { role: 'tab' } } ) ], { attrs: { role: 'tablist' } } ), cn( 'div', {}, [], { attrs: { role: 'tabpanel' } } ) ] );
		expect( detectPattern( tabs ) ).toMatchObject( { type: 'tabs', confidence: 0.95, meta: { titles: [ 'A', 'B' ] } } );
		const car = cn( 'div', {}, [ cn( 'div', {}, [], { attrs: { 'aria-roledescription': 'slide' } } ) ], { attrs: { 'aria-roledescription': 'carousel' } } );
		expect( detectPattern( car ) ).toMatchObject( { type: 'carousel', meta: { slides: 1 } } );
		expect( detectPattern( cn( 'div', {}, [], { attrs: { class: 'swiper' } } ) )?.type ).toBe( 'carousel' );
		expect( detectPattern( cn( 'div' ) ) ).toBeUndefined();
	} );
} );

describe( 'repeat detection (FR-17)', () => {
	it( 'marks ≥3 structurally similar siblings', () => {
		const card = () => cn( 'div', { 'padding-top': '16px' }, [ cn( 'svg', {}, [], { svg: '<svg/>' } ), text( 'h3', 'T' ), text( 'p', 'D' ) ] );
		const grid = buildIR( cn( 'div', { display: 'grid' }, [ card(), card(), card(), text( 'p', 'odd' ) ] ), ids() );
		detectRepeats( grid );
		expect( grid.pattern ).toMatchObject( { type: 'repeat', meta: { count: 3 } } );
	} );

	it( 'computes multiset similarity', () => {
		expect( similarity( [ 'a', 'b', 'b' ], [ 'a', 'b', 'b' ] ) ).toBe( 1 );
		expect( similarity( [ 'a', 'b' ], [ 'a', 'c' ] ) ).toBeCloseTo( 1 / 3 );
		expect( similarity( [], [] ) ).toBe( 0 );
		expect( signature( buildIR( cn( 'div', { 'padding-top': '1px' }, [ text( 'h3', 'x' ), text( 'p', 'y' ) ] ), ids() ) ) ).toEqual( [ 'container', 'container>heading', 'container>text' ] );
	} );
} );

describe( 'sections & semantic labels (FR-18)', () => {
	const page = () =>
		cn( 'body', {}, [
			cn( 'div', {}, [
				cn( 'header', { 'padding-top': '16px', display: 'flex' }, [ text( 'a', 'Logo', {}, { attrs: { href: '/' } } ), cn( 'nav', { display: 'flex' }, [ text( 'a', 'Pricing', {}, { attrs: { href: '#pricing' } } ) ] ) ], { rect: { x: 0, y: 0, w: 1440, h: 64 } } ),
				cn( 'main', {}, [
					cn( 'section', { 'padding-top': '96px' }, [ text( 'h1', 'Build faster' ), text( 'a', 'Start', { 'padding-top': '8px', 'padding-left': '16px', 'background-color': 'rgb(0, 0, 0)' } ) ], { rect: { x: 0, y: 64, w: 1440, h: 600 } } ),
					cn( 'section', { 'padding-top': '64px' }, [ text( 'h2', 'Simple pricing' ), text( 'p', '$19 / mo' ) ], { rect: { x: 0, y: 664, w: 1440, h: 400 }, attrs: { id: 'pricing' } } ),
				], { rect: { x: 0, y: 64, w: 1440, h: 1000 } } ),
				cn( 'footer', { 'padding-top': '32px' }, [ text( 'p', '© 2026 Acme' ), text( 'p', 'Made with love' ) ], { rect: { x: 0, y: 1064, w: 1440, h: 120 } } ),
			], { rect: { x: 0, y: 0, w: 1440, h: 1184 }, attrs: { id: 'root' } } ),
		], { rect: { x: 0, y: 0, w: 1440, h: 1184 } } );

	it( 'expands page wrappers into full-width sections and labels them', () => {
		const ir = collapseWrappers( buildIR( page(), ids() ) );
		const sections = findSections( ir, 1440 );
		expect( sections.map( ( s ) => s.tag ) ).toEqual( [ 'header', 'section', 'section', 'footer' ] );
		labelSections( sections );
		expect( sections.map( ( s ) => s.semantic ) ).toEqual( [ 'header', 'hero', 'pricing', 'footer' ] );
		expect( sections.map( ( s ) => s.label ) ).toEqual( [ 'Header', 'Hero', 'Pricing', 'Footer' ] );
	} );

	it( 'falls back to the first heading, then a numbered label', () => {
		const a = buildIR( cn( 'section', { 'padding-top': '1px' }, [ text( 'h2', 'Our story' ), text( 'p', 'x' ) ], { rect: { x: 0, y: 900, w: 1440, h: 300 } } ), ids() );
		const b = buildIR( cn( 'section', { 'padding-top': '1px' }, [ text( 'p', 'x' ), text( 'p', 'y' ) ], { rect: { x: 0, y: 1200, w: 1440, h: 300 } } ), ids() );
		const c = buildIR( cn( 'section', { 'padding-top': '1px' }, [ text( 'p', 'x' ), text( 'p', 'y' ) ], { rect: { x: 0, y: 1500, w: 1440, h: 300 } } ), ids() );
		labelSections( [ a, b, c ] );
		expect( [ a.label, b.label, c.label ] ).toEqual( [ 'Our story', 'Section 2', 'Section 3' ] );
		expect( classifySection( a, 3, 10, 'hero' ) ).toBeUndefined();
	} );
} );

describe( 'unbulleted link lists (footer / nav columns)', () => {
	const li = ( t: string, href: string ) => text( 'li', t, {}, { html: `<a href="${ href }">${ t }</a>` } );
	const list = cn( 'ul', { display: 'flex', 'flex-direction': 'column', 'row-gap': '8px', 'list-style-type': 'none' }, [ li( 'About', 'https://x.test/about' ), li( 'Pricing', 'https://x.test/pricing?a=1&amp;b=2' ) ] );

	it( 'becomes an Icon List without icons, keeping the links', () => {
		expect( asIconList( list ) ).toEqual( {
			tag: 'ul',
			noIcons: true,
			items: [ { text: 'About', href: 'https://x.test/about' }, { text: 'Pricing', href: 'https://x.test/pricing?a=1&b=2' } ],
		} );
	} );

	it( 'leaves bulleted lists alone', () => {
		const bulleted = cn( 'ul', {}, [ li( 'One', '#1' ), li( 'Two', '#2' ) ] );
		expect( asIconList( bulleted ) ).toBeNull();
	} );
} );
