<?php
/**
 * Absolute asset path fix (PRD FR-4) and sandbox preparation (§10).
 *
 * Vite/Next builds default to base "/", so "/assets/x.js" 404s from the job
 * sub-folder. Root-relative references that point at a file that exists in
 * the build are rewritten to the job URL. No WordPress functions: unit-testable.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

/**
 * AssetRewriter.
 */
final class AssetRewriter {

	const MAX_FILE_BYTES = 15728640; // Skip rewriting files over 15 MB.

	/**
	 * Injected at the top of <head>: a CSP for the sandbox and the route shim. The shim
	 * presents the app at "/" (builds assume they're served from the root), or at the
	 * route in `?a2k_route=/about`, so single-page apps render any of their routes.
	 */
	const SANDBOX_HEAD = '<meta http-equiv="Content-Security-Policy" content="connect-src \'self\' data: blob:; form-action \'none\'; base-uri \'self\'">'
		. '<script data-ai2kit-shim>(function(){try{window.__A2K_JOB_PATH__=location.pathname;var r=new URLSearchParams(location.search).get("a2k_route");history.replaceState(null,"",(r&&/^\/[^\/]/.test(r)||r==="/"?r:"/")+location.hash);}catch(e){}})();</script>';

	/**
	 * Build root (directory of the entry file).
	 *
	 * @var string
	 */
	private $root_dir;

	/**
	 * Public URL of the build root, no trailing slash.
	 *
	 * @var string
	 */
	private $root_url;

	/**
	 * Number of references rewritten.
	 *
	 * @var int
	 */
	public $rewritten = 0;

	/**
	 * Root-relative references that point nowhere (reported to the user).
	 *
	 * @var string[]
	 */
	public $missing = array();

	/**
	 * Constructor.
	 *
	 * @param string $root_dir Build root directory.
	 * @param string $root_url Build root URL.
	 */
	public function __construct( $root_dir, $root_url ) {
		$this->root_dir = rtrim( $root_dir, '/' );
		$this->root_url = rtrim( $root_url, '/' );
	}

