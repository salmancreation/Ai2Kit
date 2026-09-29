# PRD — Ai2Kit
**AI-built site → Elementor WordPress site converter**
by ModinaTheme · Owner: Salman Ahmed Himel · Status: Draft v1.0 · Date: 2026-09-28

> Name: **Ai2Kit** (WordPress.org slug `ai2kit` confirmed free). Fits the ModinaTheme *Kit* family (LoopKit, SwatchKit, FitKit, EqualKit, DonorKit). Still to do before launch: register the domain and run a trademark search.

---

## 0. How to use this document with Claude Code

This PRD is the source of truth. `DESIGN.md` holds all UI tokens and patterns.

1. Put `PRD.md` and `DESIGN.md` in the repo root.
2. Create a `CLAUDE.md` that points to both. It should contain the coding rules in §11 and the commands in §13.
3. Build milestone by milestone (§15). Each milestone has acceptance criteria. Ask Claude Code to write the tests first, then the implementation. Then run the full test and lint suite before moving on.
4. Never let Claude Code guess the Elementor JSON format. Generate **reference fixtures** by building the target layout in real Elementor, exporting it, and committing the export under `/tests/fixtures/elementor/`. The mapper must produce output that deep-equals (or schema-validates against) these fixtures.

---

## 1. Summary

Ai2Kit is a WordPress plugin. It turns websites made with AI builders into native, editable Elementor sites **inside wp-admin**. Supported sources are Lovable, Bolt, v0, Gemini Canvas, Claude/ChatGPT HTML, and HTML template ZIPs.

It outputs a **site**, not just a page:
- Pages built from native Elementor containers and widgets
- Global colors and fonts
- Header and footer templates
- Real WordPress menus
- Media Library images
- Optionally, custom post types with loop templates and demo content

**Core technical bet: local-first conversion.** The upload is rendered in a sandboxed iframe inside wp-admin. The engine reads computed styles at three breakpoints and generates Elementor JSON in the browser. This has four consequences:
- There is no server cost, so the free version can be generous.
- User code never leaves the site, which is a privacy selling point.
- React apps (Lovable/Bolt/v0 production builds) actually **run and render** before capture. That solves the "empty SPA shell" problem that breaks HTML converters.
- It works on Elementor Free.

---

## 2. Problem

Freelancers and agencies now design and build sites in hours with AI builders. Clients, however, still want WordPress + Elementor so they can edit content themselves, use plugins they know, and host anywhere.

Today there are three ways to get there, and all of them are bad:

| Current path | Pain |
|---|---|
| Manual rebuild in Elementor | 4–8 h per page, 15–30 h per 5–10 page site |
| HTML widget paste | Frozen block the client can't edit, not responsive-aware |
| Existing converters | Single page at a time; React SPAs export an empty shell; interactives dropped; server upload and data retention; some need Elementor Pro; no header/footer/menus/globals/dynamic content |

---

## 3. Market research

### 3.1 Competitors (state as of Sept 2026)

| Product | Type | Input | Price | Strengths | Weaknesses (our opening) |
|---|---|---|---|---|---|
| **AI to Elementor** (aitoelementor.com, wp.org `aitoel-html-importer`) | WP plugin + cloud engine | HTML file | $47–297/yr; one free conversion per site | Native widgets, animations/hover kept, works on Free | Conversion runs on **their server** and keeps copies up to 90 days (quality sampling). HTML-only, so the user must produce clean markup. Page → template only. Blank page if Flexbox Containers is off. |
| **Web2Elementor** | Web app | URL / screenshot / HTML | Free 1 use per 2 months; subscription or credits | 3 input modes, online visual editor | Leaves WordPress (copy JSON → import); page-level only; stingy free tier |
| **CloneWebX** | Chrome extension | Live page | Subscription | Fast visual clone | Requires **Elementor Pro**; per its own docs it drops JS, animations, carousels and e-commerce |
| **HTML To Elementor** (Chrome Web Store) | Chrome extension | Selected page elements | — | Claims Elementor V4 atomic support | Element-level copy; Free Elementor needs an extra animation plugin |
| **wpconverters.com** | Free web tool | Pasted HTML | Free | Paste-ready JSON | Unmappable CSS becomes class names plus a manual note, because Elementor Free has no custom-CSS field |
| **Novamira** | Claude Code + MCP | Dev workflow | €49/yr | Developer-flexible | Technical setup; not for designers or clients |
| **Elementor AI / Angie** (native) | Elementor's own AI | Prompts | Elementor subscription | First-party | Generates new designs; doesn't convert *your existing* Lovable site. This is platform risk, see §17. |
| **DivMagic / Element Armory** | Chrome extensions | Components | ~$9/mo | Component extraction | Output is React/Tailwind/HTML, not Elementor |

### 3.2 Elementor platform shift (critical)
- **Elementor 4.0 (Atomic Editor)** became the official release in March 2026. New installs have run v4 by default since April 2026. v3 widgets and v4 Atomic Elements coexist on the same page.
- v4 is **CSS-first**: it uses Classes, Variables, and Components, and stores per-breakpoint and per-state styles.
- Some widgets, such as accordion, gallery and carousel, are still not atomic, so v3 widgets remain necessary.
- **Implication:** we must emit **both** formats (§8). v4 Classes and Variables are a natural target for Tailwind/shadcn design tokens. Emitting a full, clean v4 design system from an AI site is a differentiator that almost nobody does well yet.

### 3.3 Market demand signals
- Elementor runs on millions of WordPress sites. AI builders (Lovable, Bolt, v0) have millions of users, and many of their outputs are marketing sites that belong on a CMS.
- Paid converters appeared in 2025–2026 and ship frequent updates. That shows people will pay, but no one has won yet.
- There is a steady stream of YouTube tutorials and blog posts titled "Lovable to WordPress / Elementor" (search demand).
- Elementor Facebook groups, r/elementor, r/Wordpress and the Lovable Discord regularly ask "how do I move this to WordPress?"
- **Validate before heavy build (§16.1):**
  - A waitlist target of 300 signups in 3 weeks.
  - 30 beta users.
  - At least 10 "would pay" confirmations.

