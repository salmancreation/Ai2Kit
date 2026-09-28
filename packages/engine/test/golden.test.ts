/**
 * Golden-file test (PRD §12.3): IR-derived Elementor JSON for known sources is
 * snapshotted in tests/fixtures/elementor/generated/. Changes need explicit
 * approval: re-run with UPDATE_GOLDEN=1 and review the diff.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { convert } from '../src/pipeline';
import { capture, validateAgainstRegistry } from './helpers';
import { landing } from './fixtures/landing';

const OUT = resolve( __dirname, '../../../tests/fixtures/elementor/generated' );

const cases: Record< string, () => ReturnType< typeof convert > > = {
	landing: () => convert( capture( landing() ), 'golden-landing' ),
	'landing-v4': () => convert( capture( landing() ), 'golden-landing', { format: 'v4' } ),
};

describe( 'golden conversions', () => {
	for ( const [ name, run ] of Object.entries( cases ) ) {
		it( `${ name } matches its golden file`, () => {
			const result = run();
			expect( validateAgainstRegistry( result.document.content ) ).toEqual( [] );
			const json = JSON.stringify( { document: result.document, tokens: result.tokens, sections: result.sections, overall: result.overall }, null, '\t' ) + '\n';
			const file = `${ OUT }/${ name }.json`;
			if ( process.env.UPDATE_GOLDEN || ! existsSync( file ) ) {
				mkdirSync( dirname( file ), { recursive: true } );
				writeFileSync( file, json );
			}
			expect( json ).toBe( readFileSync( file, 'utf8' ) );
		} );
	}
} );
