# DESIGN.md — Ai2Kit Design System
Version 1.0 · Pairs with the product spec (PRD, kept privately) · Scope: the plugin's wp-admin app, the docs/marketing site, and the Chrome companion popup.

---

## 1. Design principles
1. **Show, don't claim.** Every conversion shows its evidence: before/after, a score, and what fell back. Trust comes from transparency.
2. **One clear next step.** Each screen has exactly one primary action. A wizard, not a dashboard of options.
3. **Calm under complexity.** Conversion is technical, but the UI should feel simple. Hide the machinery and expose details on demand ("Show details").
4. **Native to WordPress, better than WordPress.** It sits comfortably inside wp-admin (spacing rhythm, focus behavior), but with a modern, polished product layer.
5. **Fast feedback.** Every action responds within 100 ms visually. Long tasks show real progress (stage + percentage), never a bare spinner.
6. **Accessible by default.** WCAG 2.2 AA, keyboard-first, reduced-motion aware.

---

## 2. Brand
- **Personality:** confident, precise, friendly. Like a skilled colleague who says "done, here's what I changed."
- **Logo mark:** two offset rounded squares (source → destination) joined by a short arrow notch. Use a single colour on light or dark backgrounds.
- **Voice:**
  - Short sentences and plain verbs: "Convert", "Review", "Import".
  - No blame: say "We couldn't map this block, so it's kept as HTML," not "Error: unsupported element."
  - Numbers over adjectives: "92% match" instead of "great result."

---

## 3. Design tokens

All tokens are CSS custom properties, scoped under `.ai2kit-app` so they never leak into wp-admin or Elementor.

Naming follows `--a2k-{category}-{role}-{variant}`.

### 3.1 Color — primitives
```css
.ai2kit-app {
  /* Ink (neutrals) */
  --a2k-ink-0:   #FFFFFF;
  --a2k-ink-25:  #F8F9FB;
  --a2k-ink-50:  #F2F4F7;
  --a2k-ink-100: #E6E9EF;
  --a2k-ink-200: #D0D5DD;
  --a2k-ink-300: #A9B0BC;
  --a2k-ink-400: #7D8594;
  --a2k-ink-500: #5B6372;
  --a2k-ink-600: #434A57;
  --a2k-ink-700: #2F3540;
  --a2k-ink-800: #1D222B;
  --a2k-ink-900: #11151C;

  /* Violet (brand) */
  --a2k-violet-50:  #F3F0FF;
  --a2k-violet-100: #E6E0FF;
  --a2k-violet-200: #CCC0FF;
  --a2k-violet-300: #A996FF;
  --a2k-violet-400: #8A70FF;
  --a2k-violet-500: #6D4AFF;   /* brand primary */
  --a2k-violet-600: #5A36EB;
  --a2k-violet-700: #4827C4;
  --a2k-violet-800: #371D96;
  --a2k-violet-900: #24145F;

  /* Status */
  --a2k-green-50:  #ECFDF3; --a2k-green-500: #12B76A; --a2k-green-700: #027A48;
  --a2k-amber-50:  #FFFAEB; --a2k-amber-500: #F79009; --a2k-amber-700: #B54708;
  --a2k-red-50:    #FEF3F2; --a2k-red-500:   #F04438; --a2k-red-700:   #B42318;
  --a2k-blue-50:   #EFF8FF; --a2k-blue-500:  #2E90FA; --a2k-blue-700:  #175CD3;
}
```