### 3.4 Gaps → our solutions

| # | Gap in the market | Ai2Kit solution |
|---|---|---|
| G1 | React/Vite SPA exports are an empty `<div id="root">`; converters need hand-made HTML | Run the production build in a sandboxed iframe, wait for render, capture the live DOM. Navigate routes with `history.pushState`. |
| G2 | Code uploaded to third-party servers and retained | **Local-first.** No remote calls in Free. Pro cloud build is opt-in, deletes data after 24 h, and is disclosed. |
| G3 | Page-only output | Site package: pages, header/footer, menus, global kit, media, front-page setting |
| G4 | Interactives dropped (tabs, accordions, carousels, dialogs, counters) | Detect Radix/shadcn/Embla/Swiper patterns from DOM attributes and map them to native Elementor widgets |
| G5 | Needs Elementor Pro | Everything core works on Free. Pro-only features (Theme Builder, Loop Grid, Form) have free fallbacks shipped by Ai2Kit. |
| G6 | Unmappable CSS lost on Elementor Free | Store residual CSS per template in post meta and enqueue it scoped to that template. The user sees it listed in the report. |
| G7 | Hard-coded values everywhere | Extract design tokens into Elementor Global Colors/Fonts (v3) and Variables/Classes (v4) |
| G8 | Opaque quality | Fidelity report: per-section score, a side-by-side compare, and per-section choice of *Native* vs *HTML fallback* |
| G9 | No dynamic content | Detect repeated card patterns and offer a CPT with loop template and demo posts (Pro) |
| G10 | Silent failures (blank page when Flexbox Containers is off) | Preflight checks with one-click fixes |
| G11 | Stingy free tiers | Unlimited local single-page conversions in Free |
| G12 | Can't convert a live URL without a Chrome extension | Pro Chrome companion captures any tab (e.g. Lovable preview) and sends it to the site via an Application Password |

---

## 4. Users & jobs to be done

| Persona | Description | Job to be done |
|---|---|---|
| **P1 Freelance "AI builder"** (primary; the owner is one) | Builds in Lovable or Bolt; clients want WordPress | "Deliver the Lovable design as an editable Elementor site the same day." |
| **P2 Small agency** (primary buyer for Pro) | 3–20 people, recurring client sites | "Turn AI prototypes into client WordPress sites repeatedly, with consistent quality." |
| **P3 Template seller** | Sells HTML templates, wants Elementor kits | "Convert my HTML template ZIP into an Elementor kit I can sell on ThemeForest or my own store." |
| **P4 DIY site owner** | Made a site with Gemini Canvas or ChatGPT | "Get this onto my WordPress site without learning code." |

---

## 5. Scope

### 5.1 In scope — Free (WordPress.org)
- **Inputs:**
  - Single `.html` file
  - Pasted HTML
  - HTML template ZIP (multi-file, with assets)
  - **Built** SPA ZIP (Vite `dist/`, Next static `out/`) with a single route
- Iframe render and capture at 3 breakpoints
- Conversion to Elementor v3 containers and core free widgets, **and/or** v4 atomic elements (auto-detected, user can switch)
- Hover states (colors, background, border, shadow, lift/scale, transition duration) → widget hover controls / v4 hover style state (FR-22)
- Accordions / FAQ → Elementor's native (nested) Accordion, with collapsed answers opened and captured during conversion (decided 2026-09-29: moved from Pro to Free)
- Global colors and fonts extraction into the Elementor Kit
- Images imported to the Media Library (deduped by hash)
- Output: a saved Elementor template, **or** a new draft page
- Fidelity report with per-section Native / HTML-fallback toggle
- Residual scoped CSS for unmappable styles
- Preflight checks with one-click fixes (Flexbox Containers, SVG upload, memory limits)
- Export the result as Elementor template JSON

### 5.2 In scope — Pro (Freemius add-on plugin `ai2kit-pro`)
- **Multi-page / multi-route** conversion in one job: route discovery and bulk import
- **Site assembly:**
  - Header/footer detection → Theme Builder templates with conditions (if Elementor Pro), else Ai2Kit's own header/footer renderer
  - WordPress menus from nav links
  - Front page and blog page settings
- **Interactive mapping:** tabs, carousel/slider, counters, testimonials, pricing toggles, dialogs/popups (Popup via Elementor Pro, else a Ai2Kit modal widget)
- **Forms:** Elementor Form (Pro) or Ai2Kit Form widget with email + spam protection; optional Fluent Forms / CF7 mapping
- **Dynamic content:** repeated patterns → CPT + fields + Loop Grid (Pro) / Ai2Kit Loop widget, and demo posts
- **Animations:** Framer Motion / CSS entrance effects → Elementor Motion Effects / v4 Interactions
- **v4 design system output:** Global Classes for repeated styles; Variables for tokens
- **Kit export:** a ZIP in Elementor Kit import format (site settings + templates + content), so the same conversion can be reused on other sites
- **Cloud build service** (opt-in): upload a *source* ZIP or connect a GitHub repo (Lovable GitHub sync) → sandboxed `npm ci && npm run build` → build ZIP returned to the plugin
- **Chrome companion extension:** capture any open tab (e.g. a Lovable preview URL) and send the snapshot to a connected WordPress site
- **AI assist** (optional, BYO Anthropic API key or credits): section labeling, widget-choice tie-breaking, CPT field naming, alt-text generation
- Priority support

### 5.3 Out of scope (v1)
- Gutenberg / Bricks / Divi output (possible later expansion)
- Backend logic conversion: Supabase auth, dashboards, app features. We convert **presentational marketing sites**. App-like pages are flagged as "not suitable."
- WooCommerce product/store conversion (v2 candidate)
- Screenshot/image-to-Elementor

---

## 6. Functional requirements

