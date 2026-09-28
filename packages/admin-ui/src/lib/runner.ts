/**
 * Runs a conversion against the job's entry page in a same-origin iframe:
 * render → capture (3 breakpoints) → sections → tokens → Elementor layout.
 * Capture needs the DOM, so it stays on the main thread (PRD §7).
 */
import {
	analyze,
	captureAll,
	DEFAULT_VIEWPORT,
	emit,
	freezeElement,
	injectSettleStyles,
	KEY_ATTR,
	responsiveDiffs,
	scrollThrough,
	suggestedModes,
	waitForStable,
	type Analysis,
	type Breakpoint,
	type ConversionResult,
} from '@ai2kit/engine';

export type StageId = 'render' | 'capture' | 'sections' | 'tokens' | 'build';
export type StageState = { id: StageId; status: 'pending' | 'active' | 'done' | 'error'; ms?: number; detail?: string };

export type RunOutput = {
	analysis: Analysis;
	result: ConversionResult;
	frozen: Record< string, string >;
	modes: Record< string, 'native' | 'html' >;
	timedOut: boolean;
};

export type RunHooks = {
	onStage: ( id: StageId, status: StageState[ 'status' ], detail?: string ) => void;
	onLog: ( line: string ) => void;
	signal: AbortSignal;
};

export class CancelledError extends Error {
	constructor() {
		super( 'Cancelled' );
	}
}

const nextFrame = ( win: Window ): Promise< void > => new Promise( ( r ) => win.requestAnimationFrame( () => win.requestAnimationFrame( () => r() ) ) );
const sleep = ( ms: number ): Promise< void > => new Promise( ( r ) => setTimeout( r, ms ) );

function loadFrame( iframe: HTMLIFrameElement, url: string, signal: AbortSignal ): Promise< Window > {
	return new Promise( ( resolve, reject ) => {
		const timer = setTimeout( () => reject( new Error( 'The page took longer than 30 seconds to load.' ) ), 30000 );
		const done = (): void => {
			clearTimeout( timer );
			iframe.removeEventListener( 'load', done );
			const win = iframe.contentWindow;
			if ( ! win || ! iframe.contentDocument ) {
				reject( new Error( 'The page could not be opened in the preview frame.' ) );
				return;
			}
			resolve( win );
		};
		signal.addEventListener( 'abort', () => {
			clearTimeout( timer );
			reject( new CancelledError() );
		} );
		iframe.addEventListener( 'load', done );
		iframe.src = url;
	} );
}

export async function runConversion( iframe: HTMLIFrameElement, entryUrl: string, seed: string, hooks: RunHooks ): Promise< RunOutput > {
	const { onStage, onLog, signal } = hooks;
	const check = (): void => {
		if ( signal.aborted ) throw new CancelledError();
	};

	/* 1. Render */
	onStage( 'render', 'active' );
	iframe.style.width = `${ DEFAULT_VIEWPORT.desktop }px`;
	const win = await loadFrame( iframe, entryUrl, signal );
	const doc = win.document;
	onLog( `Loaded ${ entryUrl }` );
	const stable = await waitForStable( win, { quietMs: 500, timeoutMs: 15000 } );
	onLog( stable.timedOut ? 'Render did not settle within 15 s; capturing anyway.' : `Render settled in ${ stable.ms } ms.` );
	check();
	await scrollThrough( win );
	injectSettleStyles( doc );
	await waitForStable( win, { quietMs: 300, timeoutMs: 4000 } );
	if ( ! doc.body || ! doc.body.innerText.trim() ) {
		throw new Error( 'The page rendered no visible content. If this is a React build, make sure you uploaded the built dist folder.' );
	}
	onStage( 'render', 'done' );
	check();

	/* 2. Capture at desktop / tablet / mobile */
	onStage( 'capture', 'active', 'desktop' );
	const resize = async ( w: number ): Promise< void > => {
		iframe.style.width = `${ w }px`;
		await nextFrame( win );
		await sleep( 120 );
		await nextFrame( win );
		check();
	};
	const capture = await captureAll( { doc, win }, resize, DEFAULT_VIEWPORT, ( bp: Breakpoint ) => {
		onStage( 'capture', 'active', bp );
		onLog( `Capturing ${ bp } (${ DEFAULT_VIEWPORT[ bp ] }px)` );
	} );
	onStage( 'capture', 'done' );
	check();

	/* 3. Sections (+ recognition) */
	onStage( 'sections', 'active' );
	await sleep( 0 );
	const analysis = analyze( capture, seed );
	onLog( `Found ${ analysis.sections.length } sections: ${ analysis.sections.map( ( s ) => s.label ).join( ', ' ) }` );
	onStage( 'sections', 'done', String( analysis.sections.length ) );
	check();

	/* 4. Tokens (extracted during analysis; reported separately) */
	onStage( 'tokens', 'active' );
	await sleep( 0 );
	onLog( `Design tokens (${ analysis.tokens.source }): ${ analysis.tokens.colors.length } colors, ${ analysis.tokens.fonts.length } fonts` );
	onStage( 'tokens', 'done' );

	/* 5. Build Elementor layout */
	onStage( 'build', 'active' );
	const frozen: Record< string, string > = {};
	const diffs = responsiveDiffs( capture.root );
	for ( const key of analysis.freezeKeys ) {
		const el = doc.querySelector( `[${ KEY_ATTR }="${ CSS.escape( key ) }"]` );
		if ( el ) frozen[ key ] = freezeElement( el, win, diffs );
	}
	const first = emit( analysis, { frozen } );
	const modes = suggestedModes( first );
	const result = emit( analysis, { frozen, modes } );
	onLog( `Built ${ result.document.content.length } containers · overall ${ result.overall }%` );
	onStage( 'build', 'done' );

	return { analysis, result, frozen, modes, timedOut: stable.timedOut };
}