### 3.2 Color — semantic (light, default)
```css
.ai2kit-app {
  --a2k-bg-canvas:        var(--a2k-ink-25);
  --a2k-bg-surface:       var(--a2k-ink-0);
  --a2k-bg-subtle:        var(--a2k-ink-50);
  --a2k-bg-inverse:       var(--a2k-ink-900);
  --a2k-bg-brand:         var(--a2k-violet-500);
  --a2k-bg-brand-hover:   var(--a2k-violet-600);
  --a2k-bg-brand-subtle:  var(--a2k-violet-50);

  --a2k-text-primary:     var(--a2k-ink-900);
  --a2k-text-secondary:   var(--a2k-ink-500);
  --a2k-text-tertiary:    var(--a2k-ink-400);
  --a2k-text-inverse:     var(--a2k-ink-0);
  --a2k-text-brand:       var(--a2k-violet-600);
  --a2k-text-on-brand:    var(--a2k-ink-0);

  --a2k-border-default:   var(--a2k-ink-100);
  --a2k-border-strong:    var(--a2k-ink-200);
  --a2k-border-focus:     var(--a2k-violet-500);

  --a2k-status-success-bg: var(--a2k-green-50);  --a2k-status-success-fg: var(--a2k-green-700);
  --a2k-status-warning-bg: var(--a2k-amber-50);  --a2k-status-warning-fg: var(--a2k-amber-700);
  --a2k-status-danger-bg:  var(--a2k-red-50);    --a2k-status-danger-fg:  var(--a2k-red-700);
  --a2k-status-info-bg:    var(--a2k-blue-50);   --a2k-status-info-fg:    var(--a2k-blue-700);

  /* Fidelity score scale */
  --a2k-score-high:  var(--a2k-green-500);   /* ≥ 90 */
  --a2k-score-mid:   var(--a2k-amber-500);   /* 70–89 */
  --a2k-score-low:   var(--a2k-red-500);     /* < 70 */
}
```

### 3.3 Color — dark mode
Dark mode activates when the user picks it in Ai2Kit settings, or via `prefers-color-scheme` when "System" is selected. It only swaps semantic tokens; primitives stay the same.
```css
.ai2kit-app[data-theme="dark"] {
  --a2k-bg-canvas:       var(--a2k-ink-900);
  --a2k-bg-surface:      var(--a2k-ink-800);
  --a2k-bg-subtle:       var(--a2k-ink-700);
  --a2k-bg-brand-subtle: color-mix(in srgb, var(--a2k-violet-500) 16%, transparent);
  --a2k-text-primary:    var(--a2k-ink-25);
  --a2k-text-secondary:  var(--a2k-ink-300);
  --a2k-text-tertiary:   var(--a2k-ink-400);
  --a2k-text-brand:      var(--a2k-violet-300);
  --a2k-border-default:  var(--a2k-ink-700);
  --a2k-border-strong:   var(--a2k-ink-600);
}
```
Contrast rules:
- Body text must be ≥ 4.5:1 and large text / UI components ≥ 3:1.
- `--a2k-violet-500` on white is 5.3:1, so it is safe for buttons with white text.

### 3.4 Typography
The admin UI uses the system stack, which means no external font requests (a wp.org rule) and matches wp-admin. The marketing site may use Inter (self-hosted).
```css
.ai2kit-app {
  --a2k-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Bengali", Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  --a2k-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;

  --a2k-text-xs:   12px; --a2k-lh-xs:   16px;
  --a2k-text-sm:   13px; --a2k-lh-sm:   20px;   /* wp-admin base */
  --a2k-text-md:   14px; --a2k-lh-md:   22px;
  --a2k-text-lg:   16px; --a2k-lh-lg:   24px;
  --a2k-text-xl:   20px; --a2k-lh-xl:   28px;
  --a2k-text-2xl:  24px; --a2k-lh-2xl:  32px;
  --a2k-text-3xl:  30px; --a2k-lh-3xl:  38px;   /* page title only */

  --a2k-weight-regular: 400;
  --a2k-weight-medium:  500;
  --a2k-weight-semibold:600;
  --a2k-weight-bold:    700;

  --a2k-tracking-tight: -0.01em;   /* 2xl+ */
}
```
| Role | Size | Weight |
|---|---|---|
| Page title | 3xl | bold, tight |
| Section title | xl | semibold |
| Card title | lg | semibold |
| Body | md | regular |
| Help/meta | sm | regular, secondary |
| Badge/label | xs | medium, uppercase allowed only for step labels |
| Code/JSON | sm | mono |

### 3.5 Spacing (4px base)
```css
.ai2kit-app {
  --a2k-space-0: 0;    --a2k-space-1: 4px;  --a2k-space-2: 8px;   --a2k-space-3: 12px;
  --a2k-space-4: 16px; --a2k-space-5: 20px; --a2k-space-6: 24px;  --a2k-space-8: 32px;
  --a2k-space-10: 40px; --a2k-space-12: 48px; --a2k-space-16: 64px;
}
```
Rules:
- Card padding is `space-6`.
- The gap between cards is `space-4`.
- Page gutter is `space-8` on desktop and `space-4` below 782px (the wp-admin mobile breakpoint).
- Inline icon-to-text gap is `space-2`.