### 6.1 Input & ingestion
- **FR-1:** Upload accepts `.html`, `.htm`, `.zip` (max 50 MB by default, filterable) and pasted HTML.
- **FR-2:** ZIP safety:
  - Reject path traversal (zip-slip), symlinks, and `.php` / `.phtml` / `.phar` / `.htaccess` files
  - Enforce a file-count cap (5,000) and an uncompressed-size cap (200 MB)
  - Extract to `wp-content/uploads/ai2kit/jobs/{random-uuid}/` with an `index.php` guard and a `.htaccess` deny for PHP
- **FR-3:** Source detection. The detector reports source type + confidence and shows it in the UI.

  | Signal | Detected source |
  |---|---|
  | `index.html` + `/assets/*.js` + `<div id="root">` | Vite SPA (Lovable, Bolt) |
  | `_next/` or `out/` | Next static export (v0) |
  | Single self-contained HTML with inline `<script>` / Tailwind CDN | Gemini Canvas / ChatGPT / Claude artifact |
  | `package.json` present without build output | **Source ZIP** → Free shows how to build locally (`npm run build -- --base=./`); Pro offers the cloud build |

- **FR-4:** Absolute asset path fix. Vite builds default to `base: '/'`, so `/assets/...` 404s from a sub-folder. The plugin rewrites `"/assets/` and `src="/` references in HTML/CSS/JS to the job's URL. It also warns and recommends `--base=./` for future builds.
- **FR-5:** Jobs are removed after completion or after 24 h (cron), whichever comes first. The user can keep the source for re-runs.

### 6.2 Render & capture (browser engine)
- **FR-6:** Load the job's `index.html` in a same-origin sandboxed iframe inside the Ai2Kit admin screen.
- **FR-7:** Wait for render stability before capturing:
  - Network idle
  - A DOM mutation-quiet window (500 ms)
  - Fonts loaded (`document.fonts.ready`)
  - A max timeout of 15 s
- **FR-8:** Force the final animation state before capturing:
  - Inject `prefers-reduced-motion` emulation where possible
  - Scroll the page top-to-bottom to trigger `whileInView` / IntersectionObserver
  - Wait, then capture
  - Record detected animations separately (FR-22)
- **FR-9:** Capture at 3 widths: desktop 1440, tablet 1024, mobile 390. Elementor's default breakpoints are mobile ≤767 and tablet ≤1024; if the site has custom breakpoints, read them from the Kit and use those.
- **FR-10:** For each visible node, record:
  - Tag, attributes, text
  - Bounding box
  - A computed style subset (the list lives in `engine/capture/styleProps.ts`)
  - Pseudo-element content (`::before` / `::after`)
  - Per-breakpoint diffs only
- **FR-11:** Routes:
  - Discover internal links (`a[href^="/"]`, react-router `Link`s) from the rendered DOM
  - Navigate each route in-app via `history.pushState` + a `popstate` dispatch, then re-capture
  - The user picks which routes become pages (Pro: multi; Free: current route only)

### 6.3 Intermediate Representation (IR)
- **FR-12:** Capture produces a normalized JSON IR (`schemas/ir.schema.json`). It is independent of Elementor version, which lets v3 and v4 emitters and future builders (Bricks, Gutenberg) share one pipeline.

```ts
type IRNode = {
  id: string;
  kind: 'section'|'container'|'text'|'heading'|'image'|'button'|'icon'|'list'|'video'|'form'|'embed'|'divider'|'spacer'|'unknown';
  semantic?: 'header'|'nav'|'hero'|'features'|'pricing'|'testimonials'|'faq'|'cta'|'footer'|'gallery'|'stats'|'team'|'logos'|'blog';
  pattern?: { type: 'accordion'|'tabs'|'carousel'|'dialog'|'counter'|'repeat'; confidence: number; meta: Record<string, unknown> };
  layout?: { display: 'flex'|'grid'|'block'; direction?: 'row'|'column'; wrap?: boolean; gap?: Box; justify?: string; align?: string; gridCols?: string };
  styles: { desktop: StyleMap; tablet?: Partial<StyleMap>; mobile?: Partial<StyleMap>; hover?: Partial<StyleMap> };
  content?: { text?: string; html?: string; href?: string; src?: string; alt?: string; tag?: string; iconName?: string; svg?: string };
  tokens?: { color?: string; font?: string };      // references into the token table
  fallback?: { reason: string; html: string; css: string }; // when not natively mappable
  children: IRNode[];
};
```

### 6.4 Normalization & recognition
- **FR-13:** **Wrapper collapsing.** Remove nodes that have no visual styles, a single child and no semantic role, and merge them into their parent/child.
- **FR-14:** **Layout mapping:**
  - `display:flex` → a flex container (direction, wrap, gap, justify, align)
  - `display:grid` → a grid container (v3 `container_type: grid`, v4 flexbox/div-block with grid styles)
  - `block` flow → a column flex container
  - Absolute positioning → Elementor custom positioning (if simple) else HTML fallback
- **FR-15:** **Leaf mapping rules**, deterministic and in priority order:

  | DOM element | Elementor widget |
  |---|---|
  | `h1–h6` or large bold single-line text | Heading |
  | `p` / rich inline text | Text Editor (v4 Paragraph) |
  | `img` / CSS background image on a leaf | Image (background images stay on containers) |
  | `a` / `button` with padding + background or border | Button; otherwise a link inside text |
  | `svg.lucide-*` | Icon — map the Lucide name → Font Awesome via `data/lucide-fa-map.json`; unmapped icons are uploaded as SVG |
  | `ul` / `ol` whose items contain icons | Icon List |
  | `video`, YouTube / Vimeo iframes | Video |
  | `hr` | Divider |
  | Empty sized box | Spacer |

