/**
 * Real browser captures of the fixture sites (saved by the e2e harness with
 * --save-capture). Pure and fast: the whole engine runs on genuine layout data.
 */
import { readFileSync } from 'node:fs';
import { convert } from '../src/pipeline';
import type { Capture } from '../src/ir/types';
import { validateAgainstRegistry } from './helpers';

const load = ( name: string ): Capture => JSON.parse( readFileSync( `${ __dirname }/../../../tests/fixtures/captures/${ name }.json`, 'utf8' ) );

const cases: Array< { name: string; labels: string[]; tokens: 'shadcn' | 'clustered'; min: number } > = [
	{ name: 'static-landing', labels: [ 'Header', 'Hero', 'Features grid', 'Pricing', 'Testimonials', 'Ready to launch?', 'Footer' ], tokens: 'clustered', min: 90 },
	{ name: 'lovable-spa-dist', labels: [ 'Header', 'Hero', 'Features grid', 'FAQ', 'Call to action', 'Footer' ], tokens: 'shadcn', min: 90 },
	{ name: 'ai-tailwind', labels: [ 'Header', 'Hero', 'Features grid', 'A tiny roastery with big standards', 'Call to action', 'Footer' ], tokens: 'clustered', min: 90 },
];

describe.each( cases )( 'real capture: $name', ( { name, labels, tokens, min } ) => {
	const result = convert( load( name ), `real-${ name }` );

	it( 'emits only registry-valid Elementor settings', () => {
		expect( validateAgainstRegistry( result.document.content ) ).toEqual( [] );
	} );

	it( 'finds and labels the sections', () => {
		expect( result.sections.map( ( s ) => s.label ) ).toEqual( labels );
	} );

	it( `extracts ${ tokens } tokens and scores at least ${ min }`, () => {
		expect( result.tokens.source ).toBe( tokens );
		expect( result.overall ).toBeGreaterThanOrEqual( min );
	} );
} );

it( 'reports what the Lovable FAQ lost', () => {
	const faq = convert( load( 'lovable-spa-dist' ), 'x' ).sections.find( ( s ) => s.label === 'FAQ' )!;
	expect( faq.patterns ).toContain( 'accordion' );
	expect( faq.proHints ).toContain( 'Pro: map as Accordion' );
	expect( faq.warnings.join( ' ' ) ).toMatch( /accordion answers/ );
	expect( faq.score.score ).toBeLessThan( 95 );
} );

it( 'keeps Tailwind gradient text and transforms as residual CSS', () => {
	const doc = convert( load( 'ai-tailwind' ), 'x' ).document;
	expect( doc.residual.some( ( r ) => /^a2k-gt-/.test( r.className ) && r.decls[ '-webkit-background-clip' ] === 'text' ) ).toBe( true );
	expect( doc.residual.some( ( r ) => /^matrix\(/.test( r.decls.transform ?? '' ) ) ).toBe( true );
	expect( JSON.stringify( doc.content ) ).toMatch( /class=\\"a2k-gt-/ );
} );

describe.each( cases )( 'real capture as v4: $name', ( { name } ) => {
	const result = convert( load( name ), `real-v4-${ name }`, { format: 'v4' } );

	it( 'emits atomic elements valid against the exported v4 schema (v3 widgets mixed in are valid v3)', () => {
		expect( result.document.format ).toBe( 'v4' );
		expect( validateAgainstRegistry( result.document.content ) ).toEqual( [] );
	} );

	it( 'uses atomic elements for most of the page', () => {
		const all: Array< { elType: string; widgetType?: string; elements: unknown[] } > = [];
		const walk = ( els: typeof all ): void => els.forEach( ( e ) => {
			all.push( e );
			walk( e.elements as typeof all );
		} );
		walk( result.document.content as typeof all );
		const atomic = all.filter( ( e ) => e.elType.startsWith( 'e-' ) || ( e.widgetType ?? '' ).startsWith( 'e-' ) ).length;
		expect( atomic / all.length ).toBeGreaterThan( 0.8 );
	} );
} );

it( 'v4 never resets a desktop-only computed height at smaller breakpoints', () => {
	const doc = convert( load( 'lovable-spa-dist' ), 'x', { format: 'v4' } ).document;
	expect( JSON.stringify( doc.content ) ).not.toMatch( /min-height: initial/ );
} );
