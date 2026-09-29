<?php
/**
 * End-to-end import of a golden engine conversion into real Elementor
 * (PRD M1 acceptance: "valid v3 JSON that imports into Elementor without errors").
 *
 * @package Ai2Kit
 */

use Ai2Kit\Tests\TestCase;
use ModinaTheme\Ai2Kit\Services\JobStore;
use ModinaTheme\Ai2Kit\Services\KitWriter;
use ModinaTheme\Ai2Kit\Services\Paths;

final class ImportTest extends TestCase {

	public function set_up() {
		parent::set_up();
		KitWriter::ensure_kit();
	}

	private function import_golden( array $extra = array() ) {
		$job    = $this->html_job();
		$golden = $this->golden( 'landing' );
		$res    = $this->rest(
			'POST',
			'/jobs/' . $job['uuid'] . '/import',
			array_merge(
				array(
					'document'    => $golden['document'],
					'tokens'      => $golden['tokens'],
					'applyTokens' => true,
					'score'       => $golden['overall'],
					'report'      => array_map(
						static function ( $s ) {
							return array( 'label' => $s['label'], 'score' => $s['score']['score'], 'mode' => $s['mode'] );
						},
						$golden['sections']
					),
				),
				$extra
			)
		);
		return array( $job, $res );
	}

	public function test_imports_a_draft_page_that_elementor_renders() {
		list( $job, $res ) = $this->import_golden();
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$data = $res->get_data();
		$page = $data['created'][0];
		$this->assertSame( 'page', $page['type'] );
		$this->assertSame( 'draft', get_post_status( $page['id'] ) );
		$this->assertSame( 'builder', get_post_meta( $page['id'], '_elementor_edit_mode', true ) );
		$this->assertSame( 'elementor_canvas', get_post_meta( $page['id'], '_wp_page_template', true ) );
		$this->assertStringContainsString( 'action=elementor', $page['editUrl'] );

		// Elementor loads and renders what we saved.
		$document = \Elementor\Plugin::$instance->documents->get( $page['id'] );
		$elements = $document->get_elements_data();
		$this->assertCount( 4, $elements );
		$this->assertSame( 'Header', $elements[0]['settings']['_title'] );
		$html = \Elementor\Plugin::$instance->frontend->get_builder_content( $page['id'], true );
		$this->assertStringContainsString( 'Build <strong>faster</strong> with AI', $html );
		$this->assertStringContainsString( 'elementor-widget-button', $html );
		$this->assertStringContainsString( 'elementor-widget-icon-list', $html );
		$this->assertStringContainsString( 'e-con', $html );
		$this->assertStringContainsString( 'id="features"', $html );

		// Job bookkeeping, and job files are removed after import by default.
		$row = JobStore::get( $job['uuid'] );
		$this->assertSame( 'imported', $row['status'] );
		$this->assertSame( 4, count( $row['result']['sections'] ) );
		$this->assertDirectoryDoesNotExist( Paths::job_dir( $job['uuid'] ) );

		// Custom SVG icon was sanitized into the Media Library and referenced by id.
		$this->assertNotEmpty( $data['media']['created'] );
		$svg_id = $data['media']['created'][0];
		$this->assertSame( 'image/svg+xml', get_post_mime_type( $svg_id ) );
		$this->assertStringContainsString( '"library":"svg"', wp_json_encode( $elements ) );
		$this->assertStringNotContainsString( 'data:image/svg+xml', wp_json_encode( $elements ) );

		// The form fallback is flagged in "Things to check".
		$this->assertContains( 'form', wp_list_pluck( $data['checks'], 'type' ) );
	}