- **FR-16:** **Lovable/shadcn pattern detection.** Lovable projects are Vite + React + TypeScript + Tailwind + shadcn/ui (Radix primitives) + lucide-react + Embla carousel. Radix leaves stable ARIA/`data-state` attributes:

  | DOM signal | Maps to |
  |---|---|
  | `[data-orientation][data-state]` inside `[data-radix-collection-item]`, `button[aria-expanded]` + `[role=region]` | **Accordion** / Toggle |
  | `[role=tablist]` + `[role=tab]` + `[role=tabpanel]` | **Tabs** |
  | `[aria-roledescription=carousel]`, `.embla`, `.swiper` | **Carousel** (Image Carousel / Testimonial carousel / v4 fallback) |
  | `[role=dialog]` (usually closed, so detect the trigger) | **Popup/Modal** (Pro) |
  | Numbers animating from 0 (captured via a mutation observer) | **Counter** |

- **FR-17:** **Repeat detection.** At least 3 siblings with the same structural signature (tag tree + class skeleton, ≥80% similarity) become `pattern:repeat`. They are used for card grids, the CPT offer (Pro), and v4 Classes.
- **FR-18:** **Semantic labeling.** A heuristic classifier uses position, landmarks (`header`, `nav`, `footer`, `section[id]`) and keywords. The optional AI pass (Pro) refines low-confidence labels. AI never generates layout; it only labels. That keeps output deterministic and testable.

### 6.5 Design tokens
- **FR-19:** Color extraction, in order of priority:
  1. shadcn CSS variables on `:root` (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, `--card`), written as HSL triplets. These map 1:1 to named Global Colors.
  2. Otherwise, cluster all used colors (ΔE < 3) and rank by usage × area. The top 8 become globals (Primary, Secondary, Text, Accent + custom).
- **FR-20:** Typography extraction:
  - Families come from Google Fonts `<link>` tags, `@font-face` rules and computed `font-family`
  - Type-scale clustering maps to Global Fonts (Primary, Secondary, Text, Accent + custom H1–H6, Body, Small)
  - Self-hosted fonts are uploaded, and a custom font is registered via Elementor Custom Fonts (Pro) or a Ai2Kit `@font-face` enqueue (Free)
- **FR-21:** Every widget colour/font that matches a token is written as a **global reference**, not a hex value:
  - v3: `__globals__: { title_color: "globals/colors?id=primary" }`
  - v4: a Variable reference

### 6.6 Animations
- **FR-22:** Detect entrance animations from:
  - Framer Motion initial styles (opacity 0 / translate) captured pre-scroll vs post-scroll
  - Tailwind `animate-*` classes
  - CSS `@keyframes` on elements

  Map them to the nearest Elementor entrance animation (`fadeIn`, `fadeInUp`, `fadeInLeft`, `zoomIn`…) or v4 Interactions. Keep duration and delay where available. Hover transitions map to widget hover controls.

### 6.7 Emit & save (PHP side)
- **FR-23:** The browser sends IR + emitted Elementor JSON to the REST endpoint. PHP **re-validates** everything; the browser output is never trusted:
  - Schema-validate
  - Sanitize text (`wp_kses_post` for rich text, `sanitize_text_field` for plain)
  - `esc_url_raw` for links
  - Strip any `<script>` from the HTML fallback unless the user has `unfiltered_html`
- **FR-24:** Save through Elementor's document API, not raw post meta. This keeps CSS generation, revisions and caches correct:

```php
$document = \Elementor\Plugin::$instance->documents->create( 'page', [ 'post_title' => $title, 'post_status' => 'draft' ] );
$document->save( [ 'elements' => $elements, 'settings' => $page_settings ] );
```

  Templates use the `elementor_library` post type with `_elementor_template_type` (e.g. `page`, `section`, `header`, `footer`).
- **FR-25:** Kit update. Get the active kit with `\Elementor\Plugin::$instance->kits_manager->get_active_kit()` and merge `custom_colors` / `custom_typography`, or system ones if the user opts to overwrite. Always back up the previous kit settings to an option so the change can be undone.
- **FR-26:** Media:
  - Local job files go through `wp_insert_attachment` + `wp_generate_attachment_metadata`
  - Remote URLs go through `media_sideload_image`
  - Dedupe by SHA-1 stored in `_ai2kit_hash` meta
  - Write attachment `id` + `url` into widget settings
- **FR-27:** Menus: `wp_create_nav_menu` + `wp_update_nav_menu_item` from header/footer nav links, mapping internal routes to the created pages.
- **FR-28:** An undo/rollback per job deletes created pages, templates and media and restores the kit. Everything is tracked in a `{prefix}ai2kit_jobs` custom table.

### 6.8 Fidelity report & review UI
- **FR-29:** Per-section score (0–100):
  - Structural match: node count, widget coverage
  - Style coverage: percentage of captured properties mapped
  - Fallback ratio
  - Pro: a visual diff (pixelmatch) between the source iframe screenshot and the rendered Elementor preview
- **FR-30:** Review screen: a list of sections, each with a thumbnail, semantic label, score badge, the Native/HTML toggle, detected patterns, and warnings. Plus a global side-by-side compare.
- **FR-31:** The import summary lists what was created, with "Edit with Elementor" links, known limitations and next steps.

### 6.9 Preflight
- **FR-32:** Checks, each with a status and a one-click fix where safe:

  | Check | Condition | Fix / note |
  |---|---|---|
  | Elementor version | ≥ 3.25 | — |
  | Flexbox Container experiment | Active (**auto-fix**) | Enable it |
  | Atomic editor | On/off | Choose v3 or v4 output |
  | SVG uploads | — | Needed for custom icons (safe-SVG sanitization) |
  | PHP | `memory_limit` ≥ 256M, `max_execution_time`, `upload_max_filesize` | — |
  | Elementor Pro | Present? | Enables Theme Builder / Loop / Form / Popup mapping |

---

## 7. Non-functional requirements
- **Performance:**
  - Convert a 10-section page in < 20 s on a mid-range laptop
  - The engine runs in a Web Worker where possible (IR normalization and emit); capture stays on the main thread because it needs DOM access
  - Batch REST calls
- **Front-end output performance:**
  - No Ai2Kit runtime assets load on converted pages, except the scoped residual CSS file per template
  - Free widgets (modal/form/loop) load only where used
