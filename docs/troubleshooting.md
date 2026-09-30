# Troubleshooting

## My React/Vite site converts to a blank page

You uploaded the project source, or the build can't find its files. Upload the built `dist` folder as a ZIP, built with a relative base: `npm run build -- --base=./`. See [Preparing your site](preparing-your-site.md).

## Images are missing

The build uses absolute paths (`/assets/…`). Ai2Kit fixes most of them automatically (the Check step says how many); building with `--base=./` fixes the rest. For images hosted elsewhere, check **Settings → Import remote images**.

## Imported pages render blank

Elementor's **Flexbox Container** feature is off. Turn it on in **Elementor → Settings → Features**, or use **Enable** in the Check step.

## A section looks different

Switch it to **HTML** in Review to keep it pixel-exact, or keep it **Native** and adjust it in Elementor. Sections with a lower score show why in their details.

## Fonts don't match

Ai2Kit sets the font family on each widget and adds fonts to your Global Fonts; Elementor loads Google Fonts automatically. Fonts the site hosts itself need to be added in **Elementor → Custom Fonts** (Pro) or by your theme.

## "This ZIP is the project source, not the built site"

Build it first, then ZIP the `dist` folder.

## "Your account can't run scripts"

Pages that run JavaScript (React/Vite builds, pages with scripts) can only be converted by users allowed to add unfiltered HTML — administrators, or network super admins on multisite.

## The upload fails or is rejected

- **This file is larger than 50 MB** — remove large videos or files you don't need, or raise the limit (see [Developers](developers.md)).
- **The upload didn't finish** — check your connection and the server's upload limit (shown in the Check step).
- **This ZIP unpacks to more than 200 MB / has more than 5,000 files** — upload only the built site.

## The import times out

Imports with many images can hit the PHP time limit. The Check step shows your limit; 60 seconds or more is recommended, and 256 MB of memory for large sites.

## Still stuck?

[Open an issue](https://github.com/salmancreation/Ai2Kit/issues) with the report from **History → View report**, your WordPress/Elementor/PHP versions, and — if you can share it — the file you converted.
