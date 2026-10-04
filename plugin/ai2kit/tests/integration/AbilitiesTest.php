<?php
/**
 * Agent tools (PRD M5.5): Ai2Kit abilities through the real Abilities API,
 * which validates input and output against the schemas and checks permissions.
 *
 * @package Ai2Kit
 */

use Ai2Kit\Tests\TestCase;
use ModinaTheme\Ai2Kit\Services\KitWriter;

final class AbilitiesTest extends TestCase {

	public function set_up() {
		parent::set_up();
		if ( ! function_exists( 'wp_get_ability' ) ) {
			$this->markTestSkipped( 'The Abilities API needs WordPress 6.9+.' );
		}
		KitWriter::ensure_kit();
	}

	/**
	 * Execute an ability as the current user.
	 *
	 * @param string $name  Name without namespace.
	 * @param mixed  $input Input.
	 * @return mixed
	 */
	private function run_ability( $name, $input = null ) {
		$ability = wp_get_ability( 'ai2kit/' . $name );
		$this->assertNotNull( $ability, $name . ' is registered' );
		return $ability->execute( $input );
	}

	private function page_html() {
		return '<!doctype html><html><head><title>Agent landing</title></head><body><h1>Hello from an agent</h1></body></html>';
	}

	public function test_registers_public_tools_in_the_ai2kit_category() {
		foreach ( array( 'create-job', 'list-jobs', 'get-job', 'undo-import', 'preflight' ) as $name ) {
			$ability = wp_get_ability( 'ai2kit/' . $name );
			$this->assertNotNull( $ability, $name );
			$this->assertSame( 'ai2kit', $ability->get_category() );
			$this->assertTrue( $ability->get_meta_item( 'mcp' )['public'] );
			$this->assertTrue( $ability->get_meta_item( 'show_in_rest' ) );
		}
		$this->assertTrue( wp_get_ability( 'ai2kit/list-jobs' )->get_meta_item( 'annotations' )['readonly'] );
		$this->assertTrue( wp_get_ability( 'ai2kit/undo-import' )->get_meta_item( 'annotations' )['destructive'] );
	}

	public function test_create_job_from_html_returns_a_review_link() {
		$job = $this->run_ability(
			'create-job',
			array(
				'html'  => $this->page_html(),
				'title' => 'Launch page',
			)
		);
		$this->assertIsArray( $job, is_wp_error( $job ) ? $job->get_error_message() : '' );
		$this->assertSame( 'uploaded', $job['status'] );
		$this->assertSame( 'Launch page', $job['title'] );
		$this->assertStringContainsString( 'page=ai2kit', $job['review_url'] );
		$this->assertStringContainsString( 'job=' . $job['uuid'], $job['review_url'] );
		$this->assertStringContainsString( 'review_url', $job['next_step'] );

		// The Convert screen reopens it: files and the HTML as uploaded (no sandbox shim).
		$res = $this->rest( 'GET', '/jobs/' . $job['uuid'] . '?upload=1' );
		$this->assertSame( 200, $res->get_status() );
		$view = $res->get_data();
		$this->assertSame( array( 'index.html' ), $view['files'] );
		$this->assertStringContainsString( 'Hello from an agent', $view['entryHtml'] );
		$this->assertStringNotContainsString( 'data-ai2kit-shim', $view['entryHtml'] );
		$this->assertStringContainsString( '/index.html', $view['entryUrl'] );
	}

	public function test_create_job_from_a_media_library_file() {
		$file = wp_tempnam( 'agent.html' );
		$path = $file . '.html';
		rename( $file, $path );
		file_put_contents( $path, $this->page_html() );
		$attachment = self::factory()->attachment->create_upload_object( $path );
		unlink( $path );
		$this->assertIsInt( $attachment );

		$job = $this->run_ability( 'create-job', array( 'attachment_id' => $attachment ) );
		$this->assertIsArray( $job, is_wp_error( $job ) ? $job->get_error_message() : '' );
		$this->assertSame( 'Agent landing', $job['title'] );
		$this->assertNotNull( $job['review_url'] );

		$missing = $this->run_ability( 'create-job', array( 'attachment_id' => 999999 ) );
		$this->assertWPError( $missing );
		$this->assertSame( 'ai2kit_no_attachment', $missing->get_error_code() );

		// A post that isn't an attachment is not a file.
		$post = $this->run_ability( 'create-job', array( 'attachment_id' => self::factory()->post->create() ) );
		$this->assertSame( 'ai2kit_no_attachment', $post->get_error_code() );
	}