- **Compatibility:**
  - WordPress 6.5+, PHP 7.4+ (8.0–8.4 tested)
  - Elementor 3.25 → latest 4.x
  - Hello Elementor, Astra, GeneratePress, Kadence
  - Multisite-aware (per-site jobs)
- **Security:** see §10.
- **Accessibility (plugin UI):** WCAG 2.2 AA; full keyboard operation; respects `prefers-reduced-motion`.
- **i18n:** every string translatable (`ai2kit` text domain); RTL-safe admin UI; Bangla translation at launch.
- **Privacy:**
  - Free makes **zero** external requests
  - Pro's cloud and AI features are opt-in and disclosed in the readme and the UI
  - Telemetry is opt-in only (via Freemius opt-in)

---

## 8. Elementor output formats

> Rule: formats evolve. Every emitter is backed by fixtures exported from a real Elementor install (§12.3). The CI matrix runs against Elementor 3.25 LTS, the latest 3.x, and the latest 4.x.

### 8.1 v3 (containers + widgets) — template JSON
```json
{
  "version": "0.4",
  "title": "Home — converted",
  "type": "page",
  "page_settings": { "template": "elementor_canvas" },
  "content": [{
    "id": "3f9a1c2",
    "elType": "container",
    "isInner": false,
    "settings": {
      "content_width": "boxed",
      "flex_direction": "column",
      "flex_gap": { "unit": "px", "size": 24, "column": "24", "row": "24" },
      "padding": { "unit": "px", "top": "96", "right": "24", "bottom": "96", "left": "24", "isLinked": false },
      "padding_mobile": { "unit": "px", "top": "56", "right": "16", "bottom": "56", "left": "16", "isLinked": false },
      "__globals__": { "background_color": "globals/colors?id=secondary" }
    },
    "elements": [{
      "id": "8b21e0d",
      "elType": "widget",
      "widgetType": "heading",
      "settings": {
        "title": "Build faster with AI",
        "header_size": "h1",
        "typography_typography": "custom",
        "typography_font_size": { "unit": "px", "size": 56, "sizes": [] },
        "typography_font_size_mobile": { "unit": "px", "size": 36, "sizes": [] },
        "__globals__": { "title_color": "globals/colors?id=primary", "typography_typography": "globals/typography?id=primary" }
      },
      "elements": []
    }]
  }]
}
```
Key conventions:
- IDs are 7-char lowercase hex, unique per document.
- Responsive values use the `_tablet` / `_mobile` suffix. Only emit them when they differ from desktop.
- Dimension objects always carry `unit` and `isLinked`.
- Omit a setting instead of writing its default, which keeps JSON small.

### 8.2 v4 (Atomic) — element shape (illustrative; confirm with fixtures)
Atomic elements (`e-flexbox`, `e-div-block`, `e-heading`, `e-paragraph`, `e-button`, `e-image`, `e-svg`, `e-divider`, `e-youtube`, `e-tabs`…) use:
- **typed props** (`{ "$$type": "string", "value": "..." }`)
- **styles** stored as classes with **variants** per breakpoint and state

```json
{
  "id": "a1b2c3d", "elType": "e-flexbox",
  "settings": { "classes": { "$$type": "classes", "value": ["e-a1b2c3d-s1", "g-section"] } },
  "styles": {
    "e-a1b2c3d-s1": { "id": "e-a1b2c3d-s1", "label": "local", "type": "class",
      "variants": [
        { "meta": { "breakpoint": "desktop", "state": null }, "props": { "padding": { "$$type": "size", "value": { "size": 96, "unit": "px" } } } },
        { "meta": { "breakpoint": "mobile",  "state": null }, "props": { "padding": { "$$type": "size", "value": { "size": 56, "unit": "px" } } } }
      ] } },
  "elements": [
    { "id": "d4e5f6a", "elType": "widget", "widgetType": "e-heading",
      "settings": { "title": { "$$type": "string", "value": "Build faster with AI" }, "tag": { "$$type": "string", "value": "h1" } } }
  ]
}
```

v4 strategy:
- Tokens become **Variables**.
- Styles shared by `pattern:repeat` siblings or identical style maps become **Global Classes**; the rest stay local classes.
- Widgets without an atomic equivalent (accordion, carousel, gallery, form on some versions) use the v3 widget on the same page. Mixing is officially supported.

### 8.3 Emitter selection
- Auto: if the Atomic editor is active → v4 with v3 fallbacks; else → v3.
- The user can override this in settings.

---

## 9. Architecture

```
┌──────────────────────────── wp-admin (browser) ─────────────────────────────┐
│  React admin app (Ai2Kit UI, DESIGN.md)                                   │
│   ├─ Upload / Preflight / Review / Import screens                           │
│   ├─ Sandbox iframe  ← serves job files from /uploads/ai2kit/jobs/{uuid}  │
│   └─ Engine (TypeScript)                                                    │
│        capture/ → normalize/ → recognize/ → tokens/ → ir/ → emit-v3|v4/     │
│        (Web Worker for normalize→emit)                                      │
└───────────────▲──────────────────────────────────────┬──────────────────────┘
                │ REST (nonce, capability checks)       │
┌───────────────┴──────────────── PHP plugin ──────────▼──────────────────────┐
│ Rest\Jobs  Rest\Import  Rest\Preflight  Rest\Media                          │
│ Services: ZipIngest, AssetRewriter, Validator, ElementorWriter, KitWriter,  │
│           MenuWriter, MediaImporter, Rollback, Cleanup(cron)                │
│ Widgets (Free fallbacks): Modal, Form, Loop, HeaderFooter renderer          │
│ Storage: custom table {prefix}ai2kit_jobs, options, post meta             │
└─────────────────────────────────────────────────────────────────────────────┘
        Pro add-on (ai2kit-pro): multi-route, site assembly, CPT, forms,
        animations, kit export, Freemius licensing, cloud + AI clients
                │ (opt-in, HTTPS, signed)
┌───────────────▼────────────── Pro Cloud (Node) ─────────────────────────────┐
│ API (Fastify) → Queue (BullMQ + Redis) → Build workers (Docker, gVisor/     │
│ Firecracker, no network after `npm ci`, CPU/mem/time caps) → R2 storage     │
│ GitHub App for repo import · Headless render (Playwright) for URL capture   │
│ AI service (Claude API) for labeling · Stripe/Paddle via Freemius           │
└─────────────────────────────────────────────────────────────────────────────┘
        Chrome companion (Pro): content script captures DOM+styles → IR →
        POST to the user's site (Application Password), never to our servers
```

