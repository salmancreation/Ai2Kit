/**
 * Capture → analysis (IR, sections, tokens) → Elementor document + report.
 * Pure and deterministic for a given seed (PRD §11).
 */
import type { Capture, IRNode, PatternType, ResidualRule, SectionReport, TokenTable } from './ir/types';
import { buildIR, collapseWrappers } from './normalize/build';
import { liftBackgroundLayers } from './normalize/layers';
import { boxSection, boxSelf, findSections, labelSections } from './recognize/sections';
import { detectRepeats } from './recognize/repeat';
import { extractTokens, tokenIndex } from './tokens/tokens';
import { emitSection, type V3Element, type NodeStats } from './emit/v3';
import { emitSectionV4, type V4Element } from './emit/v4';
import { overallScore, scoreSection } from './score/fidelity';
import { createIdGenerator } from './util/ids';
import { isTransparent } from './util/color';

export type Analysis = {
	seed: string;
	title: string;
	root: IRNode;
	sections: IRNode[];
	tokens: TokenTable;
	/** Capture keys whose frozen HTML the caller should provide (sections + fallbacks). */
	freezeKeys: string[];
};

export type ElementorDocument = {
	version: '0.4';
	title: string;
	type: 'page';
	page_settings: Record< string, unknown >;
	/** v3: containers + widgets. v4: atomic elements (styles as CSS, converted server-side) with v3 widgets mixed in. */
	format: 'v3' | 'v4';
	content: Array< V3Element | V4Element >;
	/** Scoped CSS for styles no Elementor control expresses (validated and scoped server-side). */
	residual: ResidualRule[];
};

export type EmitOptions = {
	/** Elementor output format (PRD §8.3). Default v3. */
	format?: 'v3' | 'v4';
	modes?: Record< string, 'native' | 'html' >;
	frozen?: Record< string, string >;
	assets?: Record< string, { url: string; id?: number } >;
	title?: string;
};

export type ConversionResult = {
	document: ElementorDocument;
	sections: SectionReport[];
	overall: number;
	tokens: TokenTable;
};

const PRO_HINTS: Partial< Record< PatternType, string > > = {
	tabs: 'Pro: map as Tabs',
	carousel: 'Pro: map as Carousel',
	dialog: 'Pro: map as Popup',
};

function walk( n: IRNode, fn: ( n: IRNode ) => void ): void {
	fn( n );
	n.children.forEach( ( c ) => walk( c, fn ) );
}

/** The page background usually lives on body/#root; sections inherit it visually. */
function pageBackground( root: IRNode, sections: IRNode[] ): string | undefined {
	const chain: IRNode[] = [];
	let cur: IRNode | undefined = root;
	while ( cur && ! sections.includes( cur ) ) {
		chain.push( cur );
		cur = cur.children.find( ( c ) => sections.some( ( s ) => s === c || contains( c, s ) ) );
	}
	for ( let i = chain.length - 1; i >= 0; i-- ) {
		const bg = chain[ i ]!.styles.desktop[ 'background-color' ];
		if ( ! isTransparent( bg ) ) return bg;
	}
	return undefined;
}

function contains( a: IRNode, b: IRNode ): boolean {
	return a.children.some( ( c ) => c === b || contains( c, b ) );
}

export function analyze( capture: Capture, seed: string ): Analysis {
	const nextId = createIdGenerator( `${ seed }:ir` );
	const built = buildIR( capture.root, nextId );
	// Background layers first: a lifted layer can leave a wrapper collapsible.
	const root = collapseWrappers( liftBackgroundLayers( built ) );
	const found = findSections( root, capture.meta.viewport.desktop );
	// Box sections in place so the IR tree and the section list stay the same objects.
	const sections = found.map( ( s ) => {
		const boxed = boxSection( s, collapseWrappers );
		if ( boxed !== s ) Object.assign( s, boxed );
		boxSelf( s, capture.meta.viewport.desktop );
		return s;
	} );
	detectRepeats( root );
	labelSections( sections );

	// Sections without their own background get the page background.
	const pageBg = pageBackground( root, sections );
	if ( pageBg ) {
		for ( const s of sections ) {
			if ( isTransparent( s.styles.desktop[ 'background-color' ] ) && ! s.styles.desktop[ 'background-image' ] ) {
				s.styles = { ...s.styles, desktop: { ...s.styles.desktop, 'background-color': pageBg } };
			}
		}
	}

	const freezeKeys: string[] = [];
	for ( const s of sections ) if ( s.key ) freezeKeys.push( s.key );
	walk( root, ( n ) => {
		if ( n.fallback && ! n.fallback.html && n.key ) freezeKeys.push( n.key );
	} );

	return { seed, title: capture.meta.title, root, sections, tokens: extractTokens( capture.meta, root ), freezeKeys };
}

