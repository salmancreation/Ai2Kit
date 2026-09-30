/**
 * Translations for text produced by the conversion engine.
 *
 * The engine is pure and language-neutral: its messages are English and also
 * end up inside Elementor as internal titles. What the admin UI shows is
 * translated here, so every visible string goes through the `ai2kit` text
 * domain (PRD §7 i18n). Unknown text (a section named after its heading, a
 * page title) is content and is shown as is.
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/** Section names from semantic labeling (engine: SEMANTIC_LABELS). */
function sectionLabels(): Record< string, string > {
	return {
		Header: __( 'Header', 'ai2kit' ),
		Navigation: __( 'Navigation', 'ai2kit' ),
		Hero: __( 'Hero', 'ai2kit' ),
		'Features grid': __( 'Features grid', 'ai2kit' ),
		Pricing: __( 'Pricing', 'ai2kit' ),
		Testimonials: __( 'Testimonials', 'ai2kit' ),
		FAQ: __( 'FAQ', 'ai2kit' ),
		'Call to action': __( 'Call to action', 'ai2kit' ),
		Footer: __( 'Footer', 'ai2kit' ),
		Gallery: __( 'Gallery', 'ai2kit' ),
		Stats: __( 'Stats', 'ai2kit' ),
		Team: __( 'Team', 'ai2kit' ),
		Logos: __( 'Logos', 'ai2kit' ),
		Blog: __( 'Blog', 'ai2kit' ),
		Section: __( 'Section', 'ai2kit' ),
	};
}

/** A section's display name. Numbered repeats ("Features grid 2") keep their number. */
export function sectionLabel( label: string ): string {
	const m = /^(.*?)(?: (\d+))?$/.exec( label );
	const base = m?.[ 1 ] ?? label;
	const num = m?.[ 2 ];
	const t = sectionLabels()[ base ];
	if ( ! t ) return label;
	if ( ! num ) return t;
	return sprintf(
		/* translators: 1: section name, 2: its number among sections with the same name. */
		__( '%1$s %2$s', 'ai2kit' ),
		t,
		num
	);
}

/** Widget counts → "2 headings, text, 3 buttons". */
export function widgetSummary( widgets: Record< string, number > ): string {
	const names: Record< string, ( n: number ) => string > = {
		/* translators: %d: number of headings. */
		heading: ( n ) => sprintf( _n( '%d heading', '%d headings', n, 'ai2kit' ), n ),
		/* translators: %d: number of text blocks. */
		'text-editor': ( n ) => sprintf( _n( '%d text', '%d texts', n, 'ai2kit' ), n ),
		/* translators: %d: number of buttons. */
		button: ( n ) => sprintf( _n( '%d button', '%d buttons', n, 'ai2kit' ), n ),
		/* translators: %d: number of images. */
		image: ( n ) => sprintf( _n( '%d image', '%d images', n, 'ai2kit' ), n ),
		/* translators: %d: number of icons. */
		icon: ( n ) => sprintf( _n( '%d icon', '%d icons', n, 'ai2kit' ), n ),
		/* translators: %d: number of icon lists. */
		'icon-list': ( n ) => sprintf( _n( '%d icon list', '%d icon lists', n, 'ai2kit' ), n ),
		/* translators: %d: number of videos. */
		video: ( n ) => sprintf( _n( '%d video', '%d videos', n, 'ai2kit' ), n ),
		/* translators: %d: number of dividers. */
		divider: ( n ) => sprintf( _n( '%d divider', '%d dividers', n, 'ai2kit' ), n ),
		/* translators: %d: number of accordions. */
		'nested-accordion': ( n ) => sprintf( _n( '%d accordion', '%d accordions', n, 'ai2kit' ), n ),
		/* translators: %d: number of HTML blocks. */
		html: ( n ) => sprintf( _n( '%d HTML block', '%d HTML blocks', n, 'ai2kit' ), n ),
	};
	// Atomic (v4) elements count as their classic equivalents.
	const alias: Record< string, string > = { 'e-heading': 'heading', 'e-paragraph': 'text-editor', 'e-button': 'button', 'e-image': 'image', 'e-svg': 'icon', 'e-divider': 'divider', 'e-youtube': 'video' };
	const merged: Record< string, number > = {};
	for ( const [ k, n ] of Object.entries( widgets ) ) {
		const key = alias[ k ] ?? k;
		if ( names[ key ] ) merged[ key ] = ( merged[ key ] ?? 0 ) + n;
	}
	return Object.entries( merged )
		.sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
		.map( ( [ k, n ] ) => names[ k ]!( n ) )
		.join( ', ' );
}

/** Why an element was kept as HTML. */
function reason( r: string ): string {
	const tag = /^No Elementor widget for <([a-z0-9-]+)>$/.exec( r );
	/* translators: %s: HTML tag name, e.g. <table>. */
	if ( tag ) return sprintf( __( 'no Elementor widget for <%s>', 'ai2kit' ), tag[ 1 ] );
	const map: Record< string, string > = {
		'Embedded frame': __( 'embedded frame', 'ai2kit' ),
		'Forms need Pro to map natively': __( 'forms need Pro to map natively', 'ai2kit' ),
		'switched to HTML in review': __( 'switched to HTML in review', 'ai2kit' ),
		'Unrecognized block': __( 'unrecognized block', 'ai2kit' ),
	};
	return map[ r ] ?? r;
}