	/**
	 * Rewrite all text assets under the build root.
	 *
	 * @param string[] $files Paths relative to the build root.
	 * @return void
	 */
	public function rewrite_all( array $files ) {
		foreach ( $files as $rel ) {
			if ( ! preg_match( '/\.(html?|css|m?js)$/i', $rel ) ) {
				continue;
			}
			$path = $this->root_dir . '/' . $rel;
			if ( ! is_file( $path ) || filesize( $path ) > self::MAX_FILE_BYTES ) {
				continue;
			}
			$src = (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$ext = strtolower( pathinfo( $rel, PATHINFO_EXTENSION ) );
			$out = 'css' === $ext ? $this->rewrite_css( $src ) : ( in_array( $ext, array( 'js', 'mjs' ), true ) ? $this->rewrite_js( $src ) : $this->rewrite_html( $src, dirname( $rel ) ) );
			if ( $out !== $src ) {
				file_put_contents( $path, $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
		$this->missing = array_values( array_unique( $this->missing ) );
	}

	/**
	 * Map a root-relative path to the job URL when the file exists.
	 *
	 * @param string $path Path starting with "/".
	 * @return string|null
	 */
	private function resolve_root( $path ) {
		$clean = preg_replace( '/[?#].*$/', '', $path );
		if ( '' === $clean || '/' === $clean || 0 === strpos( $clean, '//' ) ) {
			return null;
		}
		$decoded = rawurldecode( $clean );
		if ( false !== strpos( $decoded, '..' ) ) {
			return null;
		}
		if ( is_file( $this->root_dir . $decoded ) ) {
			++$this->rewritten;
			return $this->root_url . $path;
		}
		if ( preg_match( '/\.[a-z0-9]{2,5}$/i', $clean ) ) {
			$this->missing[] = $clean;
		}
		return null;
	}

	/**
	 * HTML: src/href/poster/srcset/style url() references.
	 *
	 * @param string $html     Markup.
	 * @param string $rel_dir  Directory of this file relative to the build root.
	 * @return string
	 */
	public function rewrite_html( $html, $rel_dir = '.' ) {
		$base_dir = '.' === $rel_dir || '' === $rel_dir ? '' : '/' . trim( $rel_dir, '/' );
		$html     = preg_replace_callback(
			'/(\s(?:src|href|poster|data-src|action)\s*=\s*)(["\'])([^"\']*)\2/i',
			function ( $m ) use ( $base_dir ) {
				$url = $this->resolve_url( $m[3], $base_dir );
				return null === $url ? $m[0] : $m[1] . $m[2] . $url . $m[2];
			},
			$html
		);
		$html     = preg_replace_callback(
			'/(\ssrcset\s*=\s*)(["\'])([^"\']*)\2/i',
			function ( $m ) use ( $base_dir ) {
				$parts = array_map(
					function ( $candidate ) use ( $base_dir ) {
						$bits = preg_split( '/\s+/', trim( $candidate ), 2 );
						$url  = $this->resolve_url( $bits[0], $base_dir );
						return ( null === $url ? $bits[0] : $url ) . ( isset( $bits[1] ) ? ' ' . $bits[1] : '' );
					},
					explode( ',', $m[3] )
				);
				return $m[1] . $m[2] . implode( ', ', $parts ) . $m[2];
			},
			$html
		);
		return $this->rewrite_css( $html );
	}

	/**
	 * Resolve an attribute URL: root-relative → job URL; page-relative → absolute
	 * (the route shim moves the document URL, so relative URLs must not depend on it).
	 *
	 * @param string $url      Attribute value.
	 * @param string $base_dir Directory of the HTML file, "" or "/sub".
	 * @return string|null
	 */
	private function resolve_url( $url, $base_dir ) {
		$u = trim( $url );
		if ( '' === $u || preg_match( '#^([a-z][a-z0-9+.-]*:|//|\#|\{\{)#i', $u ) ) {
			return null;
		}
		if ( '/' === $u[0] ) {
			return $this->resolve_root( $u );
		}
		$path = $base_dir . '/' . preg_replace( '#^\./#', '', $u );
		return $this->resolve_root( $path );
	}

	/**
	 * CSS: url(/...).
	 *
	 * @param string $css Stylesheet.
	 * @return string
	 */
	public function rewrite_css( $css ) {
		return (string) preg_replace_callback(
			'/url\(\s*(["\']?)(\/[^"\')]+)\1\s*\)/i',
			function ( $m ) {
				$url = $this->resolve_root( $m[2] );
				return null === $url ? $m[0] : 'url(' . $m[1] . $url . $m[1] . ')';
			},
			$css
		);
	}

	/**
	 * JS: string literals holding a root-relative path to an existing file,
	 * plus Vite's preload base helper (`return"/"+e`).
	 *
	 * @param string $js Script.
	 * @return string
	 */
	public function rewrite_js( $js ) {
		$js   = (string) preg_replace_callback(
			'/(["\'`])(\/[A-Za-z0-9_\-.~@%\/]+\.[A-Za-z0-9]{2,5})\1/',
			function ( $m ) {
				$url = $this->resolve_root( $m[2] );
				return null === $url ? $m[0] : $m[1] . $url . $m[1];
			},
			$js
		);
		$base = $this->root_url . '/';
		return (string) preg_replace( '/return\s*(["\'])\/\1\s*\+/', 'return$1' . $base . '$1+', $js );
	}

	/**
	 * Head injection for the entry document:
	 *  - CSP: captures must not phone home (fetch/XHR/beacons same-origin only),
	 *    forms can't submit anywhere.
	 *  - Route shim: SPAs using BrowserRouter see "/" instead of the job path.
	 *
	 * @param string $html Entry markup.
	 * @return string
	 */
	public static function inject_sandbox( $html ) {
		if ( false !== strpos( $html, 'data-ai2kit-shim' ) ) {
			return $html;
		}
		$head = self::SANDBOX_HEAD;
		if ( preg_match( '/<head\b[^>]*>/i', $html, $m, PREG_OFFSET_CAPTURE ) ) {
			$at = $m[0][1] + strlen( $m[0][0] );
			return substr( $html, 0, $at ) . $head . substr( $html, $at );
		}
		if ( preg_match( '/<html\b[^>]*>/i', $html, $m, PREG_OFFSET_CAPTURE ) ) {
			$at = $m[0][1] + strlen( $m[0][0] );
			return substr( $html, 0, $at ) . '<head>' . $head . '</head>' . substr( $html, $at );
		}
		return '<!doctype html><html><head>' . $head . '<meta charset="utf-8"></head><body>' . $html . '</body></html>';
	}

	/**
	 * The entry HTML as uploaded (without what inject_sandbox() added), for source detection.
	 *
	 * @param string $html Markup.
	 * @return string
	 */
	public static function strip_sandbox( $html ) {
		return str_replace( self::SANDBOX_HEAD, '', $html );
	}
}
