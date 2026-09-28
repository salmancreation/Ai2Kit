<?php
/**
 * SVG sanitization (PRD §10, §12.7 "SVG with script").
 *
 * @package Ai2Kit
 */

use ModinaTheme\Ai2Kit\Services\SvgSanitizer;
use PHPUnit\Framework\TestCase;

final class SvgSanitizerTest extends TestCase {

	public function test_keeps_a_normal_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgb(124, 58, 237)" stroke-width="2"><path d="M5 12h14"/><circle cx="12" cy="12" r="3"/></svg>';
		$out = SvgSanitizer::sanitize( $svg );
		$this->assertStringContainsString( '<path d="M5 12h14"/>', $out );
		$this->assertStringContainsString( 'stroke="rgb(124, 58, 237)"', $out );
	}

	public function test_strips_scripts_handlers_and_foreign_objects() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><iframe src="x"/></foreignObject><a href="javascript:alert(3)"><path d="M0" onclick="x()"/></a><g><set attributeName="onmouseover" to="alert(4)"/></g></svg>';
		$out = SvgSanitizer::sanitize( $svg );
		$this->assertStringNotContainsString( 'script', $out );
		$this->assertStringNotContainsString( 'onload', $out );
		$this->assertStringNotContainsString( 'onclick', $out );
		$this->assertStringNotContainsString( 'foreignObject', $out );
		$this->assertStringNotContainsString( 'javascript', $out );
		$this->assertStringNotContainsString( '<set', $out );
		$this->assertStringNotContainsString( 'alert', $out );
	}

	public function test_strips_external_references() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.test/x.svg#a"/><use href="#local"/><rect fill="url(https://evil.test/p)"/><rect fill="url(#grad)"/></svg>';
		$out = SvgSanitizer::sanitize( $svg );
		$this->assertStringNotContainsString( 'evil.test', $out );
		$this->assertStringContainsString( 'href="#local"', $out );
		$this->assertStringContainsString( 'url(#grad)', $out );
	}

	public function test_rejects_entities_and_non_svg() {
		$this->assertNull( SvgSanitizer::sanitize( '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>' ) );
		$this->assertNull( SvgSanitizer::sanitize( '<html><body/></html>' ) );
		$this->assertNull( SvgSanitizer::sanitize( 'not xml' ) );
		$this->assertNull( SvgSanitizer::sanitize( '' ) );
	}

	public function test_adds_namespace() {
		$this->assertStringContainsString( 'xmlns="http://www.w3.org/2000/svg"', SvgSanitizer::sanitize( '<svg><path d="M0"/></svg>' ) );
	}
}