	public function test_merge_mode_adds_custom_globals_and_remaps_references() {
		$before = wp_list_pluck( KitWriter::kit()->get_settings( 'system_colors' ), 'color', '_id' );
		list( , $res ) = $this->import_golden( array( 'kitMode' => 'merge' ) );
		$data   = $res->get_data();
		$kit    = KitWriter::raw_settings();
		$custom = wp_list_pluck( $kit['custom_colors'], 'color', '_id' );
		$this->assertGreaterThan( 0, $data['kit']['colors'] );
		$this->assertSame( $before, wp_list_pluck( $kit['system_colors'], 'color', '_id' ), 'system colors untouched in merge mode' );

		$json = get_post_meta( $data['created'][0]['id'], '_elementor_data', true );
		$this->assertStringNotContainsString( 'globals\/colors?id=primary', $json, 'system refs remapped' );
		preg_match_all( '#globals\\\\/colors\?id=([A-Za-z0-9_-]+)#', $json, $m );
		foreach ( array_unique( $m[1] ) as $id ) {
			$this->assertArrayHasKey( $id, $custom, "global $id exists in the kit" );
		}
	}

	public function test_replace_mode_overwrites_system_colors_and_undo_restores_everything() {
		$before = KitWriter::raw_settings();
		list( $job, $res ) = $this->import_golden( array( 'kitMode' => 'replace' ) );
		$data   = $res->get_data();
		$golden = $this->golden( 'landing' );
		$sys    = wp_list_pluck( KitWriter::raw_settings()['system_colors'], 'color', '_id' );
		foreach ( $golden['tokens']['colors'] as $c ) {
			if ( $c['system'] ) {
				$this->assertSame( $c['hex'], $sys[ $c['id'] ] );
			}
		}

		$check = $this->rest( 'GET', '/jobs/' . $job['uuid'] . '/undo' )->get_data();
		$this->assertFalse( $check['edited'] );

		$undo = $this->rest( 'POST', '/jobs/' . $job['uuid'] . '/undo' )->get_data();
		$this->assertSame( 1, $undo['trashed'] );
		$this->assertTrue( $undo['kitRestored'] );
		$this->assertSame( 'trash', get_post_status( $data['created'][0]['id'] ) );
		$this->assertNull( get_post( $data['media']['created'][0] ) );
		$this->assertEquals( $before, KitWriter::raw_settings() );
		$this->assertSame( 'undone', JobStore::get( $job['uuid'] )['status'] );
		$this->assertSame( 409, $this->rest( 'POST', '/jobs/' . $job['uuid'] . '/undo' )->get_status() );
	}

	public function test_undo_check_detects_edits() {
		list( $job, $res ) = $this->import_golden();
		$id = $res->get_data()['created'][0]['id'];
		wp_update_post( array( 'ID' => $id, 'post_title' => 'Edited by client' ) );
		$this->assertTrue( $this->rest( 'GET', '/jobs/' . $job['uuid'] . '/undo' )->get_data()['edited'] );
	}

	public function test_template_output_and_double_import_guard() {
		list( $job, $res ) = $this->import_golden( array( 'output' => 'template', 'title' => 'Landing kit' ) );
		$created = $res->get_data()['created'][0];
		$this->assertSame( 'template', $created['type'] );
		$this->assertSame( 'elementor_library', get_post_type( $created['id'] ) );
		$this->assertSame( 'page', get_post_meta( $created['id'], '_elementor_template_type', true ) );
		$this->assertSame( 'Landing kit', get_the_title( $created['id'] ) );
		$again = $this->rest( 'POST', '/jobs/' . $job['uuid'] . '/import', array( 'document' => $this->golden( 'landing' )['document'] ) );
		$this->assertSame( 409, $again->get_status() );
	}