/** A section warning from the engine. */
export function warningText( w: string ): string {
	const kept = /^Kept as HTML — (.+)\.$/.exec( w );
	/* translators: %s: the reason, e.g. "embedded frame". */
	if ( kept ) return sprintf( __( 'Kept as HTML — %s.', 'ai2kit' ), reason( kept[ 1 ]! ) );
	const map: Record< string, string > = {
		'Some styles no Elementor control covers were kept as scoped CSS.': __( 'Some styles no Elementor control covers were kept as scoped CSS.', 'ai2kit' ),
		'Some accordion answers were empty in the source.': __( 'Some accordion answers were empty in the source.', 'ai2kit' ),
		"Collapsed accordion answers couldn't be opened while converting, so they weren't captured. Add them in Elementor.": __( "Collapsed accordion answers couldn't be opened while converting, so they weren't captured. Add them in Elementor.", 'ai2kit' ),
		'Only the open tab was captured. Pro maps tabs to a native Tabs widget.': __( 'Only the open tab was captured. Pro maps tabs to a native Tabs widget.', 'ai2kit' ),
		'Carousel slides are kept as static content. Pro maps carousels to a native carousel.': __( 'Carousel slides are kept as static content. Pro maps carousels to a native carousel.', 'ai2kit' ),
		'Custom icon uploaded as SVG.': __( 'Custom icon uploaded as SVG.', 'ai2kit' ),
	};
	return map[ w ] ?? w;
}

/** A Pro hint chip. */
export function proHintText( h: string ): string {
	const map: Record< string, string > = {
		'Pro: map as Tabs': __( 'Pro: map as Tabs', 'ai2kit' ),
		'Pro: map as Carousel': __( 'Pro: map as Carousel', 'ai2kit' ),
		'Pro: map as Popup': __( 'Pro: map as Popup', 'ai2kit' ),
	};
	return map[ h ] ?? h;
}

/** The detected source type. */
export function sourceLabel( type: string, fallback: string ): string {
	const map: Record< string, string > = {
		source: __( 'Project source (not built)', 'ai2kit' ),
		'next-export': fallback.startsWith( 'v0' ) ? __( 'v0 (Next.js export)', 'ai2kit' ) : __( 'Next.js static export', 'ai2kit' ),
		lovable: __( 'Lovable (Vite + React)', 'ai2kit' ),
		bolt: __( 'Bolt (Vite + React)', 'ai2kit' ),
		'vite-spa': __( 'Vite + React app', 'ai2kit' ),
		'ai-html': __( 'AI-generated HTML', 'ai2kit' ),
		'html-template': __( 'HTML template', 'ai2kit' ),
		html: __( 'HTML', 'ai2kit' ),
		unknown: __( 'Unknown', 'ai2kit' ),
	};
	return map[ type ] ?? fallback;
}

/** One line of detection evidence. */
export function evidenceText( e: string ): string {
	const inline = /^(\d+) inline script\(s\)$/.exec( e );
	/* translators: %d: number of inline scripts. */
	if ( inline ) return sprintf( _n( '%d inline script', '%d inline scripts', Number( inline[ 1 ] ), 'ai2kit' ), Number( inline[ 1 ] ) );
	const files = /^(\d+) HTML file\(s\) with asset folders$/.exec( e );
	/* translators: %d: number of HTML files. */
	if ( files ) return sprintf( _n( '%d HTML file with asset folders', '%d HTML files with asset folders', Number( files[ 1 ] ), 'ai2kit' ), Number( files[ 1 ] ) );
	const map: Record< string, string > = {
		'Found package.json but no built index.html': __( 'Found package.json but no built index.html', 'ai2kit' ),
		'Found package.json and src/*.tsx without a dist/ build': __( 'Found package.json and src/*.tsx without a dist/ build', 'ai2kit' ),
		'Found _next/static assets': __( 'Found _next/static assets', 'ai2kit' ),
		'v0 generator hint': __( 'v0 generator hint', 'ai2kit' ),
		'Found <div id="root">': __( 'Found <div id="root">', 'ai2kit' ),
		'Found /assets/index-*.js (Vite build)': __( 'Found /assets/index-*.js (Vite build)', 'ai2kit' ),
		'Lovable markers in index.html': __( 'Lovable markers in index.html', 'ai2kit' ),
		'Bolt/StackBlitz markers': __( 'Bolt/StackBlitz markers', 'ai2kit' ),
		'Tailwind CDN script': __( 'Tailwind CDN script', 'ai2kit' ),
		'Claude artifact hint': __( 'Claude artifact hint', 'ai2kit' ),
		'Gemini Canvas hint': __( 'Gemini Canvas hint', 'ai2kit' ),
		'Plain HTML document': __( 'Plain HTML document', 'ai2kit' ),
		'No HTML entry file found': __( 'No HTML entry file found', 'ai2kit' ),
	};
	return map[ e ] ?? e;
}

/** Interactive pattern names (badges on a section). */
export function patternLabel( p: string ): string {
	const map: Record< string, string > = {
		accordion: __( 'Accordion', 'ai2kit' ),
		tabs: __( 'Tabs', 'ai2kit' ),
		carousel: __( 'Carousel', 'ai2kit' ),
		dialog: __( 'Popup', 'ai2kit' ),
		counter: __( 'Counter', 'ai2kit' ),
		repeat: __( 'Repeated cards', 'ai2kit' ),
	};
	return map[ p ] ?? p;
}