### 3.6 Radius, border, shadow
```css
.ai2kit-app {
  --a2k-radius-sm: 6px;   /* inputs, badges */
  --a2k-radius-md: 10px;  /* buttons, small cards */
  --a2k-radius-lg: 14px;  /* cards, panels */
  --a2k-radius-xl: 20px;  /* dropzone, modals */
  --a2k-radius-full: 999px;

  --a2k-border-width: 1px;

  --a2k-shadow-xs: 0 1px 2px rgba(16, 24, 40, .05);
  --a2k-shadow-sm: 0 1px 3px rgba(16, 24, 40, .08), 0 1px 2px rgba(16, 24, 40, .04);
  --a2k-shadow-md: 0 6px 16px -4px rgba(16, 24, 40, .10), 0 2px 6px -2px rgba(16, 24, 40, .05);
  --a2k-shadow-lg: 0 16px 32px -8px rgba(16, 24, 40, .16);
  --a2k-shadow-focus: 0 0 0 3px color-mix(in srgb, var(--a2k-violet-500) 35%, transparent);
}
```

### 3.7 Motion
```css
.ai2kit-app {
  --a2k-duration-instant: 80ms;   /* press states */
  --a2k-duration-fast:    150ms;  /* hover, toggles */
  --a2k-duration-base:    220ms;  /* panels, accordions */
  --a2k-duration-slow:    360ms;  /* step transitions, modals */
  --a2k-duration-crawl:   1200ms; /* progress shimmer loop */

  --a2k-ease-standard: cubic-bezier(.2, 0, 0, 1);
  --a2k-ease-enter:    cubic-bezier(0, 0, .2, 1);
  --a2k-ease-exit:     cubic-bezier(.4, 0, 1, 1);
  --a2k-ease-spring:   cubic-bezier(.34, 1.56, .64, 1);   /* success check only */
}
@media (prefers-reduced-motion: reduce) {
  .ai2kit-app * { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
```
Rules:
- Animate only `opacity` and `transform`.
- Never animate layout properties such as width or height; the exception is the accordion, which animates `grid-template-rows`.

### 3.8 Layering & breakpoints
```css
.ai2kit-app {
  --a2k-z-base: 1; --a2k-z-sticky: 10; --a2k-z-dropdown: 100; --a2k-z-overlay: 9990; --a2k-z-modal: 9991; --a2k-z-toast: 9992;
  /* wp-admin bar is 99999 — stay below it */
}
```
Breakpoints:
- **960px:** the review list and compare panel stack vertically.
- **782px:** wp-admin mobile.
- **600px:** single-column cards.

### 3.9 Token export
- Ship tokens in `packages/admin-ui/src/styles/tokens.css`, and mirror them in `tokens.json` (W3C Design Tokens format) for the marketing site and the Chrome extension.
- One source of truth: generate the CSS from the JSON with Style Dictionary.

---

## 4. Layout

### 4.1 App shell (inside wp-admin)
```
┌ wp-admin menu ┬───────────────────────────────────────────────────────────┐
│               │ Header bar: [logo] Ai2Kit  ·  Stepper  ·  [Docs] [Pro]  │
│               ├───────────────────────────────────────────────────────────┤
│               │  Content (max-width 1200px, centered, gutter space-8)     │
│               │                                                           │
│               ├───────────────────────────────────────────────────────────┤
│               │  Sticky action bar: [Back]              [Primary action]  │
└───────────────┴───────────────────────────────────────────────────────────┘
```
- The header bar is 64px tall on `--a2k-bg-surface` with a bottom border.
- Hide WordPress admin notices from other plugins inside the app container, but show them in a collapsible "Site notices (3)" pill. This avoids clutter while staying wp.org-friendly because the notices are still visible.
- The sticky action bar sits at the bottom with `--a2k-shadow-lg`. It holds the primary action on the right and secondary actions on the left.

### 4.2 Menu placement
- Top-level menu "Ai2Kit" with the logo icon (SVG, `currentColor`).
- Submenus:
  - **Convert** (default)
  - **History**
  - **Settings**
  - **Help**
  - **Go Pro** — a text link on its own screen only, never a flashing badge

