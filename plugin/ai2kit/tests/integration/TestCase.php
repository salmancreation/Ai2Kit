<?php
/**
 * Shared helpers for integration tests.
 *
 * @package Ai2Kit
 */

namespace Ai2Kit\Tests;

use ModinaTheme\Ai2Kit\Services\Jobs;

abstract class TestCase extends \WP_UnitTestCase {

	/** @var int */
	protected $admin;

	public function set_up() {
		parent::set_up();
		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );
		if ( is_multisite() ) {
			grant_super_admin( $this->admin );
		}
		wp_set_current_user( $this->admin );
		// Test uploads are not real HTTP uploads.
		add_filter( 'ai2kit_trust_upload_path', '__return_true' );
		// Remote sideloading is off in tests: no network.
		update_option( 'ai2kit_settings', array( 'importRemote' => false ) );
	}

	protected function assert_post_conditions() {
		// Elementor's bundled MCP Adapter looks up its own abilities on first use, which the
		// Abilities API reports as incorrect usage when they aren't registered. Not ours.
		unset( $this->caught_doing_it_wrong['WP_Abilities_Registry::get_registered'] );
		parent::assert_post_conditions();
	}

	/**
	 * Golden engine output for a named source.
	 *
	 * @param string $name Fixture name.
	 * @return array
	 */
	protected function golden( $name ) {
		return json_decode( (string) file_get_contents( AI2KIT_FIXTURES . '/elementor/generated/' . $name . '.json' ), true );
	}

	/**
	 * A job created from pasted HTML.
	 *
	 * @param string $html Markup.
	 * @return array
	 */
	protected function html_job( $html = '<!doctype html><html><head><title>Fixture</title></head><body><h1>Hi</h1></body></html>' ) {
		return Jobs::from_html( $html );
	}

	/**
	 * Call a REST route as the current user.
	 *
	 * @param string $method Method.
	 * @param string $route  Route below /ai2kit/v1.
	 * @param array  $body   JSON body.
	 * @param array  $files  File params.
	 * @return \WP_REST_Response
	 */
	protected function rest( $method, $route, array $body = array(), array $files = array() ) {
		$query = array();
		if ( false !== strpos( $route, '?' ) ) {
			list( $route, $qs ) = explode( '?', $route, 2 );
			parse_str( $qs, $query );
		}
		$req = new \WP_REST_Request( $method, '/ai2kit/v1' . $route );
		$req->set_query_params( $query );
		if ( $body ) {
			$req->set_header( 'content-type', 'application/json' );
			$req->set_body( wp_json_encode( $body ) );
		}
		if ( $files ) {
			$req->set_file_params( $files );
		}
		return rest_do_request( $req );
	}
}
