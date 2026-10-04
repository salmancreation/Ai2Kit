<?php
/**
 * Server-side re-validation (PRD FR-23, §12.7 XSS payloads).
 *
 * @package Ai2Kit
 */

use Ai2Kit\Tests\TestCase;
use ModinaTheme\Ai2Kit\Services\Validator;

final class ValidatorTest extends TestCase {

	private function doc( array $elements ) {
		return array( 'title' => '<b>T</b>', 'content' => $elements );
	}

	private function widget( $type, array $settings, $id = 'abcdef1' ) {
		return array( 'id' => $id, 'elType' => 'widget', 'widgetType' => $type, 'settings' => $settings, 'elements' => array() );
	}

	public function test_strips_xss_from_text_and_urls() {
		$out = ( new Validator() )->document(
			$this->doc(
				array(
					$this->widget( 'heading', array( 'title' => 'Hi <script>alert(1)</script><img src=x onerror=alert(2)>' ) ),
					$this->widget( 'button', array( 'text' => '<b onmouseover=alert(3)>Go</b>', 'link' => array( 'url' => 'javascript:alert(4)' ) ), 'abcdef2' ),
					$this->widget( 'video', array( 'youtube_url' => 'javascript:alert(5)' ), 'abcdef3' ),
					$this->widget( 'text-editor', array( 'editor' => '<p onclick="x()">ok</p>' ), 'abcdef4' ),
				)
			)
		);
		$json = wp_json_encode( $out );
		$this->assertStringNotContainsString( 'script', $json );
		$this->assertStringNotContainsString( 'onerror', $json );
		$this->assertStringNotContainsString( 'onmouseover', $json );
		$this->assertStringNotContainsString( 'onclick', $json );
		$this->assertStringNotContainsString( 'javascript', $json );
		$this->assertSame( 'T', $out['title'] );
		$this->assertSame( 'Go', $out['content'][1]['settings']['text'] );
	}

	public function test_nested_accordion_keeps_item_containers_only() {
		$item    = array(
			'id'       => 'abcdef5',
			'elType'   => 'container',
			'settings' => array(),
			'elements' => array( $this->widget( 'text-editor', array( 'editor' => '<p>Yes<script>x</script></p>' ), 'abcdef6' ) ),
		);
		$acc     = $this->widget( 'nested-accordion', array( 'items' => array( array( '_id' => 'abcdef7', 'item_title' => 'Free? <img src=x onerror=y>' ) ) ) );
		$acc['elements'] = array( $item, $this->widget( 'html', array( 'html' => '<script>z</script>' ), 'abcdef8' ) );
		$out     = ( new Validator() )->document( $this->doc( array( $acc ) ) );
		$el      = $out['content'][0];
		$this->assertSame( 'nested-accordion', $el['widgetType'] );
		$this->assertCount( 1, $el['elements'] );
		$this->assertSame( 'container', $el['elements'][0]['elType'] );
		$this->assertStringNotContainsString( '<script', $el['elements'][0]['elements'][0]['settings']['editor'] );
		$this->assertStringNotContainsString( 'onerror', wp_json_encode( $out ) );
	}

	public function test_html_fallback_keeps_scripts_only_with_unfiltered_html() {
		$doc = $this->doc( array( $this->widget( 'html', array( 'html' => '<div>x</div><script>track()</script>' ) ) ) );
		$this->assertStringContainsString( '<script>', ( new Validator() )->document( $doc )['content'][0]['settings']['html'] );

		$deny = static function ( $caps, $cap ) {
			return 'unfiltered_html' === $cap ? array( 'do_not_allow' ) : $caps;
		};
		add_filter( 'map_meta_cap', $deny, 10, 2 );
		$html = ( new Validator() )->document( $doc )['content'][0]['settings']['html'];
		remove_filter( 'map_meta_cap', $deny, 10 );
		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringContainsString( '<div>x</div>', $html );
	}

	public function test_rejects_unknown_elements_and_malformed_documents() {
		$v = new Validator();
		$this->assertWPError( $v->document( array( 'content' => array() ) ) );
		$this->assertWPError( $v->document( 'nope' ) );
		$this->assertWPError( $v->document( $this->doc( array( $this->widget( 'shortcode', array( 'shortcode' => '[x]' ) ) ) ) ) );
		$this->assertWPError( $v->document( $this->doc( array( array( 'elType' => 'section' ) ) ) ) );
	}

	public function test_limits_depth() {
		$el = $this->widget( 'spacer', array() );
		for ( $i = 0; $i < 40; $i++ ) {
			$el = array( 'id' => 'aaaaaaa', 'elType' => 'container', 'settings' => array(), 'elements' => array( $el ) );
		}
		$this->assertWPError( ( new Validator() )->document( $this->doc( array( $el ) ) ) );
	}

