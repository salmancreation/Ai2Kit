# What gets converted

Ai2Kit reads the page as the browser renders it — at 1440, 1024 and 390 px wide — and rebuilds it with Elementor's own building blocks.

## Layout

- Sections, rows, columns and grids become **Flexbox containers** (or Grid containers), with padding, gaps, alignment, widths and min-heights.
- Centered, max-width content becomes a **boxed** container.
- **Responsive values** are written for tablet and mobile only where they differ from desktop — including grids that stay multi-column on phones.

## Widgets

| In the source | In Elementor |
|---|---|
| `h1`–`h6`, large display text | Heading |
| Paragraphs and rich text (bold, links, lists) | Text Editor |
| Links and buttons that look like buttons | Button (with its icon) |
| `<img>` | Image (imported to the Media Library) |
| SVG icons | Icon — the site's **own SVG**, uploaded, identical to the source |
| Lists with icons | Icon List |
| YouTube, Vimeo, `<video>` | Video |
| `<hr>`, empty spacers | Divider, Spacer |
| Accordions and FAQs | **Accordion** (see below) |
| Forms, tables, iframes, canvas | HTML widget (kept as is) |

With **Elementor format → Atomic elements (v4)**, headings, paragraphs, buttons, images, icons and containers become Elementor 4 atomic elements; widgets without an atomic version (icon lists, accordions, rich text with styled spans) stay classic on the same page.

## Accordions and FAQs

Ai2Kit opens every item while converting, reads the answer, and builds Elementor's **Accordion** widget — so answers that were hidden until clicked aren't lost. This works for:

- Radix/shadcn accordions (Lovable, v0) and others that use `aria-expanded`;
- native `<details>`/`<summary>`.

It keeps whether one or several items can be open, the title and answer styles, borders and card backgrounds, and the icon: the source's chevron SVG (and how it turns when open), a "+"/"−" drawn in CSS, or the browser's ▸ marker.

## Hover effects

`:hover` styles become Elementor's hover controls: button background and text color, link colors, card shadows, borders, lift/scale and the transition duration. In v4 they become the element's hover state.

## Backgrounds

Background colors, gradients and images are mapped to Elementor's Background controls. A hero built with a separate full-size image layer and a dark overlay (`::after`, `bg-black/50`, a faded `<img>`) becomes the section's own **Background → Image** and **Background Overlay** — not extra absolutely positioned containers.

## Design tokens

Colors and fonts become **Global Colors** and **Global Fonts**, and widgets link to them when the color matches exactly.

## Styles without an Elementor control

Gradient text, rotations, blur and similar effects are kept as a small stylesheet that applies **only to the converted page**. Elementor still renders the page; the CSS is validated on your server before it's saved.

## What isn't converted

- App features: logins, dashboards, databases, anything that needs a backend.
- `canvas`/WebGL, and complex absolutely positioned layouts (kept as HTML).
- Forms, tabs and carousels are kept as static, editable content in Free (forms as HTML). Ai2Kit Pro maps tabs and carousels to native widgets.
- Only the page at `/` of a multi-page app (Pro converts every route).
