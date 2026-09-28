/** Fidelity score per section (FR-29): structure, style coverage, fallback ratio. */
import type { SectionScore } from '../ir/types';
import type { NodeStats } from '../emit/v3';

export function scoreSection( stats: NodeStats ): SectionScore {
	const structure = stats.leaves ? stats.nativeLeaves / stats.leaves : 1;
	const styles = stats.relevant ? stats.mapped / stats.relevant : 1;
	const fallbackRatio = stats.leaves ? stats.fallbacks / stats.leaves : 0;
	const score = Math.round( 100 * ( 0.45 * structure + 0.4 * styles + 0.15 * ( 1 - fallbackRatio ) ) - Math.min( 30, stats.penalty ) );
	const r = ( n: number ): number => Math.round( n * 100 ) / 100;
	return { score: Math.max( 0, Math.min( 100, score ) ), structure: r( structure ), styles: r( styles ), fallbackRatio: r( fallbackRatio ) };
}

/** Area-weighted overall score. */
export function overallScore( sections: Array< { score: SectionScore; area: number } > ): number {
	const total = sections.reduce( ( s, x ) => s + Math.max( 1, x.area ), 0 );
	if ( ! total ) return 0;
	return Math.round( sections.reduce( ( s, x ) => s + x.score.score * Math.max( 1, x.area ), 0 ) / total );
}

/** DESIGN.md §3.2 score scale. */
export function scoreBand( score: number ): 'high' | 'mid' | 'low' {
	return score >= 90 ? 'high' : score >= 70 ? 'mid' : 'low';
}