### 9.1 Repository layout (monorepo, pnpm workspaces)
```
ai2kit/
  CLAUDE.md  PRD.md  DESIGN.md
  packages/
    engine/            # TS: capture, normalize, recognize, tokens, IR, emit-v3, emit-v4 (framework-free, 100% unit-tested)
    admin-ui/          # React admin app (uses engine), built with @wordpress/scripts
    chrome-ext/        # Pro companion (MV3)
    cloud/             # Pro Node service
  plugin/ai2kit/     # Free WP plugin (PHP) — wp.org build target
    ai2kit.php  readme.txt  uninstall.php
    includes/ (Plugin.php, Rest/, Services/, Widgets/, Admin/)
    build/ (compiled admin-ui)  languages/  assets/
  plugin/ai2kit-pro/ # Pro add-on (PHP + Freemius SDK)
  tests/
    fixtures/source/   # 50+ real AI sites (Lovable/Bolt/v0/Gemini/HTML templates)
    fixtures/elementor/# exported reference JSON (v3 + v4)
    e2e/               # Playwright against wp-env
```

### 9.2 Tech stack
| Area | Choice | Why |
|---|---|---|
| Engine | TypeScript, zero runtime deps, Vitest | Pure functions, easy fixture testing, reusable in the Chrome extension and cloud |
| Admin UI | React 18 via `@wordpress/element`, `@wordpress/api-fetch`, `@wordpress/i18n`; CSS Modules + DESIGN.md tokens; Framer-Motion-free (CSS transitions) | wp.org-friendly and uses WordPress's bundled React |
| Build | `@wordpress/scripts` (webpack) + dependency extraction | Produces `*.asset.php`; the standard wp.org approach |
| PHP | PHP 7.4+, namespaced `ModinaTheme\Ai2Kit`, Composer PSR-4 autoload (vendor committed in the build ZIP), WPCS | Review-friendly |
| Local WP | `@wordpress/env` (Docker) with Elementor installed | Reproducible e2e |
| Tests | Vitest (engine), PHPUnit + WP test suite (PHP), Playwright (e2e + visual diff with pixelmatch) | See §12 |
| Licensing | Freemius (Pro add-on only) | Already in the owner's stack; wp.org-compatible |
| Cloud | Node 20, Fastify, BullMQ, Redis, Docker (gVisor), Playwright, Cloudflare R2, Fly.io/Hetzner | Cheap, scalable workers |
| AI | Claude API (`claude-sonnet-5`) with structured output for labels only | Deterministic layout; AI only tie-breaks |

---

## 10. WordPress.org compliance & security checklist (approval-level)

**Guidelines**
- [ ] GPLv2+ for all code and bundled assets; licenses listed in `readme.txt`.
- [ ] **No trialware:** Free features are fully functional, with nothing locked or time-limited. Pro is a **separate add-on**.
- [ ] Upsells are limited to the plugin's own screens, dismissible, and never on the global dashboard or as persistent nags.
- [ ] **No external requests in Free**, and no remote JS/CSS/fonts. Admin fonts are system fonts or bundled.
- [ ] Serviceware (cloud/AI) exists only in Pro and is disclosed in the readme with a link to the terms/privacy page.
- [ ] No tracking without explicit opt-in.
- [ ] Human-readable code; ship the source (`packages/admin-ui/src`) or a link to the public repo alongside the minified build.
- [ ] No obfuscation.
- [ ] Unique prefix `ai2kit_` / `AI2KIT_` / namespace for all functions, options, hooks, handles and REST routes.
- [ ] `readme.txt` passes the validator: Stable tag, Tested up to, Requires PHP, and a short description of 150 chars or fewer.
- [ ] Run the **Plugin Check (PCP)** plugin with zero errors before every submission.

