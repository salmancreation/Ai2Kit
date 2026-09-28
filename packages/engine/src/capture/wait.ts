/**
 * Render-stability wait (FR-7) and final-animation-state forcing (FR-8).
 */

export type WaitOptions = { quietMs?: number; timeoutMs?: number };

export async function waitForStable( win: Window, opts: WaitOptions = {} ): Promise< { timedOut: boolean; ms: number } > {
	const quietMs = opts.quietMs ?? 500;
	const timeoutMs = opts.timeoutMs ?? 15000;
	const start = Date.now();
	const doc = win.document;

	const fontsReady = ( doc as Document & { fonts?: { ready: Promise< unknown > } } ).fonts?.ready ?? Promise.resolve();

	const quiet = new Promise< void >( ( resolve ) => {
		let timer: ReturnType< typeof setTimeout >;
		let lastResources = -1;
		const Observer = ( win as Window & { MutationObserver: typeof MutationObserver } ).MutationObserver;
		const check = (): void => {
			// Network idle ≈ no new resource entries during the quiet window.
			const count = win.performance?.getEntriesByType?.( 'resource' ).length ?? 0;
			if ( count !== lastResources ) {
				lastResources = count;
				arm();
				return;
			}
			obs.disconnect();
			resolve();
		};
		const arm = (): void => {
			clearTimeout( timer );
			timer = setTimeout( check, quietMs );
		};
		const obs = new Observer( arm );
		obs.observe( doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true } );
		arm();
	} );

	let timedOut = false;
	const timeout = new Promise< void >( ( resolve ) =>
		setTimeout( () => {
			timedOut = true;
			resolve();
		}, timeoutMs )
	);

	await Promise.race( [ Promise.all( [ fontsReady, quiet ] ), timeout ] );
	return { timedOut, ms: Date.now() - start };
}

/**
 * Scroll top-to-bottom so IntersectionObserver / whileInView animations fire,
 * then return to the top.
 */
export async function scrollThrough( win: Window, stepDelay = 60 ): Promise< void > {
	const doc = win.document;
	const height = Math.max( doc.body?.scrollHeight ?? 0, doc.documentElement.scrollHeight );
	const step = Math.max( 200, Math.floor( win.innerHeight * 0.8 ) );
	for ( let y = 0; y <= height; y += step ) {
		win.scrollTo( 0, y );
		await new Promise( ( r ) => setTimeout( r, stepDelay ) );
	}
	win.scrollTo( 0, 0 );
}

/** Style injected into the job document to settle transitions before capture. */
export const SETTLE_CSS = `*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;animation-fill-mode:both!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

export function injectSettleStyles( doc: Document ): void {
	if ( doc.getElementById( 'a2k-settle' ) ) return;
	const s = doc.createElement( 'style' );
	s.id = 'a2k-settle';
	s.textContent = SETTLE_CSS;
	doc.head.appendChild( s );
}
