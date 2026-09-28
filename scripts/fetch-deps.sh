#!/usr/bin/env bash
# Downloads the WordPress plugins/themes wp-env mounts for local development
# into .deps/ (gitignored). Re-run to update to the latest stable versions.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .deps
fetch() { # $1 = url, $2 = folder name inside the zip
	local tmp; tmp="$(mktemp -d)"
	curl -fsSL "$1" -o "$tmp/pkg.zip"
	rm -rf ".deps/$2"
	unzip -q "$tmp/pkg.zip" -d .deps
	rm -rf "$tmp"
	echo "✓ $2"
}
fetch https://downloads.wordpress.org/plugin/elementor.latest-stable.zip elementor
fetch https://downloads.wordpress.org/theme/hello-elementor.latest-stable.zip hello-elementor