**Security**
- [ ] Every REST route has a `permission_callback`: `manage_options` for import; ZIP with JS requires `unfiltered_html` (blocked by default on multisite for non-super-admins).
- [ ] Nonces on all admin actions; `check_admin_referer` / REST nonce.
- [ ] Sanitize on input, escape on output (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`).
- [ ] `$wpdb->prepare` for all SQL; `dbDelta` for the custom table.
- [ ] Upload hardening per FR-2. The job folder has deny-PHP rules. Filenames are randomized. Files are deleted by cron.
- [ ] The iframe loads only from the job folder, same origin, and is visible to authorized admins only. A CSP meta tag is injected into the job HTML to block outbound network except same origin (captures shouldn't phone home).
- [ ] SVGs are sanitized (enshrined/svg-sanitize) before entering the Media Library.
- [ ] `uninstall.php` removes options, the table and job files. User content (pages, templates) is kept, with an optional checkbox to remove it.

---

## 11. Coding standards (for CLAUDE.md)
- PHP: WordPress Coding Standards (`phpcs --standard=WordPress`), PHPStan level 6 with the WordPress extension.
- TS: strict mode, ESLint (`@wordpress/eslint-plugin`) + Prettier, no `any` in the engine.
- The engine is pure and deterministic: same input → same output (seeded ID generator per job).
- Each mapper rule is a small function with a unit test and a fixture.
- Commits are conventional (`feat(engine): accordion detection`); keep PRs small, one milestone task per PR.
- Never hand-write Elementor JSON shapes without a fixture reference.

---

## 12. Testing strategy
1. **Engine unit tests (Vitest):** every rule (layout, leaf, tokens, patterns, emitters), with ≥90% line coverage.
2. **Schema tests:** IR and emitted JSON are validated against JSON Schemas derived from fixtures.
3. **Golden-file tests:** 50+ real source sites in `tests/fixtures/source`. The test snapshots IR + emitted JSON, and changes require explicit snapshot approval.

   | Source | Count |
   |---|---|
   | Lovable (GitHub-exported, built) | 15 |
   | Bolt | 8 |
   | v0 static | 8 |
   | Gemini Canvas / Claude / ChatGPT HTML | 10 |
   | ThemeForest-style HTML templates (GPL / owned) | 10 |

4. **Import e2e (Playwright + wp-env):**
   - Upload → review → import → open the front end at 3 widths
   - Screenshot → pixelmatch vs the source render
   - **Target:** median visual similarity ≥ 90% for Free, ≥ 94% with Pro mappings
5. **Matrix CI (GitHub Actions):**
   - PHP 7.4 / 8.1 / 8.3
   - WP latest-1 / latest
   - Elementor 3.25 / latest 3.x / latest 4.x
   - With and without Elementor Pro (Pro only in a private runner)
6. **Static checks:** phpcs, PHPStan, ESLint, `tsc --noEmit`, and Plugin Check CLI (`wp plugin check ai2kit`).
7. **Security tests:** zip-slip, PHP file in ZIP, oversized ZIP, XSS payloads in text/attributes, SVG with script, and a capability test for an editor-role user.
8. **Manual QA script:** a checklist per release, covering Hello Elementor + Astra, RTL admin, and a Bangla locale.

---

## 13. Build & release
```
pnpm i
pnpm --filter engine test
pnpm --filter admin-ui build        # → plugin/ai2kit/build
composer install --no-dev -d plugin/ai2kit
npx wp-env start                     # local WP + Elementor
pnpm e2e
pnpm run release                     # lint, test, PCP, zip → dist/ai2kit-x.y.z.zip
```
- SemVer. Keep the `readme.txt` changelog, update "Tested up to" every WP release, and deploy to SVN via the GitHub Action (`10up/action-wordpress-plugin-deploy`).
- Pro is delivered through Freemius (deploy ZIP → Freemius dashboard); auto-updates come via the Freemius SDK.

---

## 14. Pro plan, pricing & monetization

| Plan | Price | Sites | Includes |
|---|---|---|---|
| **Free** | $0 | ∞ | Single page/template, tokens, media, fidelity report, v3 + v4 output |
| **Pro Personal** | $59/yr | 1 | All Pro conversion features, 20 cloud builds/mo, Chrome companion |
| **Pro Agency** | $149/yr | 25 | Everything in Personal + 150 cloud builds/mo, Kit export, white-label reports, priority support |
| **Lifetime (launch only, capped 300)** | $199 once | 5 | Personal features for 5 sites; funds early development |
| **Cloud credits** | $9 / 50 builds | — | Extra builds and AI labeling |

- **Why agency-heavy:** agencies convert repeatedly, and conversion is done on a staging site before migrating. So Kit export plus the site count is the natural value metric.
- **Freemius** handles VAT, checkout, the affiliate program (30% recurring), and trials (7-day Pro trial, no card).
- **Revenue model target:**
  - Year 1: 1,000 active Free installs by month 3, 10,000 by month 12
  - 2–3% Pro conversion → ~200–300 paying customers
  - At a ~$95 blended ARPU that is roughly $19–28k ARR by end of year 1; improve with the agency mix.

  These are planning estimates, not forecasts; revisit them after beta data.

---

## 15. Roadmap & milestones (Claude Code build order)

| M | Weeks | Deliverable | Acceptance criteria |
|---|---|---|---|
| **M0 Foundations** | 1 | Monorepo, wp-env with Elementor, CLAUDE.md, CI skeleton, **fixture export** of 20 reference layouts (v3 + v4) | CI green; fixtures committed |
| **M1 Engine core** | 2–3 | Capture (3 breakpoints), IR, normalize, layout + leaf mapping, emit-v3 | 10 static HTML fixtures → valid v3 JSON that imports into Elementor without errors |
| **M2 Plugin MVP (Free)** | 4–5 | Upload/ZIP ingest, sandbox iframe, REST import via document API, media import, preflight, basic review UI per DESIGN.md | Upload → editable page in < 60 s; all security tests pass |
| **M3 Lovable/SPA support** | 6 | Vite/Next dist detection, asset rewrite, render-wait, route capture (single route in Free), shadcn tokens → globals | 15 Lovable fixtures ≥ 85% visual similarity |
| **M4 Fidelity & v4** | 7–8 | Fidelity scoring, section toggle, residual scoped CSS, emit-v4 (Variables/Classes) | Median similarity ≥ 90%; v4 output imports and edits cleanly on Elementor 4.x |
| **M5 wp.org submission** | 9 | Readme, screenshots, i18n, PCP clean, docs site | Submitted; approval typically takes 1–4 weeks, so continue working |
| **M6 Pro core** | 10–12 | Multi-route, site assembly (header/footer/menus/front page), interactive mapping, forms, animations | 5-page Lovable site → full site in < 5 min |
| **M7 Pro dynamic + export** | 13–14 | Repeat → CPT + loop + demo posts, Kit export ZIP | Kit imports on a fresh site with one click |
| **M8 Cloud + Chrome** | 15–18 | Build service (GitHub App + ZIP), Chrome companion, AI labeling | Source ZIP → converted site end-to-end; sandbox escape tests pass |
| **M9 Launch** | 19–20 | Freemius, pricing page, affiliate program, launch campaign (§16) | First 50 paying customers |

Later (v2+): WooCommerce product pages, Bricks/Gutenberg emitters, Figma source, template marketplace, and a team workspace (SaaS dashboard).

---

## 16. Go-to-market & digital marketing

### 16.1 Validate (weeks 0–3, in parallel with M0–M1)
- **Landing page:**
  - Hero: "Lovable → Elementor in 60 seconds. Your code never leaves your site."
  - A demo GIF and a waitlist
- **Build in public:** 2–3 posts per week on X, LinkedIn and Facebook, with before/after conversion videos.
- **Communities:**
  - Lovable Discord, r/lovable, r/elementor, r/Wordpress
  - Elementor Community FB groups
  - Bangladeshi WP/freelancer groups (a strong home network)
- **Beta cohort:** 30 users (freelancers + 5 agencies). Collect failing sites; they become fixtures.

### 16.2 Launch
1. **wp.org release (Free):**
   - Optimize the readme for search: "HTML to Elementor", "Lovable to WordPress", "AI website to Elementor", "convert HTML template to Elementor"
   - Include 6 strong screenshots and a demo video
2. **Launch week:**
   - Product Hunt
   - A YouTube tutorial series (one per source: Lovable, Bolt, v0, Gemini Canvas, HTML template)
   - An email to the waitlist with a Lifetime deal (capped)
3. **Partnerships:** Lovable experts/agencies, Elementor YouTubers (affiliate 30%), hosting communities.

### 16.3 Ongoing acquisition engine
- **SEO:**
  - Programmatic pages per source × target ("Bolt to Elementor", "v0 to WordPress", "Gemini Canvas to Elementor")
  - Honest comparison pages vs each competitor
  - A "Lovable to WordPress" pillar guide
- **YouTube:** weekly real client conversions (the owner's own work is the content engine).
- **Free tools as lead magnets:** an HTML → Elementor JSON paste tool (runs the engine in-browser on the website) and a "design tokens from any Lovable site" viewer.
- **In-product:**
  - After a successful Free conversion, show a single, dismissible "Convert the whole site with Pro" card on the Ai2Kit summary screen only
  - Onboarding emails via Freemius (opt-in)
- **Retention:** monthly changelog video; compatibility promise for Elementor v4 updates.

### 16.4 Funnel metrics
| Stage | Metric | Target |
|---|---|---|
| Acquisition | wp.org installs/week | 150 by month 3 |
| Activation | First successful conversion within 24 h of install | ≥ 45% |
| Quality | Median fidelity score | ≥ 90 |
| Conversion | Free → Pro (90 days) | 2–3% |
| Retention | Pro renewal | ≥ 60% |
| Support | wp.org forum resolved | ≥ 90% within 48 h |
| Reviews | wp.org rating | ≥ 4.6 |

---

## 17. Customer support plan
- **Channels:**
  - wp.org forum (Free; required and public; answer within 48 h)
  - Freemius / helpdesk email for Pro (24 h, business days)
  - Docs site with a searchable KB
- **"Report this conversion" button:** opt-in. It packages the IR, the emitted JSON, environment info and a screenshot, with **no** source code unless the user ticks it. Each report becomes a candidate fixture. This is the quality flywheel.
- **Known-limits page:** app logic, backend features, complex absolute layouts, canvas/WebGL, third-party embeds. Honest limits build trust and reduce refund requests.
- **Canned responses:** Flexbox off, asset 404s (`--base=./`), memory limits, fonts not loading, Pro-only widget fallbacks.
- **Refunds:** 14 days, no questions (Freemius).
- **Weekly triage:** tag issues by rule (layout, tokens, pattern, emitter); prioritize by frequency × impact.

---

## 18. Risks & mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Conversion quality below expectations | Churn, bad reviews | Fixture corpus, visual-diff CI, honest fidelity report, HTML fallback per section |
| Elementor format changes (v4 evolving fast) | Broken imports | Fixture-driven emitters, CI matrix, version-gated emitters, quick-release process |
| Elementor or Lovable ship a native export | Market squeeze | Differentiate on local-first, site assembly, multi-source, v4 design system; stay compatible with and complementary to Elementor AI |
| wp.org rejection | Launch delay | PCP clean, strict separation of Free/Pro, no external calls, early pre-review by an experienced reviewer |
| Security incident via uploaded JS | Reputational | Capability gating, CSP, cleanup, no PHP execution, iframe restrictions; cloud builds in gVisor with no network |
| Copyright misuse ("clone any site") | Legal/reputational | No arbitrary-URL cloning in Free; the Chrome companion requires an "I own or have rights to this design" confirmation; terms of use |
| Solo-dev bandwidth | Delays | Claude Code with strict milestones; the engine is shared across all surfaces; defer cloud to M8 |

---

## 19. Open questions
1. Domain for Ai2Kit (ai2kit.com / .io) and a trademark search. The name and wp.org slug are settled.
2. Keep Free output to templates + a single page, or allow multi-page with a limit (e.g. 3 pages)? This affects the upgrade trigger.
3. Ship Ai2Kit's own header/footer renderer, or depend on the planned ModinaTheme Header Footer Builder plugin (a cross-sell)?
4. Cloud hosting region (latency for BD vs US/EU customers) and data residency statement.

---

## 20. Sources (research, Sept 2026)
- AI to Elementor — wp.org listing: https://wordpress.org/plugins/aitoel-html-importer/
- AI to Elementor — competitor comparison: https://aitoelementor.com/best-html-to-elementor-tools/
- AI to Elementor — conversion guide: https://aitoelementor.com/convert-html-to-elementor-complete-guide/
- Web2Elementor: https://web2elementor.com/
- HTML To Elementor (Chrome): https://chromewebstore.google.com/detail/html-to-elementor/bammnammeldigbbkooilpcmigfejfhko
- wpconverters HTML → Elementor JSON: https://wpconverters.com/html-to-elementor
- Booststash — Lovable to Elementor (CloneWebX): https://www.booststash.com/lovable-to-elementor-in-5-minutes/
- Elementor V4 FAQ: https://elementor.com/products/website-builder/v4-faq/
- Get started with Editor V4: https://elementor.com/help/get-started-with-the-elementor-editor-v4/
- Elementor V3 vs V4 stocktake: https://sukimarketing.co.uk/blog/elementor-v4-and-the-atomic-editor/
- Elementor 4.0 beta discussion: https://github.com/orgs/elementor/discussions/35165
- Atomic widget type names seen in the wild (Feather changelog): https://github.com/bloodyhill/Feather
