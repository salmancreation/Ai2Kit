<?php
/**
 * Elementor v4 (Atomic) import (PRD §8.2, M4): Elementor's own converter and
 * parsers turn the engine's CSS into typed styles; the page renders atomically.
 *
 * @package Ai2Kit
 */

use Ai2Kit\Tests\TestCase;
use ModinaTheme\Ai2Kit\Services\AtomicWriter;
use ModinaTheme\Ai2Kit\Services\KitWriter;

final class AtomicImportTest extends TestCase {

	public function set_up() {
		parent::set_up();
		KitWriter::ensure_kit();
		if ( ! AtomicWriter::available() ) {
			$this->markTestSkipped( 'Atomic elements are not active in this Elementor.' );
		}
	}

	private function find( array $elements, callable $pred ) {
		foreach ( $elements as $el ) {
			if ( $pred( $el ) ) {
				return $el;
			}
			$hit = $this->find( $el['elements'] ?? array(), $pred );
			if ( $hit ) {
				return $hit;
			}
		}
		return null;
	}

	public function test_imports_and_renders_atomic_elements_with_converted_styles() {
		$golden = $this->golden( 'landing-v4' );
		$job    = $this->html_job();
		$res    = $this->rest( 'POST', '/jobs/' . $job['uuid'] . '/import', array( 'document' => $golden['document'] ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$id   = $res->get_data()['created'][0]['id'];
		$data = json_decode( get_post_meta( $id, '_elementor_data', true ), true );

		$this->assertSame( 'e-flexbox', $data[0]['elType'] );
		$h1 = $this->find( $data, static function ( $el ) {
			return 'e-heading' === ( $el['widgetType'] ?? '' ) && 'h1' === ( $el['settings']['tag']['value'] ?? '' );
		} );
		$this->assertNotNull( $h1 );
		$this->assertSame( 'Build <strong>faster</strong> with AI', $h1['settings']['title']['value'] );

		// The CSS became typed props through Elementor's converter, in a local class style.
		$style_id = $h1['settings']['classes']['value'][0];
		$this->assertMatchesRegularExpression( '/^e-[0-9a-f]{7}-a2k$/', $style_id );
		$variants = $h1['styles'][ $style_id ]['variants'];
		$desktop  = $variants[0]['props'];
		$this->assertSame( 'size', $desktop['font-size']['$$type'] );
		$this->assertEquals( array( 'size' => 56, 'unit' => 'px' ), $desktop['font-size']['value'] );
		$this->assertSame( 'color', $desktop['color']['$$type'] );
		$mobile = array_values( array_filter( $variants, static function ( $v ) {
			return 'mobile' === $v['meta']['breakpoint'];
		} ) );
		$this->assertEquals( array( 'size' => 36, 'unit' => 'px' ), $mobile[0]['props']['font-size']['value'] );

		// Mixed tree: an icon list stays a v3 widget.
		$this->assertNotNull( $this->find( $data, static function ( $el ) {
			return 'icon-list' === ( $el['widgetType'] ?? '' );
		} ) );

		// Media inside atomic images was imported and referenced by id.
		$img = $this->find( $data, static function ( $el ) {
			return 'e-image' === ( $el['widgetType'] ?? '' );
		} );
		$this->assertNotNull( $img );

		// Elementor renders atomic markup with the local style class.
		$html = \Elementor\Plugin::$instance->frontend->get_builder_content( $id, true );
		$this->assertStringContainsString( 'e-flexbox-base', $html );
		$this->assertMatchesRegularExpression( '/<h1[^>]*class="[^"]*' . preg_quote( $style_id, '/' ) . '/', $html );
		$this->assertStringContainsString( 'elementor-widget-icon-list', $html );
	}

	public function test_hostile_css_and_settings_are_neutralised() {
		$golden                      = $this->golden( 'landing-v4' );
		$doc                         = $golden['document'];
		$doc['content'][0]['css']    = array( 'desktop' => 'color: red; } body { display:none } @import "x"; background: url(javascript:alert(1));' );
		$doc['content'][0]['settings']['tag'] = array( '$$type' => 'string', 'value' => 'script' );
		$job = $this->html_job();
		$res = $this->rest( 'POST', '/jobs/' . $job['uuid'] . '/import', array( 'document' => $doc ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$raw = get_post_meta( $res->get_data()['created'][0]['id'], '_elementor_data', true );
		$this->assertStringNotContainsString( 'javascript', $raw );
		$this->assertStringNotContainsString( '"script"', $raw, 'invalid enum values are dropped by Elementor\'s parser' );
		$this->assertStringNotContainsString( '@import', $raw );
	}
}
