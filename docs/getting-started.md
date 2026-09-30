# Getting started

## Install

1. Install and activate **Elementor** (the free version is enough).
2. Install and activate **Ai2Kit** from **Plugins → Add New**, or upload `ai2kit.zip`.
3. Open **Ai2Kit → Convert**.

## Convert your first page

Ai2Kit works in four steps, shown at the top of the screen.

1. **Upload** — drop an `.html` file, a ZIP of an HTML template, or a ZIP of a built Lovable/Bolt/v0 site. You can also choose **Paste HTML instead** and paste a full page from Claude, ChatGPT or Gemini Canvas. Ai2Kit shows what it detected (for example *Lovable (Vite + React) · 96%*); click the badge to see why.
2. **Check** — preflight checks for your site (Elementor version, Flexbox Container, PHP limits). Anything that blocks the import is shown in red, often with a one-click **Enable**/**Fix** button. Here you also choose:
   - **Create:** a new draft page, or an Elementor template.
   - **Title** for the page or template.
   - **Elementor format:** Auto, Atomic elements (v4) or classic widgets (v3). Auto picks v4 when Elementor's Atomic editor is on.
3. **Review** — the page is rendered and converted in your browser. You see every section with a score and can switch any section between **Native** (Elementor widgets) and **HTML** (kept pixel-exact). The **Tokens** tab shows the colors and fonts that will become Elementor Global Colors & Fonts. See [Reviewing a conversion](reviewing.md).
4. **Import** — click **Import to WordPress**. Images go to the Media Library, tokens go to your Elementor kit, and the page is created as a draft.

Then click **Edit with Elementor**. Everything is a normal Elementor container or widget: change text, swap images, adjust spacing, use your Global Colors.

## Next steps

- Compare the result with the source: **Compare with the source** on the Done screen (side by side, swipe or overlay, at desktop/tablet/mobile widths).
- Not happy? **History → Undo** removes the page, the images it added, and restores your Global Colors & Fonts.
