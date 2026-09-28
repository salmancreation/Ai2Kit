/**
 * Repeat detection (FR-17): ≥3 siblings with the same structural signature
 * (≥80% similarity) become pattern:repeat.
 */
import type { IRNode } from '../ir/types';

/** Multiset of root-relative paths ("container>heading") up to depth 3. */
export function signature( n: IRNode, depth = 3, prefix = '' ): string[] {
	const self = prefix ? `${ prefix }>${ n.kind }` : n.kind;
	const out = [ self ];
	if ( depth > 0 ) for ( const c of n.children ) out.push( ...signature( c, depth - 1, self ) );
	return out;
}

/** Multiset Jaccard similarity. */
export function similarity( a: string[], b: string[] ): number {
	const count = ( xs: string[] ): Map< string, number > => {
		const m = new Map< string, number >();
		for ( const x of xs ) m.set( x, ( m.get( x ) ?? 0 ) + 1 );
		return m;
	};
	const ma = count( a );
	const mb = count( b );
	let inter = 0;
	let union = 0;
	for ( const k of new Set( [ ...ma.keys(), ...mb.keys() ] ) ) {
		inter += Math.min( ma.get( k ) ?? 0, mb.get( k ) ?? 0 );
		union += Math.max( ma.get( k ) ?? 0, mb.get( k ) ?? 0 );
	}
	return union ? inter / union : 0;
}

export function detectRepeats( root: IRNode ): void {
	const visit = ( n: IRNode ): void => {
		n.children.forEach( visit );
		if ( n.pattern || n.children.length < 3 ) return;
		const containers = n.children.filter( ( c ) => c.kind === 'container' );
		if ( containers.length < 3 ) return;
		const sigs = containers.map( ( c ) => signature( c ) );
		// Compare each against the first; cards in a grid are near-identical.
		let best = 0;
		let bestIdx = 0;
		sigs.forEach( ( s, i ) => {
			const matches = sigs.filter( ( t ) => similarity( s, t ) >= 0.8 ).length;
			if ( matches > best ) {
				best = matches;
				bestIdx = i;
			}
		} );
		if ( best >= 3 ) {
			n.pattern = {
				type: 'repeat',
				confidence: Math.min( 1, best / containers.length ),
				meta: { count: best, signature: sigs[ bestIdx ]!.slice( 0, 12 ) },
			};
		}
	};
	visit( root );
}
