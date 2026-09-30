/**
 * Runs a conversion against the job's entry page in a same-origin iframe:
 * render → capture (3 breakpoints) → sections → tokens → Elementor layout.
 * Capture needs the DOM, so it stays on the main thread (PRD §7).
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { sectionLabel } from './engineText';
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
	format: 'v3' | 'v4';
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
	const { onStage, onLog, signal, format } = hooks;
	const check = (): void => {
		if ( signal.aborted ) throw new CancelledError();
	};

	/* 1. Render */
	onStage( 'render', 'active' );
	iframe.style.width = `${ DEFAULT_VIEWPORT.desktop }px`;
	const win = await loadFrame( iframe, entryUrl, signal );
	const doc = win.document;
	/* translators: %s: URL of the uploaded page. */
	onLog( sprintf( __( 'Loaded %s', 'ai2kit' ), entryUrl ) );
	const stable = await waitForStable( win, { quietMs: 500, timeoutMs: 15000 } );
	onLog(
		stable.timedOut
			? __( 'Render did not settle within 15 s; capturing anyway.', 'ai2kit' )
			: /* translators: %d: milliseconds. */ sprintf( __( 'Render settled in %d ms.', 'ai2kit' ), stable.ms )
	);
	check();
	await scrollThrough( win );
	injectSettleStyles( doc );
	await waitForStable( win, { quietMs: 300, timeoutMs: 4000 } );
	if ( ! doc.body || ! doc.body.innerText.trim() ) {
		throw new Error( __( 'The page rendered no visible content. If this is a React build, make sure you uploaded the built dist folder.', 'ai2kit' ) );
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
		const bpName = { desktop: __( 'desktop', 'ai2kit' ), tablet: __( 'tablet', 'ai2kit' ), mobile: __( 'mobile', 'ai2kit' ) }[ bp ];
		/* translators: 1: breakpoint name (desktop, tablet, mobile), 2: width in pixels. */
		onLog( sprintf( __( 'Capturing %1$s (%2$dpx)', 'ai2kit' ), bpName, DEFAULT_VIEWPORT[ bp ] ) );
	} );
	onStage( 'capture', 'done' );
	// Exposed for the e2e harness, which saves real captures as engine test fixtures.
	( window as Window & { __ai2kitLastCapture?: unknown } ).__ai2kitLastCapture = capture;
	check();

	/* 3. Sections (+ recognition) */
	onStage( 'sections', 'active' );
	await sleep( 0 );
	const analysis = analyze( capture, seed );
	onLog(
		sprintf(
			/* translators: 1: number of sections, 2: their names. */
			_n( 'Found %1$d section: %2$s', 'Found %1$d sections: %2$s', analysis.sections.length, 'ai2kit' ),
			analysis.sections.length,
			analysis.sections.map( ( s ) => sectionLabel( s.label ?? '' ) ).join( ', ' )
		)
	);
	onStage( 'sections', 'done', String( analysis.sections.length ) );
	check();

	/* 4. Tokens (extracted during analysis; reported separately) */
	onStage( 'tokens', 'active' );
	await sleep( 0 );
	onLog(
		sprintf(
			/* translators: 1: number of colors, 2: number of fonts. */
			__( 'Design tokens: %1$d colors, %2$d fonts', 'ai2kit' ),
			analysis.tokens.colors.length,
			analysis.tokens.fonts.length
		)
	);
	onStage( 'tokens', 'done' );

	/* 5. Build Elementor layout */
	onStage( 'build', 'active' );
	const frozen: Record< string, string > = {};
	const diffs = responsiveDiffs( capture.root );
	for ( const key of analysis.freezeKeys ) {
		const el = doc.querySelector( `[${ KEY_ATTR }="${ CSS.escape( key ) }"]` );
		if ( el ) frozen[ key ] = freezeElement( el, win, diffs );
	}
	const first = emit( analysis, { frozen, format } );
	const modes = suggestedModes( first );
	const result = emit( analysis, { frozen, modes, format } );
	onLog(
		sprintf(
			/* translators: 1: number of sections, 2: output format, 3: overall match in percent. */
			__( 'Built %1$d sections as %2$s · overall %3$d%%', 'ai2kit' ),
			result.document.content.length,
			format === 'v4' ? __( 'atomic (v4) elements', 'ai2kit' ) : __( 'containers + widgets (v3)', 'ai2kit' ),
			result.overall
		)
	);
	onStage( 'build', 'done' );

	return { analysis, result, frozen, modes, timedOut: stable.timedOut };
}
