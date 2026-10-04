# Privacy and security

## Your code stays on your site

- Uploaded files are stored in a private folder inside your uploads directory (`wp-content/uploads/ai2kit/jobs/…`), protected from directory listing and direct PHP execution.
- The conversion runs in **your browser**; the result is saved on **your server**.
- Uploads are deleted after import, or after 24 hours (unless **Keep uploaded files for re-runs** is on).
- Ai2Kit Free makes **no requests to Ai2Kit's servers** and collects **no usage data**.

## Requests to other hosts

- While converting, your browser renders the uploaded page, so fonts, scripts and images it references on other hosts (a Tailwind or Google Fonts CDN, for example) load in your browser — as when you open the page yourself.
- With **Import remote images** on (the default), images the page references on other hosts are downloaded by your server into the Media Library during import.

## Security

- Only administrators can convert. Pages that run JavaScript need the `unfiltered_html` capability.
- ZIPs are checked for unsafe paths, symbolic links, size and file count; server-side code (PHP and similar) is never extracted.
- The browser's output is never trusted: the server re-validates every element and setting, sanitizes text and URLs, and cleans SVGs with an allowlist before saving.
- Scoped CSS is rebuilt on the server from validated values only.
- Every REST endpoint checks permissions and a WordPress nonce.
- Agent tools ([AI agents](agents.md)) are for administrators only. They accept HTML or a Media Library file, never a web address to download.
