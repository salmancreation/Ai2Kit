=== Ai2Kit – AI Website to Elementor Converter ===
Contributors: modinatheme
Tags: elementor, html to elementor, lovable, ai website builder, converter
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Convert Lovable, Bolt, v0 and HTML sites into editable Elementor pages, right inside WordPress. Your code never leaves your site.

== Description ==

**Ai2Kit converts AI-built websites and HTML templates into native, editable Elementor pages.** Upload a Lovable, Bolt or v0 site, an HTML template, or paste HTML from Claude, ChatGPT or Gemini Canvas. Ai2Kit renders it inside your WordPress admin, reads the real layout at desktop, tablet and mobile sizes, and rebuilds it with Elementor containers and widgets you can edit like anything you built by hand.

Use it for **HTML to Elementor**, **Lovable to WordPress**, **AI website to Elementor**, or to **convert an HTML template to Elementor** — without copying JSON between tools.

**Local and private.** The conversion runs in your browser and is saved on your server. Ai2Kit Free doesn't send your files, pages or any usage data to Ai2Kit or anyone else.

= What you get =

* **Native Elementor widgets** — containers, headings, text, buttons, images, icons, icon lists, videos, dividers and spacers. Not screenshots, not one big HTML block.
* **FAQs and accordions** become Elementor's native Accordion, with every answer — even the ones hidden until clicked (Radix/shadcn and native `<details>`).
* **Hover effects** are kept: button and link colors, card shadows and lifts, with their transition speed.
* **Exact icons** — the site's own SVG icons, not look-alikes.
* **Hero backgrounds** — background images and dark overlays become the section's Background and Background Overlay, ready to swap in Elementor.
* **Responsive** — tablet and mobile values, only where they differ from desktop.
* **Design tokens** — your colors and fonts become Elementor Global Colors and Global Fonts (shadcn/ui themes are read directly).
* **Elementor 4 Atomic elements (v4)** when the Atomic editor is on — or classic widgets (v3), your choice.
* **Media Library** — images are imported, with duplicates detected.
* **Fidelity report** — a score for every section and a Native / HTML choice for each one.
* **New draft page or Elementor template**, with **Undo** that also restores your Global Colors & Fonts.
* **Preflight checks** with one-click fixes (for example, turning on Flexbox Container).
* **Works with Elementor Free.** No Elementor Pro needed.

= Supported sources =

* Lovable, Bolt and other Vite + React builds (upload the built `dist` folder as a ZIP)
* v0 / Next.js static exports
* HTML templates (a ZIP with HTML, CSS, JS and images)
* Single HTML files, and HTML pasted from Claude, ChatGPT or Gemini Canvas

= Known limits =

Ai2Kit converts presentational pages. App features (logins, dashboards, databases), canvas/WebGL and complex absolutely positioned layouts are kept as HTML. Forms, tabs and carousels are kept as static, editable content in the free version.

= Privacy =

* Your uploaded files are stored in a private folder in your uploads directory and deleted after import (or after 24 hours).
* Ai2Kit Free makes no requests to Ai2Kit's servers and collects no usage data.
* While converting, your browser renders the uploaded page, so fonts, scripts or images it references on other hosts (for example a Tailwind or Google Fonts CDN) load in your browser, just as when you open the page yourself.
* With **Settings → Import remote images into the Media Library** on (the default), images the page references on other hosts are downloaded to your Media Library during import. Turn it off to keep their original addresses.

= Ai2Kit Pro =

A separate add-on converts whole sites in one job (multiple routes, header and footer templates, menus), maps tabs and carousels to native widgets, and more. Everything in the free version stays free and unlimited.

== Installation ==

1. Install and activate Elementor (the free version works).
2. Install and activate Ai2Kit.
3. Go to **Ai2Kit → Convert** and drop in your site.

For Lovable, Bolt or Vite projects, build first with `npm run build -- --base=./`, then ZIP the `dist` folder.

== Frequently Asked Questions ==

= Does my code get uploaded anywhere? =

No. Files are stored in a private folder on your own site, converted in your browser, and deleted after import (or after 24 hours).

= Does it work with Elementor Free? =

