# Import, History and Undo

## What an import does

When you click **Import to WordPress**, your server:

1. **Re-checks everything** the browser sent — only known Elementor widgets and settings are accepted; text is sanitized and URLs are checked.
2. **Imports images** into the Media Library. An image that's already there (same file) is reused, not duplicated. SVG icons are cleaned before they're saved.
3. **Adds design tokens** to your Elementor kit (Global Colors & Fonts), after backing up the current kit.
4. **Creates the page** — a draft page or an Elementor template — through Elementor's own document API, so revisions and CSS generation work normally.

The Done screen lists what was created and **Things to check**: blocks kept as HTML, forms that need connecting, styles kept as scoped CSS, icons or images that couldn't be imported.

## History

**Ai2Kit → History** lists every conversion with its date, source, pages, score and status. **View report** shows the per-section scores again; **Re-run** starts a new conversion.

## Undo

**Undo** (from History or the Done screen):

- moves the created page or template to the trash,
- deletes the images that import added (images that were already in your library are left alone),
- restores your Global Colors & Fonts from the backup.

If the page was edited after the import, Ai2Kit warns you first.
