/**
 * Intermediate Representation (PRD §6.3, FR-12).
 *
 * The IR is independent of any Elementor version so the v3 and v4 emitters
 * (and future builders) share one pipeline.
 */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

/** Computed-style subset, keyed by CSS property name (kebab-case). */
export type StyleMap = Record< string, string >;

export type Box = { top: number; right: number; bottom: number; left: number };

export type Rect = { x: number; y: number; w: number; h: number };

export type NodeKind =
	| 'section'
	| 'container'
	| 'text'
	| 'heading'
	| 'image'
	| 'button'
	| 'icon'
	| 'list'
	| 'video'
	| 'form'
	| 'embed'
	| 'divider'
	| 'spacer'
	| 'unknown';

export type Semantic =
	| 'header'
	| 'nav'
	| 'hero'
	| 'features'
	| 'pricing'
	| 'testimonials'
	| 'faq'
	| 'cta'
	| 'footer'
	| 'gallery'
	| 'stats'
	| 'team'
	| 'logos'
	| 'blog';

export type PatternType = 'accordion' | 'tabs' | 'carousel' | 'dialog' | 'counter' | 'repeat';

export type Pattern = {
	type: PatternType;
	confidence: number;
	meta: Record< string, unknown >;
};

export type Layout = {
	display: 'flex' | 'grid' | 'block';
	direction?: 'row' | 'column';
	wrap?: boolean;
	gap?: { row: number; column: number };
	justify?: string;
	align?: string;
	gridCols?: number;
	gridRows?: number;
};

export type NodeStyles = {
	desktop: StyleMap;
	tablet?: Partial< StyleMap >;
	mobile?: Partial< StyleMap >;
	hover?: Partial< StyleMap >;
};

export type NodeContent = {
	text?: string;
	html?: string;
	href?: string;
	target?: string;
	src?: string;
	alt?: string;
	tag?: string;
	iconName?: string;
	iconPos?: 'before' | 'after';
	svg?: string;
	items?: Array< { text: string; href?: string; iconName?: string; svg?: string } >;
	/** Icon list metrics: icon size and icon-to-text gap (px). */
	iconSize?: number;
	iconGap?: number;
	videoType?: 'youtube' | 'vimeo' | 'hosted';
};

export type Fallback = { reason: string; html: string; css: string };

export type IRNode = {
	id: string;
	/** Capture key of the source element (data-a2k-key), used to freeze HTML on demand. */
	key?: string;
	/** Source tag name, kept for semantic hints and the report. */
	tag?: string;
	kind: NodeKind;
	semantic?: Semantic;
	label?: string;
	pattern?: Pattern;
	layout?: Layout;
	styles: NodeStyles;
	content?: NodeContent;
	/** Position/size of the node at desktop width, for scoring and the compare overlay. */
	rect?: Rect;
	/** Measured size at the smaller breakpoints (sizes driven by aspect-ratio, vw, etc.). */
	rects?: { tablet?: Rect; mobile?: Rect };
	tokens?: { color?: string; font?: string };
	fallback?: Fallback;
	/** Source element id, kept as the Elementor CSS ID so in-page anchors keep working. */
	anchor?: string;
	/** Max width (px) of a collapsed centering wrapper → Elementor boxed width. */
	innerMaxWidth?: number;
	/** Parent-relative width in %, when the node is a flex/grid child with a fixed share. */
	widthPct?: number;
	children: IRNode[];
};

/* ------------------------------------------------------------------ */
/* Capture output (DOM snapshot). Produced by capture/, consumed by    */
/* normalize/. Kept separate from the IR so capture stays dumb.        */
/* ------------------------------------------------------------------ */

export type CapturedNode = {
	/** Stable key stamped on the element so breakpoints can be aligned. */
	key: string;
	tag: string;
	attrs: Record< string, string >;
	/** For inline-content leaves: text content and sanitized inner HTML. */
	text?: string;
	html?: string;
	/** Frozen, self-contained HTML (inlined styles) for fallback use. */
	frozen?: string;
	svg?: string;
	rect: Rect;
	rects?: { tablet?: Rect; mobile?: Rect };
	styles: NodeStyles;
	pseudo?: { before?: string; after?: string };
	children: CapturedNode[];
};

export type CaptureMeta = {
	title: string;
	lang: string;
	viewport: Record< Breakpoint, number >;
	/** :root custom properties (shadcn tokens etc.). */
	rootVars: Record< string, string >;
	/** Font families referenced by <link> / @font-face. */
	fontFamilies: string[];
	/** Absolute base URL of the captured document. */
	baseUrl: string;
};

export type Capture = { meta: CaptureMeta; root: CapturedNode };

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

export type ColorToken = {
	/** Elementor global id: primary | secondary | text | accent | a2k-xxxx. */
	id: string;
	title: string;
	hex: string;
	system: boolean;
	usage: number;
};

export type FontToken = {
	id: string;
	title: string;
	family: string;
	weight?: string;
	size?: number;
	sizeTablet?: number;
	sizeMobile?: number;
	/** Line height in em, per breakpoint when it differs (px line-heights keep their size while the font scales). */
	lineHeight?: number;
	lineHeightTablet?: number;
	lineHeightMobile?: number;
	/** Letter spacing in px (global fonts replace all typography, so it must travel with the token). */
	letterSpacing?: number;
	textTransform?: string;
	system: boolean;
};

export type TokenTable = { colors: ColorToken[]; fonts: FontToken[]; source: 'shadcn' | 'clustered' };

/* ------------------------------------------------------------------ */
/* Pipeline output                                                     */
/* ------------------------------------------------------------------ */

export type SectionScore = {
	score: number;
	structure: number;
	styles: number;
	fallbackRatio: number;
};

export type SectionReport = {
	id: string;
	label: string;
	semantic?: Semantic;
	rect?: Rect;
	score: SectionScore;
	summary: string;
	widgets: Record< string, number >;
	patterns: PatternType[];
	warnings: string[];
	mode: 'native' | 'html';
	/** Pro-only pattern mappings that were detected but left native-flattened. */
	proHints: string[];
};
