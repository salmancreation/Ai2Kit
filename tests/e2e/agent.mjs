/**
 * Agent tools end to end (PRD M5.5), over real MCP:
 * an agent creates a job through the MCP Adapter's STDIO server (what Claude
 * Desktop launches), the user opens the review link, converts and imports in the
 * browser, then the agent reads the report and undoes the import.
 *
 *   npm run e2e:agent [-- --file tests/fixtures/source/ai-tailwind.html]
 *
 * Needs wp-env running and Elementor 4.3+ (it bundles the MCP Adapter).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { launch, login, parseArgs } from './lib.mjs';

const args = parseArgs( process.argv.slice( 2 ) );
const file = args.file ?? 'tests/fixtures/source/ai-tailwind.html';

const container = execFileSync( 'docker', [ 'ps', '--format', '{{.Names}}' ], { encoding: 'utf8' } )
	.split( '\n' )
	.find( ( n ) => /-cli-1$/.test( n ) && ! /tests-cli/.test( n ) );
if ( ! container ) throw new Error( 'wp-env cli container not found — run npx wp-env start' );

/** One MCP session: initialize, then call an ability through the default server. */
function ability( name, parameters = {} ) {
	const messages = [
		{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ai2kit-e2e', version: '1' } } },
		{ jsonrpc: '2.0', method: 'notifications/initialized' },
		{ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'mcp-adapter-execute-ability', arguments: { ability_name: name, parameters } } },
	];
	const out = spawnSync( 'docker', [ 'exec', '-i', container, 'wp', 'mcp-adapter', 'serve', '--server=mcp-adapter-default-server', '--user=admin' ], {
		input: messages.map( ( m ) => JSON.stringify( m ) ).join( '\n' ) + '\n',
		encoding: 'utf8',
		maxBuffer: 20 * 1024 * 1024,
	} );
	const reply = out.stdout
		.split( '\n' )
		.filter( ( l ) => l.startsWith( '{' ) )
		.map( ( l ) => JSON.parse( l ) )
		.find( ( m ) => m.id === 2 );
	const data = reply?.result?.structuredContent;
	if ( ! data?.success ) throw new Error( `${ name } failed: ${ JSON.stringify( reply?.result ?? reply?.error ?? out.stderr ).slice( 0, 800 ) }` );
	console.log( `✓ MCP ${ name }` );
	return data.data;
}

const check = ( ok, what ) => {
	if ( ! ok ) throw new Error( `✗ ${ what }` );
	console.log( `✓ ${ what }` );
};

// 1. Agent: site check + create a job from HTML it has.
check( ability( 'ai2kit/preflight' ).ready, 'site is ready' );
const job = ability( 'ai2kit/create-job', { html: readFileSync( file, 'utf8' ), title: 'Agent e2e' } );
check( job.status === 'uploaded' && job.review_url.includes( `job=${ job.uuid }` ), 'job waits for conversion with a review link' );

// 2. User: open the link, convert, import.
const { browser, page } = await launch();
try {
	await login( page );
	await page.goto( job.review_url );
	await page.getByRole( 'button', { name: 'Start conversion' } ).and( page.locator( ':enabled' ) ).click( { timeout: 30000 } );
	check( ! page.url().includes( 'job=' ), 'review link opens the Check step (and drops ?job from the URL)' );
	await page.getByRole( 'button', { name: 'Import to WordPress' } ).waitFor( { timeout: 90000 } );
	await page.getByRole( 'button', { name: 'Import to WordPress' } ).click();
	await page.getByText( 'Your site is in Elementor.' ).waitFor( { timeout: 90000 } );
	console.log( '✓ converted and imported in the browser' );

	// A used link explains itself instead of failing silently.
	await page.goto( job.review_url );
	await page.getByText( 'already imported' ).waitFor( { timeout: 30000 } );
	console.log( '✓ reopening an imported job shows a clear message' );
} finally {
	await browser.close();
}

// 3. Agent: report, then undo.
const done = ability( 'ai2kit/get-job', { uuid: job.uuid } );
check( done.status === 'imported' && done.pages.length === 1 && done.pages[ 0 ].edit_url.includes( 'action=elementor' ), 'agent sees the imported page and its edit link' );
check( done.title === 'Agent e2e' && done.sections.length > 0 && done.score > 0, `report: ${ done.sections.length } sections, ${ done.score }% match` );
check( ability( 'ai2kit/list-jobs', { status: 'imported', limit: 5 } ).jobs.some( ( j ) => j.uuid === job.uuid ), 'listed among imported jobs' );
const undone = ability( 'ai2kit/undo-import', { uuid: job.uuid } );
check( undone.trashed === 1, 'undo moved the page to the trash' );
check( ability( 'ai2kit/get-job', { uuid: job.uuid } ).status === 'undone', 'job is marked undone' );
console.log( '\nAgent flow passed.' );