	public function test_create_job_rejects_bad_input() {
		$this->assertSame( 'ai2kit_bad_input', $this->run_ability( 'create-job', array() )->get_error_code() );
		$both = $this->run_ability(
			'create-job',
			array(
				'html'          => $this->page_html(),
				'attachment_id' => 1,
			)
		);
		$this->assertSame( 'ai2kit_bad_input', $both->get_error_code() );
		// No remote URLs: unknown properties fail schema validation.
		$url = $this->run_ability( 'create-job', array( 'zip_url' => 'https://example.com/site.zip' ) );
		$this->assertSame( 'ability_invalid_input', $url->get_error_code() );
	}

	public function test_only_administrators_can_use_the_tools() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		foreach ( array( 'list-jobs', 'preflight' ) as $name ) {
			$this->assertWPError( $this->run_ability( $name ), $name );
		}
		$this->assertWPError( $this->run_ability( 'create-job', array( 'html' => $this->page_html() ) ) );
	}

	public function test_preflight_reports_checks() {
		$out = $this->run_ability( 'preflight' );
		$this->assertIsArray( $out, is_wp_error( $out ) ? $out->get_error_message() : '' );
		$this->assertIsBool( $out['ready'] );
		$this->assertNotEmpty( $out['checks'] );
		$this->assertArrayHasKey( 'status', $out['checks'][0] );
	}

	public function test_agent_flow_import_report_and_undo() {
		$job = $this->run_ability( 'create-job', array( 'html' => $this->page_html() ) );

		$listed = $this->run_ability( 'list-jobs', array( 'status' => 'uploaded' ) );
		$this->assertContains( $job['uuid'], wp_list_pluck( $listed['jobs'], 'uuid' ) );

		// The user converts and imports in wp-admin (the browser posts the document).
		$golden = $this->golden( 'landing' );
		$res    = $this->rest(
			'POST',
			'/jobs/' . $job['uuid'] . '/import',
			array(
				'document' => $golden['document'],
				'score'    => $golden['overall'],
				'report'   => array_map(
					static function ( $s ) {
						return array(
							'label' => $s['label'],
							'score' => $s['score']['score'],
							'mode'  => $s['mode'],
						);
					},
					$golden['sections']
				),
			)
		);
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );

		$done = $this->run_ability( 'get-job', array( 'uuid' => $job['uuid'] ) );
		$this->assertIsArray( $done, is_wp_error( $done ) ? $done->get_error_message() : '' );
		$this->assertSame( 'imported', $done['status'] );
		$this->assertNull( $done['review_url'] );
		$this->assertSame( $golden['overall'], $done['score'] );
		$this->assertCount( 1, $done['pages'] );
		$this->assertStringContainsString( 'action=elementor', $done['pages'][0]['edit_url'] );
		$this->assertCount( 4, $done['sections'] );
		$page = $done['pages'][0]['id'];

		// Not convertible any more.
		$this->assertSame( 410, $this->rest( 'GET', '/jobs/' . $job['uuid'] . '?upload=1' )->get_status() );

		// Edited after import: the agent must ask first.
		$doc  = \Elementor\Plugin::$instance->documents->get( $page );
		$data = $doc->get_elements_data();
		$data[0]['settings']['_title'] = 'Edited by the user';
		$doc->save( array( 'elements' => $data ) );
		$refused = $this->run_ability( 'undo-import', array( 'uuid' => $job['uuid'] ) );
		$this->assertSame( 'ai2kit_edited_since_import', $refused->get_error_code() );
		$this->assertSame( 'draft', get_post_status( $page ) );

		$undone = $this->run_ability(
			'undo-import',
			array(
				'uuid'           => $job['uuid'],
				'confirm_edited' => true,
			)
		);
		$this->assertIsArray( $undone, is_wp_error( $undone ) ? $undone->get_error_message() : '' );
		$this->assertSame( 1, $undone['trashed'] );
		$this->assertSame( 'trash', get_post_status( $page ) );
		$this->assertSame( 'undone', $this->run_ability( 'get-job', array( 'uuid' => $job['uuid'] ) )['status'] );

		$again = $this->run_ability( 'undo-import', array( 'uuid' => $job['uuid'] ) );
		$this->assertSame( 'ai2kit_not_imported', $again->get_error_code() );
		$this->assertSame( 'ai2kit_not_found', $this->run_ability( 'get-job', array( 'uuid' => wp_generate_uuid4() ) )->get_error_code() );
	}
}
