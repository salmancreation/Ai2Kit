# Use Ai2Kit from Claude, Cursor and other AI agents

Ai2Kit registers **agent tools** with WordPress. An AI agent connected to your site over MCP (Model Context Protocol) can then prepare conversions, read their reports and undo imports, using Ai2Kit's tested converter instead of improvising Elementor JSON.

Everything stays on your site: the tools make no requests to other servers.

## What an agent can do

| Tool | What it does |
|---|---|
| `ai2kit/preflight` | Checks that the site can import (Elementor, Flexbox Container, limits, permissions). |
| `ai2kit/create-job` | Prepares a conversion from **HTML the agent has** (for example a page it just generated) or from a **.zip / .html file in your Media Library** (by attachment ID). Returns a review link. |
| `ai2kit/list-jobs` | Recent conversions: imported pages with edit links and scores, jobs waiting to be converted. |
| `ai2kit/get-job` | One conversion's report: pages created, overall and per-section match, sections kept as HTML, things to check. |
| `ai2kit/undo-import` | Undoes an import (page to trash, added images deleted, Global Colors & Fonts restored). If you edited the page after import, the agent must ask you first. |

**Converting needs you for one click.** Ai2Kit renders the page in a real browser to measure the layout, so the agent gives you a link. Open it in wp-admin, click **Start conversion**, review the sections, and click **Import to WordPress**. The agent can then read the result with `ai2kit/get-job`.

For safety, agents can't pass a web address to download: files must already be in your Media Library. Only administrators can use the tools, and imports are always drafts.

## Requirements

- WordPress 6.9 or later (it has the Abilities API).
- The **MCP Adapter**. Elementor 4.3 and later include it. To check, run `wp mcp-adapter list`. If WP-CLI reports that `mcp-adapter` isn't a registered command, install the [MCP Adapter plugin](https://github.com/WordPress/mcp-adapter).

## Connect Claude Desktop, Claude Code, Cursor or VS Code

Ai2Kit's tools are on the adapter's default server. Agents find them with `mcp-adapter-discover-abilities` and run them with `mcp-adapter-execute-ability`.

### A site on your computer (WP-CLI)

Add this to your MCP client's configuration (for Claude Desktop: *Settings → Developer → Edit config*):

```json
{
  "mcpServers": {
    "my-wordpress": {
      "command": "wp",
      "args": [
        "--path=/path/to/your/wordpress",
        "mcp-adapter",
        "serve",
        "--server=mcp-adapter-default-server",
        "--user=admin"
      ]
    }
  }
}
```

`--user` is the WordPress administrator the agent acts as.

### A site on a server (HTTP)

Create an **Application Password** under *Users → Profile → Application Passwords*, then:

```json
{
  "mcpServers": {
    "my-wordpress": {
      "command": "npx",
      "args": [ "-y", "@automattic/mcp-wordpress-remote@latest" ],
      "env": {
        "WP_API_URL": "https://your-site.com/wp-json/mcp/mcp-adapter-default-server",
        "WP_API_USERNAME": "your-username",
        "WP_API_PASSWORD": "your-application-password"
      }
    }
  }
}
```

Keep the application password private. You can revoke it in your profile at any time.

## Try it

Ask your agent, for example:

- "Check whether my WordPress site is ready for Ai2Kit."
- "Build a landing page for a yoga studio as one HTML file with Tailwind, then create an Ai2Kit job for it."
- "Convert the Lovable export I uploaded to the Media Library (attachment 214)."
- "Which Ai2Kit imports scored below 90%?"
- "Undo the last Ai2Kit import."
