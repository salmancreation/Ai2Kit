<?php
/**
 * Absolute asset path fix (PRD FR-4).
 *
 * @package Ai2Kit
 */

use ModinaTheme\Ai2Kit\Services\AssetRewriter;
use PHPUnit\Framework\TestCase;

final class AssetRewriterTest extends TestCase {

	/** @var string */
	private $dir;

	const URL = 'http://site.test/wp-content/uploads/ai2kit/jobs/j/dist';

	protected function setUp(): void {
		$this->dir = sys_get_temp_dir() . '/a2k-rw-' . bin2hex( random_bytes( 4 ) );
		foreach ( array( 'assets/index-a1.js', 'assets/index-b2.css', 'assets/hero.png', 'lovable-uploads/team photo.jpg', 'favicon.ico', 'img/logo.svg' ) as $f ) {
			@mkdir( dirname( $this->dir . '/' . $f ), 0755, true );
			file_put_contents( $this->dir . '/' . $f, 'x' );
		}
	}

	protected function tearDown(): void {
		exec( 'rm -rf ' . escapeshellarg( $this->dir ) );
	}

	public function test_rewrites_root_relative_html_references_to_existing_files() {
		$rw  = new AssetRewriter( $this->dir, self::URL );
		$out = $rw->rewrite_html( '<script type="module" crossorigin src="/assets/index-a1.js"></script><link rel="icon" href="/favicon.ico"><a href="/about">About</a><img src="/missing.png"><a href="#top">t</a><img src="https://cdn.x/a.png">' );
		$this->assertStringContainsString( 'src="' . self::URL . '/assets/index-a1.js"', $out );
		$this->assertStringContainsString( 'href="' . self::URL . '/favicon.ico"', $out );
		$this->assertStringContainsString( 'href="/about"', $out, 'routes are left for the SPA router' );
		$this->assertStringContainsString( 'src="/missing.png"', $out );
		$this->assertStringContainsString( 'href="#top"', $out );
		$this->assertStringContainsString( 'src="https://cdn.x/a.png"', $out );
		$this->assertSame( 2, $rw->rewritten );
		$this->assertSame( array( '/missing.png' ), $rw->missing );
	}

	public function test_rewrites_relative_html_references_and_srcset() {
		$rw  = new AssetRewriter( $this->dir, self::URL );
		$out = $rw->rewrite_html( '<img src="./assets/hero.png" srcset="assets/hero.png 1x, /assets/hero.png 2x"><img src="img/logo.svg">' );
		$this->assertStringContainsString( 'src="' . self::URL . '/assets/hero.png"', $out );
		$this->assertStringContainsString( 'srcset="' . self::URL . '/assets/hero.png 1x, ' . self::URL . '/assets/hero.png 2x"', $out );
		$this->assertStringContainsString( 'src="' . self::URL . '/img/logo.svg"', $out );
	}

	public function test_rewrites_css_urls() {
		$rw = new AssetRewriter( $this->dir, self::URL );
		$this->assertSame( '.a{background:url("' . self::URL . '/assets/hero.png")} .b{background:url(data:x)}', $rw->rewrite_css( '.a{background:url("/assets/hero.png")} .b{background:url(data:x)}' ) );
	}

	public function test_rewrites_js_literals_and_vite_preload_base() {
		$rw  = new AssetRewriter( $this->dir, self::URL );
		$out = $rw->rewrite_js( 'const a="/lovable-uploads/team photo.jpg";const b=\'/assets/hero.png\';const r="/pricing";const Xe=function(e){return"/"+e};' );
		$this->assertStringContainsString( '"/lovable-uploads/team photo.jpg"', $out, 'spaces are not part of path literals we rewrite' );
		$this->assertStringContainsString( "'" . self::URL . "/assets/hero.png'", $out );
		$this->assertStringContainsString( '"/pricing"', $out );
		$this->assertStringContainsString( 'return"' . self::URL . '/"+e', $out );
	}

	public function test_blocks_traversal_in_references() {
		$rw  = new AssetRewriter( $this->dir, self::URL );
		$out = $rw->rewrite_html( '<img src="/../../../etc/passwd">' );
		$this->assertStringContainsString( 'src="/../../../etc/passwd"', $out );
		$this->assertSame( 0, $rw->rewritten );
	}

	public function test_rewrite_all_processes_files_in_place() {
		file_put_contents( $this->dir . '/index.html', '<script src="/assets/index-a1.js"></script>' );
		file_put_contents( $this->dir . '/assets/index-b2.css', 'body{background:url(/assets/hero.png)}' );
		$rw = new AssetRewriter( $this->dir, self::URL );
		$rw->rewrite_all( array( 'index.html', 'assets/index-b2.css', 'assets/hero.png' ) );
		$this->assertStringContainsString( self::URL . '/assets/index-a1.js', file_get_contents( $this->dir . '/index.html' ) );
		$this->assertStringContainsString( self::URL . '/assets/hero.png', file_get_contents( $this->dir . '/assets/index-b2.css' ) );
	}

	public function test_inject_sandbox() {
		$out = AssetRewriter::inject_sandbox( '<!doctype html><html lang="en"><head><title>x</title></head><body></body></html>' );
		$this->assertMatchesRegularExpression( '/<head><meta http-equiv="Content-Security-Policy" content="connect-src \'self\'[^"]*form-action \'none\'/', $out );
		$this->assertStringContainsString( 'data-ai2kit-shim', $out );
		$this->assertSame( $out, AssetRewriter::inject_sandbox( $out ), 'idempotent' );
		$this->assertStringContainsString( '<head>', AssetRewriter::inject_sandbox( '<html><body>x</body></html>' ) );
		$this->assertStringStartsWith( '<!doctype html>', AssetRewriter::inject_sandbox( '<p>fragment</p>' ) );
	}
}
