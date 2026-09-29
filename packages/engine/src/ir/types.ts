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

/** Accordion item as recognized (pattern meta), with the panel read at capture. */
export type AccordionItem = {
	title: string;
	/** Trigger (question) and item wrapper styles. */
	trigger: NodeStyles;
	item: NodeStyles;
	iconName?: string;
	svg?: string;
	/** Rendered icon size (px). */
	iconSize?: number;
	/** The icon sits before the title text. */
	iconStart?: boolean;
	/** Height a closed item has below its trigger, inside its border (px). */
	extraBottom?: number;
	panel?: PanelCapture;
};

export type AccordionMeta = {
	titles: string[];
	items: AccordionItem[];
	multiple: boolean;
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
	/** Residual rules for classes used inside `html`. */
	inlineRules?: ResidualRule[];
	videoType?: 'youtube' | 'vimeo' | 'hosted';
};

/** A color or gradient painted over the node's background image. */
export type BgOverlay = { color?: string; gradient?: string; opacity: number };

export type Fallback ={ reason: string; html: string; css: string };

/**
 * Residual CSS (PRD G6): declarations no Elementor control can express.
 * Structured, never raw CSS — the server validates each declaration and
 * scopes the rule to the document (`.elementor-{post-id} .{className}{target}`).
 */
export type ResidualRule = {
	className: string;
	/** Descendant selector appended after the class, from a fixed allowlist. */
	target?: '' | ' .elementor-heading-title' | ' .elementor-widget-container' | ' .elementor-button' | ' .elementor-button-icon svg' | ' img';
	breakpoint: 'desktop' | 'tablet' | 'mobile';
	/** Pseudo-state the rule applies in (`:hover`). */
	state?: 'hover';
	decls: Record< string, string >;
	/** Section label, for the report and the CSS comment. */
	label?: string;
};

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
	/** ::before / ::after content, which native widgets can't express (reported, and kept in residual CSS). */
	pseudo?: { before?: string; after?: string };
	/** ::before / ::after paint layers (from capture), consumed by background lifting. */
	pseudoLayers?: { before?: StyleMap; after?: StyleMap };
	/**
	 * Background overlay lifted from a covering layer (a darkening gradient over
	 * a hero image) → Elementor's Background Overlay (v3) / a background layer (v4).
	 */
	bgOverlay?: BgOverlay;
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

/** An accordion panel read by opening its trigger (closed panels aren't in the DOM). */
export type PanelCapture = {
	html: string;
	text: string;
	/** Computed styles of the panel box, and of its text. */
	styles: StyleMap;
	textStyles: StyleMap;
	/** Open in the source on load. */
	open: boolean;
	/** Several items can be open at once (observed while capturing). */
	multiple?: boolean;
	/** Rotation (deg) of the trigger's icon while open (shadcn turns the chevron 180°). */
	iconRotate?: number;
	/** A native <summary> showing the browser's disclosure triangle (▸ / ▾). */
	marker?: boolean;
	/** A ::before/::after character icon, closed and open ("+" → "−"). */
	glyph?: { closed: string; open: string; position: 'start' | 'end'; size?: number };
};

export type CapturedNode = {
	/** Stable key stamped on the element so breakpoints can be aligned. */
	key: string;
	tag: string;
	attrs: Record< string, string >;
	/** For inline-content leaves: text content and sanitized inner HTML. */
	text?: string;
	html?: string;
	/** Rules for classes used inside `html` (gradient text spans). */
	inlineRules?: ResidualRule[];
	/** Frozen, self-contained HTML (inlined styles) for fallback use. */
	frozen?: string;
	svg?: string;
	rect: Rect;
	rects?: { tablet?: Rect; mobile?: Rect };
	styles: NodeStyles;
	pseudo?: { before?: string; after?: string };
	/** On accordion triggers: the panel this trigger opens. */
	panel?: PanelCapture;
	/** ::before / ::after used as absolutely positioned paint layers (overlays). */
	pseudoLayers?: { before?: StyleMap; after?: StyleMap };
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