---

## 5. Components

Each component lists its anatomy, variants, states and accessibility notes. Build each one as a React component in `admin-ui/src/components/`, with a Storybook story (dev only, not shipped).

### 5.1 Button
- **Variants:**
  - `primary`: brand bg, white text
  - `secondary`: surface bg, strong border
  - `ghost`: transparent background
  - `danger`: red
  - `link`
- **Sizes:** `sm` (32px), `md` (40px, default), `lg` (48px, only in empty-state CTAs).
- **States:**
  - hover: bg brand-hover, `translateY(-1px)`, `shadow-sm`
  - active: `translateY(0)`
  - focus-visible: `shadow-focus`
  - disabled: 50% opacity, `cursor: not-allowed`
  - loading: an inline spinner replaces the icon; the label stays; `aria-busy="true"`
- Always a text label; icon-only buttons need `aria-label` and a tooltip.

### 5.2 Stepper (wizard header)
- Steps: **1 Upload → 2 Check → 3 Review → 4 Import**.
- **States:**
  - done: violet check circle
  - current: violet ring + bold label
  - upcoming: ink-300 circle
- Connectors fill with violet over `duration-slow` when a step completes.
- Screen readers get `<ol aria-label="Conversion steps">` with `aria-current="step"`.

### 5.3 DropZone
- A large card (radius-xl, dashed 2px `--a2k-border-strong`, padding space-12).
- **Contents:**
  - Illustration: the logo mark in a 48px violet-subtle circle
  - Title: "Drop your site here"
  - Sub-line: "HTML file, template ZIP, or built Lovable/Bolt/v0 folder (ZIP)"
  - Secondary button: "Choose file"
  - Text link: "Paste HTML instead"
- **Drag-over:** solid violet border, violet-subtle background, the icon scales to 1.08 with `ease-spring`.
- **After selection:** a file chip (name, size, detected type badge, remove ×).
- Keyboard: Enter/Space opens the file picker. On error, the zone shakes 2px × 3 over 220ms (disabled with reduced motion) and an inline error appears.

### 5.4 Source detection badge
A pill that shows the detected source and confidence, for example: `Lovable (Vite + React) · 96%`.
- Pill colours: Lovable/Bolt/v0 use a violet-subtle pill; plain HTML uses neutral.
- Clicking opens a popover with the evidence ("Found `<div id=root>`, `/assets/index-*.js`, Radix attributes").

### 5.5 Preflight checklist
Each row has a status icon, a title, a one-line explanation and an optional action:
- ✓ green `success`
- ! amber `warning`
- ✕ red `blocking`

For example: "Flexbox Container is off — imported pages would render blank. [Enable]". Blocking rows disable "Continue" and explain why.

### 5.6 Progress panel (conversion run)
- Stage list:
  1. Rendering
  2. Capturing desktop / tablet / mobile
  3. Detecting sections
  4. Extracting design tokens
  5. Building Elementor layout
- Each stage has a status and a duration.
- A determinate progress bar (6px, radius-full, violet fill, shimmer overlay on the active stage).
- A live mini-preview thumbnail of the iframe capture.
- "Show technical log" toggles a mono log panel with a copy button.
- Cancel is always available.