function summarize( stats: NodeStats ): string {
	const names: Record< string, string > = {
		heading: 'heading',
		'text-editor': 'text',
		button: 'button',
		image: 'image',
		icon: 'icon',
		'icon-list': 'icon list',
		video: 'video',
		divider: 'divider',
		html: 'HTML block',
		'nested-accordion': 'accordion',
	};
	return Object.entries( stats.widgets )
		.filter( ( [ k ] ) => names[ k ] )
		.sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
		.map( ( [ k, n ] ) => ( n > 1 ? `${ n } ${ names[ k ] }s` : names[ k ]! ) )
		.join( ', ' );
}

function patternsIn( n: IRNode ): PatternType[] {
	const out = new Set< PatternType >();
	walk( n, ( x ) => {
		if ( x.pattern ) out.add( x.pattern.type );
	} );
	return [ ...out ];
}

export function emit( analysis: Analysis, opts: EmitOptions = {} ): ConversionResult {
	const nextId = createIdGenerator( `${ analysis.seed }:emit` );
	const tokens = tokenIndex( analysis.tokens );
	const content: Array< V3Element | V4Element > = [];
	const format = opts.format ?? 'v3';
	const emitOne = format === 'v4' ? emitSectionV4 : emitSection;
	const reports: SectionReport[] = [];
	const residual: ResidualRule[] = [];

	for ( const section of analysis.sections ) {
		const { element, stats } = emitOne( section, { tokens, nextId, modes: opts.modes, frozen: opts.frozen, assets: opts.assets, residual } );
		if ( element ) content.push( element );
		// Score the native mapping even when the section is shown as HTML, so the toggle is informed.
		const nativeStats = opts.modes?.[ section.id ] === 'html' ? emitOne( section, { tokens, nextId: createIdGenerator( 'score' ) } ).stats : stats;
		const patterns = patternsIn( section );
		// Interactive blocks kept static: hidden panels are content the page lost.
		// Accordions whose answers were captured become a native Accordion (no loss).
		const staticAccordion = patterns.includes( 'accordion' ) && ! nativeStats.widgets[ 'nested-accordion' ];
		if ( staticAccordion || patterns.includes( 'tabs' ) ) nativeStats.penalty += 10;
		if ( patterns.includes( 'carousel' ) ) nativeStats.penalty += 5;
		if ( staticAccordion ) nativeStats.warnings.push( 'Collapsed accordion answers couldn\'t be opened while converting, so they weren\'t captured. Add them in Elementor.' );
		if ( patterns.includes( 'tabs' ) ) nativeStats.warnings.push( 'Only the open tab was captured. Pro maps tabs to a native Tabs widget.' );
		if ( patterns.includes( 'carousel' ) ) nativeStats.warnings.push( 'Carousel slides are kept as static content. Pro maps carousels to a native carousel.' );
		const score = scoreSection( nativeStats );
		reports.push( {
			id: section.id,
			label: section.label ?? 'Section',
			semantic: section.semantic,
			rect: section.rect,
			score,
			summary: summarize( nativeStats ),
			widgets: nativeStats.widgets,
			patterns,
			warnings: [ ...new Set( nativeStats.warnings ) ],
			mode: opts.modes?.[ section.id ] ?? 'native',
			proHints: patterns.map( ( p ) => PRO_HINTS[ p ] ).filter( ( h ): h is string => !! h ),
		} );
	}

	const overall = overallScore( reports.map( ( r ) => ( { score: r.score, area: ( r.rect?.w ?? 1 ) * ( r.rect?.h ?? 1 ) } ) ) );
	return {
		document: {
			version: '0.4',
			title: opts.title ?? analysis.title,
			type: 'page',
			page_settings: { template: 'elementor_canvas' },
			format,
			content,
			residual,
		},
		sections: reports,
		overall,
		tokens: analysis.tokens,
	};
}

export function convert( capture: Capture, seed: string, opts: EmitOptions = {} ): ConversionResult {
	return emit( analyze( capture, seed ), opts );
}

/**
 * Suggested mode per section (DESIGN.md §5.7: Native when score ≥ 70).
 * A low score caused by one unmappable block (e.g. a form) stays Native —
 * that block alone is kept as HTML; HTML is suggested only when most of the
 * section can't be mapped.
 */
export function suggestedModes( result: ConversionResult ): Record< string, 'native' | 'html' > {
	return Object.fromEntries( result.sections.map( ( s ) => [ s.id, s.score.score >= 70 || s.score.structure >= 0.5 ? 'native' : 'html' ] ) );
}