	public function test_fixes_ids_drops_bad_keys_and_globals() {
		$out = ( new Validator() )->document(
			$this->doc(
				array(
					$this->widget( 'heading', array( 'title' => 'a', 'bad key!' => 1, '__globals__' => array( 'title_color' => 'globals/colors?id=primary', 'x' => 'http://evil' ) ), 'abcdef1' ),
					$this->widget( 'heading', array( 'title' => 'b' ), 'abcdef1' ),
					$this->widget( 'heading', array( 'title' => 'c' ), 'NOT-HEX' ),
				)
			)
		);
		$ids = wp_list_pluck( $out['content'], 'id' );
		$this->assertSame( 'abcdef1', $ids[0] );
		$this->assertCount( 3, array_unique( $ids ) );
		foreach ( $ids as $id ) {
			$this->assertMatchesRegularExpression( '/^[0-9a-f]{7}$/', $id );
		}
		$this->assertArrayNotHasKey( 'bad key!', $out['content'][0]['settings'] );
		$this->assertSame( array( 'title_color' => 'globals/colors?id=primary' ), $out['content'][0]['settings']['__globals__'] );
	}

	public function test_allows_svg_data_uris_only_as_media_urls() {
		$data = 'data:image/svg+xml;base64,' . base64_encode( '<svg/>' );
		$out  = ( new Validator() )->document( $this->doc( array( $this->widget( 'icon', array( 'selected_icon' => array( 'value' => array( 'url' => $data, 'id' => '' ), 'library' => 'svg' ) ) ) ) ) );
		$this->assertSame( $data, $out['content'][0]['settings']['selected_icon']['value']['url'] );
		$out = ( new Validator() )->document( $this->doc( array( $this->widget( 'image', array( 'image' => array( 'url' => 'data:text/html;base64,PHNjcmlwdD4=', 'id' => '' ) ) ) ) ) );
		$this->assertSame( '', $out['content'][0]['settings']['image']['url'] );
	}

	public function test_add_ons_extend_the_widget_allowlist() {
		$doc = $this->doc( array( $this->widget( 'nested-tabs', array( 'tabs' => array() ) ) ) );
		$this->assertWPError( ( new Validator() )->document( $doc ), 'unknown widgets are rejected' );

		$allow = static function ( $w ) {
			return array_merge( $w, array( 'nested-tabs' ) );
		};
		add_filter( 'ai2kit_allowed_widgets', $allow );
		add_filter( 'ai2kit_nested_widgets', $allow );
		$tabs             = $this->widget( 'nested-tabs', array( 'tabs' => array() ) );
		$tabs['elements'] = array(
			array(
				'id'       => 'bbbbbb1',
				'elType'   => 'container',
				'settings' => array(),
				'elements' => array(),
			),
			array(
				'id'     => 'bbbbbb2',
				'elType' => 'widget',
				'widgetType' => 'heading',
				'settings' => array(),
			),
		);
		$out = ( new Validator() )->document( $this->doc( array( $tabs ) ) );
		remove_filter( 'ai2kit_allowed_widgets', $allow );
		remove_filter( 'ai2kit_nested_widgets', $allow );
		$this->assertIsArray( $out );
		$this->assertSame( 'nested-tabs', $out['content'][0]['widgetType'] );
		// Only child containers are kept in nested widgets.
		$this->assertCount( 1, $out['content'][0]['elements'] );
	}

	public function test_keeps_atomic_interactions_as_plain_data() {
		$item = array(
			'$$type' => 'interaction-item',
			'value'  => array( 'trigger' => array( '$$type' => 'string', 'value' => 'scrollIn' ) ),
		);
		$el   = array(
			'id'           => 'ccccccc',
			'elType'       => 'e-flexbox',
			'settings'     => array(),
			'elements'     => array(),
			'interactions' => array( 'version' => 9, 'items' => array( $item, 'junk', $item, $item, $item, $item, $item ) ),
		);
		$out  = ( new Validator() )->document( $this->doc( array( $el ) ) );
		$this->assertIsArray( $out );
		$kept = $out['content'][0]['interactions'];
		$this->assertSame( 1, $kept['version'] );
		$this->assertCount( 5, $kept['items'] );
		$this->assertSame( $item, $kept['items'][0] );

		$el['interactions'] = 'not an object';
		$out                = ( new Validator() )->document( $this->doc( array( $el ) ) );
		$this->assertArrayNotHasKey( 'interactions', $out['content'][0] );
	}
}
