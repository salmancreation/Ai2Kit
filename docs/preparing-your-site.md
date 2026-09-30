# Preparing your site

Ai2Kit converts what a browser can render. For single HTML pages that's the file itself; for React/Vite projects it's the **built** output, not the source code.

## Lovable, Bolt and other Vite + React projects

1. Get the project locally (Lovable: **GitHub sync** or **Download**; Bolt: **Download**).
2. Build with a relative base, so asset paths work from any folder:

   ```bash
   npm install
   npm run build -- --base=./
   ```

3. ZIP the `dist` folder (the folder itself or its contents — both work) and upload it.

If you upload the source ZIP (with `package.json` and `src/`), Ai2Kit tells you and shows these steps. Built without `--base=./`? Ai2Kit fixes most absolute `/assets/…` paths automatically and tells you how many it fixed.

Only the page at `/` is converted in the free version. Ai2Kit Pro converts every route in one job.

## v0 and Next.js

Use a static export (`output: 'export'` in `next.config.js`, then `next build`) and ZIP the `out` folder.

## Claude, ChatGPT, Gemini Canvas

Copy the full HTML page (from `<!doctype html>` to `</html>`) and use **Paste HTML instead**, or save it as `index.html` and upload the file. Pages that load Tailwind from its CDN work as they are.

## HTML templates

ZIP the template folder with its HTML, CSS, JS and images. If the ZIP has several HTML files, `index.html` is converted.

## Limits

- Upload size: 50 MB by default (see [Developers](developers.md) to change it). Remove large videos you don't need.
- ZIPs must not contain symbolic links or unsafe paths; PHP files and other server-side code are left out for safety.
- Sites that run JavaScript can only be converted by users allowed to add unfiltered HTML (administrators; on multisite, network super admins).