	public function test_residual_css_is_stored_scoped_and_printed_with_the_document() {
		$golden                         = $this->golden( 'landing' );
		$golden['document']['residual'] = array(
			array( 'className' => 'a2k-r-test123', 'target' => ' .elementor-heading-title', 'breakpoint' => 'desktop', 'decls' => array( 'background-image' => 'linear-gradient(90deg, #7c3aed, #2563eb)', '-webkit-background-clip' => 'text', 'color' => 'transparent' ), 'label' => 'Hero' ),
			array( 'className' => 'a2k-r-evil', 'breakpoint' => 'desktop', 'decls' => array( 'color' => 'red}</style><script>alert(1)</script>' ) ),
		);
		$job = $this->html_job();
		$res = $this->rest( 'POST', '/jobs/' . $job['uuid'] . '/import', array( 'document' => $golden['document'] ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$id  = $res->get_data()['created'][0]['id'];
		$css = get_post_meta( $id, '_ai2kit_residual_css', true );
		$this->assertStringContainsString( ".elementor-{$id} .a2k-r-test123 .elementor-heading-title{", $css );
		$this->assertStringNotContainsString( 'script', $css );
		$this->assertSame( 1, $res->get_data()['residual'] );

		// Rendering the document enqueues its CSS file, which attaches the residual CSS.
		\Elementor\Plugin::$instance->frontend->get_builder_content( $id, true );
		$this->assertTrue( wp_style_is( 'ai2kit-residual-' . $id, 'enqueued' ) );
		$this->assertStringContainsString( 'a2k-r-test123', implode( '', (array) wp_styles()->get_data( 'ai2kit-residual-' . $id, 'after' ) ) );
	}

	public function test_svg_icons_import_once_render_and_fall_back_when_invalid() {
		$svg  = 'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" fill="none" stroke="rgb(22, 163, 74)" stroke-width="2"/></svg>' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$bad  = 'data:image/svg+xml;base64,' . base64_encode( '<html>not an svg</html>' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$icon = static function ( $url, $fallback = null ) {
			$v = array(
				'value'   => array(
					'url' => $url,
					'id'  => '',
				),
				'library' => 'svg',
			);
			if ( $fallback ) {
				$v['fallback'] = $fallback;
			}
			return $v;
		};
		$media = new \ModinaTheme\Ai2Kit\Services\MediaImporter( wp_generate_uuid4(), false );
		$out   = $media->process(
			array(
				array( 'id' => 'a000001', 'elType' => 'widget', 'widgetType' => 'icon', 'settings' => array( 'selected_icon' => $icon( $svg, 'fas fa-check' ) ), 'elements' => array() ),
				array( 'id' => 'a000002', 'elType' => 'widget', 'widgetType' => 'icon', 'settings' => array( 'selected_icon' => $icon( $svg ) ), 'elements' => array() ),
				array( 'id' => 'a000003', 'elType' => 'widget', 'widgetType' => 'icon', 'settings' => array( 'selected_icon' => $icon( $bad, 'fas fa-star' ) ), 'elements' => array() ),
				array( 'id' => 'a000004', 'elType' => 'widget', 'widgetType' => 'icon', 'settings' => array( 'selected_icon' => $icon( $bad ) ), 'elements' => array() ),
			)
		);
		$first = $out[0]['settings']['selected_icon'];
		$this->assertSame( 'svg', $first['library'] );
		$this->assertArrayNotHasKey( 'fallback', $first );
		$this->assertGreaterThan( 0, $first['value']['id'] );
		$this->assertSame( $first['value']['id'], $out[1]['settings']['selected_icon']['value']['id'], 'The same icon is uploaded once.' );
		$this->assertStringContainsString( 'stroke="rgb(22, 163, 74)"', \Elementor\Core\Files\File_Types\Svg::get_inline_svg( $first['value']['id'] ) );
		$this->assertSame( array( 'value' => 'fas fa-star', 'library' => 'fa-solid' ), $out[2]['settings']['selected_icon'] );
		$this->assertSame( '', $out[3]['settings']['selected_icon']['library'] );
		$this->assertSame( 2, $media->icon_fallbacks );
	}

	public function test_media_is_deduplicated_by_hash() {
		list( , $a ) = $this->import_golden();
		list( , $b ) = $this->import_golden();
		$this->assertNotEmpty( $a->get_data()['media']['created'] );
		$this->assertEmpty( $b->get_data()['media']['created'] );
		$this->assertGreaterThan( 0, $b->get_data()['media']['reused'] );
	}
}