Yes. Everything Ai2Kit Free does works without Elementor Pro.

= My React site converts to a blank page =

Upload the built output (the `dist` folder), not the project source. Ai2Kit tells you when it detects a source ZIP.

= Can I switch a section back to the original HTML? =

Yes. In Review, every section has a Native / HTML switch. HTML keeps it pixel-exact in an HTML widget.

= Can I undo an import? =

Yes. History → Undo moves the page to the trash, deletes the images that import added, and restores your Global Colors & Fonts.

= Who can use Ai2Kit? =

Administrators. Sites that run JavaScript can only be converted by users allowed to add unfiltered HTML (on multisite, network super admins).

== Screenshots ==

1. Drop your site: Ai2Kit detects what it is (here, a Lovable build).
2. Preflight checks with one-click fixes, and the output options.
3. Live conversion progress — it all runs in your browser.
4. Review every section with a score and a Native / HTML choice.
5. Design tokens become Elementor Global Colors & Fonts.
6. Done — edit your new page with Elementor.
7. History of every conversion, with reports and Undo.
8. Settings.

== Changelog ==

= 0.3.0 =
* New: accordions and FAQs — Radix/shadcn and similar, and native <details>/<summary> — become Elementor's native Accordion. Collapsed answers are opened and captured during conversion; one-at-a-time vs. several-open behavior, card styling, the source's chevron SVG, "+"/"−" and ▸ markers are kept.
* New: hover effects — colors, backgrounds, borders, shadows, lift/scale and transition duration — map to Elementor's hover controls (v3) and the hover style state (v4).
* Improved: icons are the source's own SVG (identical), not a Font Awesome look-alike. Icons colored by CSS classes or inline styles, sprite icons (<use>), gradients and icons without a viewBox all import correctly. If an SVG can't be imported, the closest Font Awesome icon is used and the import report says so.
* Fixed: button icons keep their size; icon list spacing matches the source; grids that stay multi-column on phones no longer collapse to one column; text with a "normal" line height no longer gets the theme's taller line height.
* Improved: background layers (an image or <img> covering a section, a darkening ::after or bg-black/50 layer on top) become the section's own Background image and Background Overlay, instead of extra absolutely positioned containers. A section that pins its content to the bottom keeps it there.
* Fixed: v4 background images are imported into the Media Library (they pointed at the temporary upload folder).
* Improved: History shows each score as a ring, and actions have icons.
* Improved: every message in the admin — including conversion warnings, section names and the progress log — is translatable. Bangla (bn_BD) translation ready.
* Fixed: right-to-left languages — the admin app no longer shifts under the menu, previews show, and direction arrows point the right way.
* Fixed: other plugins' admin notices (e.g. Elementor's) no longer appear inside Ai2Kit screens; they're in the "Site notices" pill.
* Removed: the "Share anonymous diagnostics" switch — Ai2Kit Free never collected diagnostics.

= 0.2.0 =
* New: Elementor 4 Atomic (v4) output, built with Elementor's own CSS converter and validators. Mixed with classic widgets where no atomic element exists.
* New: styles without an Elementor control (gradient text, transforms, filters, system font stacks) are kept as CSS scoped to the page.
* Improved: fidelity scores now reflect what's actually lost (collapsed accordions, substituted icons).
* Improved: fonts that never loaded in the source are no longer applied; the rendered font is used.
* Fixed: breakpoint captures recorded spurious font changes.

= 0.1.0 =
* First release: local conversion of HTML, template ZIPs and built SPA ZIPs into Elementor v3 containers and widgets, tokens, media, fidelity report and undo.

== Source code ==

Ai2Kit is open source. The admin app in `build/` is compiled from human-readable TypeScript in the public repository — `packages/admin-ui` (the admin screens) and `packages/engine` (the converter): https://github.com/salmancreation/Ai2Kit

To build it yourself: `corepack pnpm install`, then `pnpm --filter @ai2kit/admin-ui build`.

== Credits ==

* Icon names are matched to Font Awesome Free icons bundled with Elementor (icons: CC BY 4.0, code: MIT).
* The Lucide → Font Awesome name map in the engine refers to icon names from Lucide (ISC license); no Lucide files are bundled.
