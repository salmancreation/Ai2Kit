# Reviewing a conversion

After the conversion runs, the **Review** step shows what Ai2Kit built before anything is saved.

## Sections and scores

Each section (Header, Hero, Features grid, FAQ, Footer …) has a thumbnail, a list of the widgets it became, and a **score**:

- **Green (90%+)** — a close native match.
- **Amber (70–89%)** — native, with differences worth a look.
- **Red (below 70%)** — Ai2Kit suggests keeping it as HTML.

Hover the score for its breakdown: **structure** (how much became real widgets), **styles** (how many visual properties were mapped to Elementor controls) and **HTML kept** (blocks that couldn't become widgets). The **overall match** at the top is weighted by section size.

Click a section to see its details: detected widgets, and warnings such as *Some styles no Elementor control covers were kept as scoped CSS* or *Kept as HTML — embedded frame*.

## Native or HTML

Every section has a **Native / HTML** switch:

- **Native** — Elementor containers and widgets. Fully editable; small differences from the source are possible.
- **HTML** — the section as it looks in the source, inside one Elementor HTML widget. Pixel-exact, but you edit it as HTML.

You can mix them on one page.

## Design tokens

The **Tokens** tab shows the colors and fonts Ai2Kit found:

- **shadcn/ui themes** (Lovable, v0) — read directly from the theme variables (`--primary`, `--muted` …).
- **Other sites** — the colors and fonts the page uses most, grouped so near-identical shades count once.

Rename them if you like. With **Add to Elementor Global Colors & Fonts** on, they're added to your kit and widgets reference them — change a Global Color later and every widget that uses it follows.

**Merge** adds them next to your existing globals. **Replace** overwrites the four system globals (Primary, Secondary, Text, Accent) for the whole site; the previous kit is backed up and **Undo** restores it.

## Comparing with the source

On the Done screen, **Compare with the source** shows the original and the Elementor page side by side, with a swipe or overlay, at desktop, tablet and mobile widths.
