#!/usr/bin/env node
/**
 * Release (PRD §13): test, build, and zip the Free plugin into
 * dist/ai2kit-<version>.zip. Dev-only files (tests, vendor, configs) are excluded.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve( import.meta.dirname, '..' );
const plugin = join( root, 'plugin/ai2kit' );
const run = ( cmd, cwd = root ) => {
	console.log( `\n$ ${ cmd }` );
	execSync( cmd, { cwd, stdio: 'inherit' } );
};

const version = readFileSync( join( plugin, 'ai2kit.php' ), 'utf8' ).match( /Version:\s*([\d.]+)/ )[ 1 ];
const stable = readFileSync( join( plugin, 'readme.txt' ), 'utf8' ).match( /Stable tag:\s*([\d.]+)/ )[ 1 ];
if ( version !== stable ) {
	console.error( `Version mismatch: ai2kit.php ${ version } vs readme.txt Stable tag ${ stable }` );
	process.exit( 1 );
}

if ( ! process.argv.includes( '--skip-tests' ) ) {
	run( 'corepack pnpm@9.15.9 --filter @ai2kit/engine test' );
	run( 'corepack pnpm@9.15.9 --filter @ai2kit/engine typecheck' );
	run( 'corepack pnpm@9.15.9 --filter @ai2kit/admin-ui typecheck' );
	run( 'corepack pnpm@9.15.9 --filter @ai2kit/admin-ui test' );
	if ( existsSync( join( plugin, 'vendor/bin/phpunit' ) ) ) run( 'vendor/bin/phpunit', plugin );
}
run( 'corepack pnpm@9.15.9 --filter @ai2kit/admin-ui build' );

const stage = join( root, 'dist/ai2kit' );
rmSync( join( root, 'dist' ), { recursive: true, force: true } );
mkdirSync( stage, { recursive: true } );
for ( const entry of [ 'ai2kit.php', 'uninstall.php', 'readme.txt', 'includes', 'build', 'languages' ] ) {
	const from = join( plugin, entry );
	if ( existsSync( from ) ) cpSync( from, join( stage, entry ), { recursive: true } );
}
run( `zip -qr ai2kit-${ version }.zip ai2kit`, join( root, 'dist' ) );
console.log( `\n✓ dist/ai2kit-${ version }.zip` );
