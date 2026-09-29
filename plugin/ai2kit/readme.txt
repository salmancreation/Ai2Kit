=== Ai2Kit – AI Website to Elementor Converter ===
Contributors: modinatheme
Tags: elementor, html to elementor, lovable, converter, ai website
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Convert Lovable, Bolt, v0, Gemini and HTML sites into editable Elementor pages — locally, inside wp-admin. Your code never leaves your site.

== Description ==

Ai2Kit turns websites built with AI tools into native, editable Elementor pages. Upload a built Lovable, Bolt or v0 site (as a ZIP), an HTML template, or paste HTML from Claude, ChatGPT or Gemini Canvas. Ai2Kit renders it right in your WordPress admin, reads the real layout at desktop, tablet and mobile sizes, and rebuilds it with Elementor containers and widgets.

**Local and private.** Conversion runs in your browser and saves on your server. Ai2Kit Free makes no requests to Ai2Kit or any other service.

= What you get =

* Native Elementor containers and widgets: headings, text, buttons, images, icons, icon lists, videos, dividers and spacers.
* FAQs and accordions become Elementor's native Accordion, with every answer — even the ones hidden until clicked.
* Hover effects are kept: button and link colors, card shadows and lifts, with their transition speed.
* Elementor 4 Atomic elements (v4) when the Atomic editor is on — or classic widgets (v3), your choice.
* Styles no Elementor control covers (gradient text, rotations, blur) are kept as small CSS scoped to the converted page.
* Responsive values for tablet and mobile, only where they differ.
* Design tokens: your colors and fonts become Elementor Global Colors and Global Fonts (shadcn/ui themes are read directly).
* Images imported into the Media Library, with duplicates detected.
* A fidelity report: a score for every section, and a Native / HTML choice for each one.
* Output as a new draft page or an Elementor template.
* Preflight checks with one-click fixes (for example, turning on Flexbox Container).
* Undo: remove an import and restore your Global Colors & Fonts.
* Works with Elementor Free. No Elementor Pro needed.

= Supported sources =

* Lovable, Bolt and other Vite + React builds (upload the built dist folder as a ZIP)
* v0 / Next.js static exports
* HTML templates (ZIP with CSS, JS and images)
* Single HTML files and pasted HTML from Claude, ChatGPT and Gemini Canvas

= Known limits =

Ai2Kit converts presentational pages. App features (logins, dashboards, databases), canvas/WebGL and complex absolutely positioned layouts are kept as HTML. Forms are kept as HTML in the free version.

= Ai2Kit Pro =

A separate add-on converts whole sites in one job (multiple routes, header and footer templates, menus), maps tabs and carousels to native widgets, and more. Everything in the free version stays free.

== Installation ==

1. Install and activate Elementor.
2. Install and activate Ai2Kit.
3. Go to Ai2Kit → Convert and drop in your site.

For Lovable, Bolt or Vite projects, build first: `npm run build -- --base=./`, then ZIP the dist folder.

== Frequently Asked Questions ==

= Does my code get uploaded anywhere? =

No. Files are stored in a private folder in your uploads directory, converted in your browser, and deleted after import (or after 24 hours).

= My React site converts to a blank page =

Upload the built output (dist folder), not the project source. Ai2Kit tells you when it detects a source ZIP.

= Who can use Ai2Kit? =

Administrators. Sites that run JavaScript can only be converted by users allowed to add unfiltered HTML.

== Screenshots ==

1. Drop your site and see what Ai2Kit detected.
2. Preflight checks with one-click fixes.
3. Live conversion progress.
4. Review every section with a score and a Native / HTML choice.
5. Design tokens become Elementor Global Colors & Fonts.
6. Done — edit your new page with Elementor.

== Changelog ==

= 0.3.0 =
* New: accordions and FAQs (Radix/shadcn and similar) become Elementor's native Accordion. Collapsed answers are opened and captured during conversion.
* New: hover effects — colors, backgrounds, borders, shadows, lift/scale and transition duration — map to Elementor's hover controls (v3) and the hover style state (v4).
* Improved: icons are the source's own SVG (identical), not a Font Awesome look-alike. Icons colored by CSS classes or inline styles, sprite icons (<use>), gradients and icons without a viewBox all import correctly. If an SVG can't be imported, the closest Font Awesome icon is used and the import report says so.
* Fixed: button icons keep their size; icon list spacing matches the source; grids that stay multi-column on phones no longer collapse to one column; text with a "normal" line height no longer gets the theme's taller line height.
* Improved: History shows each score as a ring, and actions have icons.

= 0.2.0 =
* New: Elementor 4 Atomic (v4) output, built with Elementor's own CSS converter and validators. Mixed with classic widgets where no atomic element exists.
* New: styles without an Elementor control (gradient text, transforms, filters, system font stacks) are kept as CSS scoped to the page.
* Improved: fidelity scores now reflect what's actually lost (collapsed accordions, substituted icons).
* Improved: fonts that never loaded in the source are no longer applied; the rendered font is used.
* Fixed: breakpoint captures recorded spurious font changes.

= 0.1.0 =
* First release: local conversion of HTML, template ZIPs and built SPA ZIPs into Elementor v3 containers and widgets, tokens, media, fidelity report and undo.

== Source code ==

The admin app is built from human-readable source in the public repository (packages/admin-ui and packages/engine).
