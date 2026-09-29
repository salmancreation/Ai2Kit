// @vitest-environment happy-dom
import { convert } from '../src/pipeline';
import type { V3Element } from '../src/emit/v3';
import type { V4Element } from '../src/emit/v4';
import type { CapturedNode, PanelCapture } from '../src/ir/types';
import { groupTriggers, panelHtml } from '../src/capture/collapsed';
import { capture, cn, resetKeys, text, validateAgainstRegistry } from './helpers';

type El = V3Element | V4Element;
const all = ( els: El[] ): El[] => els.flatMap( ( e ) => [ e, ...all( e.elements as El[] ) ] );

const BORDER = 'rgb(226, 232, 240)';

function faq( panels = true ): ReturnType< typeof capture > {
	resetKeys();
	const qa = [
		[ 'Is there a free plan?', 'Yes. Free for personal use.' ],
		[ 'Can my team use it?', 'Team plans add <strong>shared goals</strong>.' ],
		[ 'Is my data private?', 'Your data is encrypted.' ],
	];
	const items = qa.map( ( [ q, a ] ) => {
		const trigger: CapturedNode = text( 'button', q!, {
			display: 'flex',
			'justify-content': 'space-between',
			'align-items': 'center',
			'padding-top': '18px',
			'padding-bottom': '18px',
			'font-size': '16px',
			'font-weight': '600',
			color: 'rgb(15, 23, 42)',
		}, { attrs: { 'aria-expanded': 'false', 'data-state': 'closed', 'aria-controls': 'r1', 'data-a2k-icon': 'lucide lucide-chevron-down', 'data-a2k-icon-size': '16' }, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="m6 9 6 6 6-6"/></svg>', rect: { x: 0, y: 0, w: 760, h: 60 } } );
		if ( panels ) {
			const panel: PanelCapture = {
				html: `<p>${ a }</p>`,
				text: a!.replace( /<[^>]+>/g, '' ),
				styles: { 'padding-bottom': '18px' },
				textStyles: { color: 'rgb(100, 116, 139)', 'font-size': '16px', 'line-height': '24px' },
				open: false,
				multiple: false,
			};
			trigger.panel = panel;
		}
		const header = cn( 'h3', {}, [ trigger ], { rect: { x: 0, y: 0, w: 760, h: 60 } } );
		return cn( 'div', { 'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': BORDER }, [ header ], { attrs: { 'data-state': 'closed', 'data-orientation': 'vertical' }, rect: { x: 0, y: 0, w: 760, h: 61 } } );
	} );
	const root = cn( 'div', { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': BORDER }, items, { attrs: { 'data-orientation': 'vertical' }, rect: { x: 0, y: 0, w: 760, h: 184 } } );
	const heading = text( 'h2', 'Frequently asked questions', { 'font-size': '34px', 'font-weight': '700' } );
	const section = cn( 'section', { display: 'flex', 'flex-direction': 'column', 'padding-top': '80px' }, [ heading, root ], { attrs: { id: 'faq' } } );
	return capture( cn( 'body', {}, [ section ] ) );
}

describe( 'accordion → native Nested Accordion (Free)', () => {
	const result = convert( faq(), 'acc-v3' );
	const els = result.document.content as V3Element[];
	const acc = all( els ).find( ( e ) => e.widgetType === 'nested-accordion' ) as V3Element;

	it( 'emits a Nested Accordion that passes the control registry', () => {
		expect( acc ).toBeDefined();
		expect( validateAgainstRegistry( els ) ).toEqual( [] );
	} );

	it( 'keeps every question and answer, all collapsed, one open at a time', () => {
		expect( ( acc.settings.items as Array< { item_title: string } > ).map( ( i ) => i.item_title ) ).toEqual( [ 'Is there a free plan?', 'Can my team use it?', 'Is my data private?' ] );
		expect( acc.settings.default_state ).toBe( 'all_collapsed' );
		expect( acc.settings.max_items_expended ).toBe( 'one' );
		expect( acc.elements ).toHaveLength( 3 );
		const answer = acc.elements[ 1 ]!.elements[ 0 ]!;
		expect( answer.widgetType ).toBe( 'text-editor' );
		expect( answer.settings.editor ).toBe( '<p>Team plans add <strong>shared goals</strong>.</p>' );
	} );

	it( 'overrides Elementor\'s stock look with the source\'s', () => {
		const s = acc.settings;
		expect( s.accordion_item_title_position_horizontal ).toBe( 'stretch' );
		expect( s.accordion_item_title_icon ).toMatchObject( { library: 'svg' } );
		expect( s.accordion_item_title_icon_active ).toEqual( s.accordion_item_title_icon ); // The source doesn't rotate it.
		expect( s.accordion_item_title_icon_position ).toBe( 'end' );
		expect( s.icon_size ).toEqual( { unit: 'px', size: 16, sizes: [] } );
		expect( s.accordion_padding ).toMatchObject( { top: '18', right: '0', bottom: '18', left: '0' } );
		expect( s.accordion_border_normal_width ).toMatchObject( { top: '0', bottom: '1' } );
		expect( s.accordion_border_active_border ).toBe( 'none' );
		expect( s.content_border_width ).toMatchObject( { top: '0', bottom: '1' } );
		expect( s._border_width ).toMatchObject( { top: '1', bottom: '0' } );
		expect( acc.elements[ 0 ]!.settings.padding ).toMatchObject( { bottom: '18', top: '0' } );
	} );

	it( 'reports no lost content and no Pro hint for the FAQ section', () => {
		const faqReport = result.sections.find( ( s ) => s.patterns.includes( 'accordion' ) )!;
		expect( faqReport.warnings.join( ' ' ) ).not.toMatch( /accordion/i );
		expect( faqReport.proHints ).toEqual( [] );
		expect( faqReport.summary ).toContain( 'accordion' );
	} );

	it( 'mixes the v3 Nested Accordion into v4 output', () => {
		const v4 = convert( faq(), 'acc-v4', { format: 'v4' } ).document.content as El[];
		expect( validateAgainstRegistry( v4 ) ).toEqual( [] );
		expect( all( v4 ).some( ( e ) => e.widgetType === 'nested-accordion' ) ).toBe( true );
	} );

	it( 'falls back to static content (with a warning) when answers weren\'t captured', () => {
		const r = convert( faq( false ), 'acc-none' );
		expect( all( r.document.content as El[] ).some( ( e ) => e.widgetType === 'nested-accordion' ) ).toBe( false );
		expect( r.sections.some( ( s ) => s.warnings.some( ( w ) => /accordion/i.test( w ) ) ) ).toBe( true );
	} );
} );

describe( 'collapsed panel capture helpers', () => {
	it( 'groups triggers by their accordion root and ignores lone toggles', () => {
		document.body.innerHTML = '<div id="a"><div><button aria-expanded="false">1</button></div><div><button aria-expanded="false">2</button></div></div><div><button aria-expanded="false">menu</button></div>';
		const triggers = Array.from( document.querySelectorAll( 'button' ) );
		const groups = groupTriggers( triggers );
		expect( groups ).toHaveLength( 1 );
		expect( groups[ 0 ]!.map( ( b ) => b.textContent ) ).toEqual( [ '1', '2' ] );
	} );

	it( 'keeps paragraphs and lists in panel HTML', () => {
		document.body.innerHTML = '<div id="p"><p>Hello <em>there</em></p><ul><li>One</li><li>Two</li></ul><script>x</script></div>';
		expect( panelHtml( document.getElementById( 'p' )!, window ) ).toBe( '<p>Hello <em>there</em></p><ul><li>One</li><li>Two</li></ul>' );
		document.body.innerHTML = '<div id="q">Plain answer</div>';
		expect( panelHtml( document.getElementById( 'q' )!, window ) ).toBe( '<p>Plain answer</p>' );
	} );

	it( 'opens a React-style accordion, reads answers and restores it', async () => {
		const { captureCollapsed } = await import( '../src/capture/collapsed' );
		document.body.innerHTML = '<div><div><button data-a2k-key="t1" aria-expanded="false" aria-controls="c1">Q1</button></div><div><button data-a2k-key="t2" aria-expanded="false" aria-controls="c2">Q2</button></div></div>';
		// Single-open accordion that renders panels asynchronously, like React 18.
		const buttons = Array.from( document.querySelectorAll( 'button' ) );
		buttons.forEach( ( b, i ) =>
			b.addEventListener( 'click', () =>
				queueMicrotask( () => {
					const open = b.getAttribute( 'aria-expanded' ) !== 'true';
					buttons.forEach( ( o ) => {
						o.setAttribute( 'aria-expanded', 'false' );
						document.getElementById( o.getAttribute( 'aria-controls' )! )?.remove();
					} );
					if ( open ) {
						b.setAttribute( 'aria-expanded', 'true' );
						const c = document.createElement( 'div' );
						c.id = `c${ i + 1 }`;
						c.textContent = `Answer ${ i + 1 }`;
						b.parentElement!.appendChild( c );
					}
				} )
			)
		);
		const { panels } = await captureCollapsed( document, window, 'data-a2k-key', () => ( {} ) );
		expect( panels.get( 't1' )?.text ).toBe( 'Answer 1' );
		expect( panels.get( 't2' )?.html ).toBe( '<p>Answer 2</p>' );
		expect( panels.get( 't1' )?.multiple ).toBe( false );
		expect( buttons.every( ( b ) => b.getAttribute( 'aria-expanded' ) === 'false' ) ).toBe( true );
	} );
} );

describe( 'native <details> accordions', () => {
	it( 'opens each <details>, reads the answer (not the summary) and restores it', async () => {
		const { captureCollapsed } = await import( '../src/capture/collapsed' );
		document.body.innerHTML =
			'<div><details><summary data-a2k-key="s1">Q1</summary><p>Answer <strong>one</strong></p></details>' +
			'<details open><summary data-a2k-key="s2">Q2</summary><div class="a"><p>Answer two</p><ul><li>x</li></ul></div></details></div>';
		const { panels } = await captureCollapsed( document, window, 'data-a2k-key', () => ( {} ) );
		expect( panels.get( 's1' )?.html ).toBe( '<p>Answer <strong>one</strong></p>' );
		expect( panels.get( 's1' )?.text ).toBe( 'Answer one' );
		expect( panels.get( 's2' )?.html ).toBe( '<p>Answer two</p><ul><li>x</li></ul>' );
		expect( panels.get( 's2' )?.open ).toBe( true );
		const details = Array.from( document.querySelectorAll( 'details' ) );
		expect( details.map( ( d ) => d.open ) ).toEqual( [ false, true ] );
	} );

	it( 'maps a "+"/"−" ::after glyph and the browser marker to Font Awesome icons', async () => {
		const { convert } = await import( '../src/pipeline' );
		for ( const [ panelExtra, normal, active, pos ] of [
			[ { glyph: { closed: '+', open: '−', position: 'end', size: 20 } }, 'fas fa-plus', 'fas fa-minus', 'end' ],
			[ { marker: true }, 'fas fa-caret-right', 'fas fa-caret-down', 'start' ],
		] as const ) {
			resetKeys();
			const items = [ 'A?', 'B?' ].map( ( q ) => {
				const summary = text( 'summary', q, { 'font-size': '16px' }, { rect: { x: 0, y: 0, w: 700, h: 24 } } );
				summary.panel = { html: `<p>${ q } yes</p>`, text: `${ q } yes`, styles: {}, textStyles: {}, open: false, multiple: true, ...panelExtra };
				return cn( 'details', { 'padding-top': '8px', 'padding-bottom': '8px' }, [ summary ], { rect: { x: 0, y: 0, w: 700, h: 40 } } );
			} );
			const els = convert( capture( cn( 'body', {}, [ cn( 'section', {}, [ cn( 'div', {}, items, { rect: { x: 0, y: 0, w: 700, h: 80 } } ) ] ) ] ) ), 'details' ).document.content as V3Element[];
			const acc = all( els ).find( ( e ) => e.widgetType === 'nested-accordion' ) as V3Element;
			expect( validateAgainstRegistry( els ) ).toEqual( [] );
			expect( ( acc.settings.accordion_item_title_icon as { value: string } ).value ).toBe( normal );
			expect( ( acc.settings.accordion_item_title_icon_active as { value: string } ).value ).toBe( active );
			expect( acc.settings.accordion_item_title_icon_position ).toBe( pos );
			expect( acc.settings.max_items_expended ).toBe( 'multiple' );
			// The <details> padding lands on the title, once.
			expect( acc.settings.accordion_padding ).toMatchObject( { top: '8', bottom: '8' } );
		}
	} );
} );