### 5.7 Section review row (the core screen)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ [thumb 120×72]  Hero          ● 94%   Patterns: –         [Native|HTML]  │
│                 h1, text, 2 buttons, image · 1 warning ▸                  │
└───────────────────────────────────────────────────────────────────────────┘
```
- The score badge uses the score scale colours and has a tooltip showing the breakdown (Structure, Styles, Visual).
- **Native/HTML** is a segmented control:
  - Native is the default when score ≥ 70; otherwise HTML is suggested, with a note.
  - Switching re-renders the preview instantly (optimistic).
- Expanding the row shows the warnings list, the detected widgets, and the "Pro: map as Accordion" upsell chip if the pattern needs Pro.
- Hovering a row highlights the matching region in the compare panel (a violet outline with a 20% overlay).

### 5.8 Compare panel
- **Modes:**
  - Side-by-side
  - **Swipe slider** (a draggable divider; arrow keys move it in 5% steps)
  - Overlay (the difference highlighted in red)
- **Breakpoint switcher:** Desktop / Tablet / Mobile as an icon segmented control.
- **Footer:** the overall score ring (64px, animated from 0 to its value over 800ms `ease-standard`).

### 5.9 Token review card
- A grid of detected colour swatches (40px squares, radius-md), each with its name and hex. Names are editable inline and map to Elementor Global names.
- A typography list with a live sample ("The quick brown fox — H1 56/64 Inter Bold").
- Options: "Merge into existing Global Colors" (default) / "Replace". A warning appears when replacing, with a note that the old kit is backed up.

### 5.10 Import summary
- A success hero: a check icon drawn with an SVG stroke animation (360ms, `ease-spring` on the scale).
- Title: "Your site is in Elementor."
- Created-items list: pages, templates, images, colours, fonts, menus, each with an "Edit with Elementor" / "View" link.
- A "Things to check" list (items that used HTML fallback, forms that need an email address).
- Secondary actions: "Convert another", "Undo this import" (with a confirm modal).
- One Pro card if relevant ("Convert the other 4 pages with Pro"). It is dismissible, and the dismissal is remembered per user.

### 5.11 Other components
| Component | Spec summary |
|---|---|
| Card | surface bg, border-default, radius-lg, shadow-xs; interactive cards lift to shadow-md on hover |
| Input / Textarea | 40px height, radius-sm, border-strong; focus: border-focus + shadow-focus; helper text sm/secondary; error text sm/danger with icon |
| Segmented control | subtle bg track, surface thumb with shadow-sm sliding over duration-fast |
| Toggle switch | 36×20, violet when on; label clickable; `role="switch"` |
| Badge | xs medium, radius-full, status colour pairs (bg-50 / fg-700) |
| Tooltip | inverse bg, xs text, 6px radius, 400ms delay, shown on focus too |
| Toast | bottom-right, surface bg, left accent bar in status colour, auto-dismiss 5s (paused on hover), `role="status"` |
| Modal | radius-xl, max-width 560px, overlay ink-900 at 50%; focus trapped; Esc closes; enter animation fade + scale .98→1 |
| Empty state | 48px icon, title lg, one line of text, one primary action |
| Skeleton | subtle bg with shimmer (duration-crawl) — use it for History and thumbnails |
| Code block | mono sm, subtle bg, copy button, max-height 320px with scroll |
| Upsell chip (Pro) | violet-subtle bg, violet text, small "PRO" badge; opens an info popover, never auto-opens a modal |

---

## 6. Screen patterns (user flows)

### 6.1 First run
1. A welcome card: "Convert AI-built sites into editable Elementor pages."
   - Three bullets with icons: Local & private · Native widgets · Works on Elementor Free
   - Primary action: "Start converting"
2. Preflight runs automatically in the background. If everything is green, a quiet line says "Your site is ready ✓". If not, show a checklist before Upload.
3. Opt-in for anonymous diagnostics, shown as an unchecked checkbox (Freemius opt-in lives here only).

### 6.2 Convert wizard

| Step | Primary action | Notes |
|---|---|---|
| Upload | Continue (enabled after a valid file) | Detection badge appears within 1s |
| Check | Start conversion | Output choice: *New page* (default) / *Template*; Elementor format *Auto (v4)*; route picker (Pro: multi-select) |
| Convert (progress) | — (Cancel only) | Auto-advances to Review |
| Review | Import to WordPress | Section rows + compare panel + tokens tab |
| Done | Edit with Elementor | Summary |

### 6.3 History
- A table with Date, Source, Pages, Score and Status, plus actions (View report, Re-run, Undo).
- Undo is available until the created items are edited. After that, warn: "These pages have been edited since import."

### 6.4 Errors
Every error states four things:
- What happened
- Why (if known)
- What to do next
- An optional "Copy details" button for support

Example:
> **Some images couldn't be found.**
> The build uses absolute paths (`/assets/…`). We fixed 23 of 25 automatically.
> [Show the 2 missing] · Tip: build with `npm run build -- --base=./`

---

## 7. Content & microcopy
| Instead of | Write |
|---|---|
| "Error 422" | "This ZIP has no index.html. Upload the built `dist` folder, not the source." |
| "Unsupported element" | "Kept as HTML — we couldn't map this block to a widget." |
| "Success!" | "Done — 1 page, 12 images and 6 colours added." |
| "Upgrade now!!!" | "Convert all 5 pages at once with Pro." |

- Use sentence case everywhere.
- Numbers are digits.
- Say "Elementor widget", not "element", in user-facing copy (v4's "Atomic element" appears only in the format setting).
- Localize dates using the WordPress date format.
- Microcopy must be translatable. Avoid concatenated strings and use `sprintf` placeholders with translator comments.

---

## 8. Accessibility checklist
- [ ] All interactive elements are reachable by Tab in a logical order; the stepper and review rows use roving tabindex.
- [ ] Focus is always visible (`shadow-focus`); never `outline: none` without a replacement.
- [ ] Colour is never the only signal: score badges include the number, and status rows have icons plus text.
- [ ] Live regions: progress updates via `aria-live="polite"`; errors via `role="alert"`.
- [ ] Compare slider: `role="slider"`, `aria-valuenow`, keyboard arrows.
- [ ] The iframe has a `title="Source site preview"`.
- [ ] Minimum target size is 24×24 (WCAG 2.2); buttons are 32px or larger.
- [ ] The reduced-motion media query is honoured globally.
- [ ] Tested with VoiceOver (macOS) and NVDA (Windows), and at 200% zoom.
- [ ] RTL: use logical properties (`margin-inline-start`, `padding-inline`); icons that imply direction are mirrored.

---

## 9. Motion specs (signature moments)
| Moment | Spec |
|---|---|
| Step transition | Outgoing content fades to 0 and moves 8px left (180ms exit); incoming fades in and moves from 8px right (220ms enter) |
| Dropzone hover | Border colour 150ms; icon scale 1.08 with spring |
| Progress active stage | A shimmer gradient sweeping every 1200ms; the completed-stage check pops (scale 0.6→1, spring, 220ms) |
| Score ring | Counts up from 0 to the value over 800ms standard; the colour settles at the end |
| Section highlight (hover row → compare) | Outline fades in over 150ms |
| Import success | SVG check stroke draw 360ms, then 6 confetti dots (brand + status colours) over 600ms, once per session. No confetti with reduced motion. |
| Toast | Slides in from 12px below + fade over 220ms; exits with a 150ms fade |

---

## 10. Converted-output design conventions (what Ai2Kit writes into Elementor)
These rules shape the *generated* Elementor sites so that clients get a clean, editable result:
1. **Globals first.** Every colour and font that matches a token uses the global reference. The client changes the brand colour once.
2. **Naming:**
   - Elementor navigator labels (`_title`) use semantic names: "Hero", "Features grid", "Feature card", "Footer".
   - v4 Global Classes follow `a2k-{semantic}-{role}` (`a2k-card`, `a2k-card-title`, `a2k-btn-primary`).
3. **Container discipline:** a maximum nesting depth of 5 where possible, and content width "boxed" at 1200px unless the source is full-bleed.
4. **Responsive:** only set tablet/mobile values when they differ, so there are no redundant overrides.
5. **Fallback blocks** are labelled "HTML (kept) — {reason}" in the navigator so editors know why they exist.
6. **Residual CSS** is scoped with `.elementor-{post-id} .a2k-…` and commented with the section name.

---

## 11. Marketing site & Chrome popup (reuse)
- **Marketing site:**
  - Same tokens, with Inter self-hosted and a hero type scale of 56/64.
  - Signature visual: an animated before→after swipe of a real Lovable site becoming an Elementor editor view.
- **Chrome popup:**
  - 360×520.
  - Header with the logo.
  - "Capture this page" primary button, a connected-site selector, and the last 3 captures.
  - Same button, badge and toast components.

---

## 12. Implementation notes for Claude Code
- Create `admin-ui/src/styles/tokens.css` exactly from §3, and import it once at the app root.
- Components use CSS Modules that consume only semantic tokens (`--a2k-bg-*`, `--a2k-text-*`), never primitives. That keeps dark mode correct.
- No UI library that injects global CSS. `@wordpress/components` may be used only for the date picker and media modal integrations.
- Add a Storybook (dev dependency only) with a dark-mode toggle and an a11y addon; stories are the visual spec for review.
- Visual regression: Playwright screenshots of each wizard step in light, dark and RTL.
