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

	public function test_media_is_deduplicated_by_hash() {
		list( , $a ) = $this->import_golden();
		list( , $b ) = $this->import_golden();
		$this->assertNotEmpty( $a->get_data()['media']['created'] );
		$this->assertEmpty( $b->get_data()['media']['created'] );
		$this->assertGreaterThan( 0, $b->get_data()['media']['reused'] );
	}
}
