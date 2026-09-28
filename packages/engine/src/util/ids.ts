/**
 * Seeded, deterministic ID generator (PRD §11: same input → same output).
 * Elementor element IDs are 7-char lowercase hex, unique per document (§8.1).
 */

function hashSeed( seed: string ): number {
	// FNV-1a 32-bit.
	let h = 0x811c9dc5;
	for ( let i = 0; i < seed.length; i++ ) {
		h ^= seed.charCodeAt( i );
		h = Math.imul( h, 0x01000193 );
	}
	return h >>> 0;
}

export function createIdGenerator( seed: string ): () => string {
	let state = hashSeed( seed ) || 1;
	const used = new Set< string >();

	// mulberry32 PRNG.
	const rand = (): number => {
		state = ( state + 0x6d2b79f5 ) >>> 0;
		let t = state;
		t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};

	return () => {
		let id: string;
		do {
			id = Math.floor( rand() * 0x10000000 )
				.toString( 16 )
				.padStart( 7, '0' );
		} while ( used.has( id ) );
		used.add( id );
		return id;
	};
}
