# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting), or email **modinatheme@gmail.com** with the subject `Ai2Kit security`.

Include the Ai2Kit, WordPress, Elementor and PHP versions, steps to reproduce, and the impact you see. We aim to reply within 3 business days and to ship a fix for confirmed issues as soon as possible, crediting you in the changelog if you wish.

## Supported versions

Security fixes go into the latest release on WordPress.org.

## Scope notes

Ai2Kit is an administrator tool: converting needs `manage_options`, and converting pages that run JavaScript also needs `unfiltered_html`. The server re-validates everything the browser sends (widgets, settings, URLs, SVGs, CSS) before it is saved.
