<?php
/**
 * REST API: ai2kit/v1 (PRD §9).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Rest;

use ModinaTheme\Ai2Kit\Services\IngestException;
use ModinaTheme\Ai2Kit\Services\Importer;
use ModinaTheme\Ai2Kit\Services\Jobs;
use ModinaTheme\Ai2Kit\Services\JobStore;
use ModinaTheme\Ai2Kit\Services\Preflight;
use ModinaTheme\Ai2Kit\Services\Rollback;
use ModinaTheme\Ai2Kit\Services\Settings;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Routes.
 */
final class Routes {

	const NS = 'ai2kit/v1';

	/**
	 * Register routes.
	 *
	 * @return void
	 */
	public function register() {
		$admin = array( $this, 'can_manage' );
		$uuid  = '(?P<uuid>[0-9a-f-]{36})';

		register_rest_route(
			self::NS,
			'/jobs',
			array(
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_job' ),
					'permission_callback' => $admin,
					'args'                => array(
						'html' => array(
							'type'     => 'string',
							'required' => false,
						),
					),
				),
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'list_jobs' ),
					'permission_callback' => $admin,
				),
			)
		);
		register_rest_route(
			self::NS,
			'/jobs/' . $uuid,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_job' ),
					'permission_callback' => $admin,
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'discard_job' ),
					'permission_callback' => $admin,
				),
			)
		);
		register_rest_route(
			self::NS,
			'/jobs/' . $uuid . '/import',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'import' ),
				'permission_callback' => $admin,
			)
		);
		register_rest_route(
			self::NS,
			'/jobs/' . $uuid . '/undo',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'undo_check' ),
					'permission_callback' => $admin,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'undo' ),
					'permission_callback' => $admin,
				),
			)
		);
		register_rest_route(
			self::NS,
			'/preflight',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'preflight' ),
					'permission_callback' => $admin,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'preflight_fix' ),
					'permission_callback' => $admin,
					'args'                => array(
						'check' => array(
							'type'     => 'string',
							'required' => true,
						),
					),
				),
			)
		);
		register_rest_route(
			self::NS,
			'/settings',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => static function () {
						return rest_ensure_response( Settings::all() );
					},
					'permission_callback' => $admin,
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => static function ( WP_REST_Request $request ) {
						return rest_ensure_response( Settings::update( (array) $request->get_json_params() ) );
					},
					'permission_callback' => $admin,
				),
			)
		);
	}

	/**
	 * Every route requires manage_options (PRD §10).
	 *
	 * @return bool
	 */
	public function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Upload a file (multipart "file") or pasted HTML ("html").
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_job( WP_REST_Request $request ) {
		$files = $request->get_file_params();
		try {
			if ( ! empty( $files['file'] ) ) {
				$job = Jobs::from_upload( $files['file'] );
			} elseif ( is_string( $request->get_param( 'html' ) ) && '' !== trim( $request->get_param( 'html' ) ) ) {
				$job = Jobs::from_html( (string) $request->get_param( 'html' ) );
			} else {
				return new WP_Error( 'ai2kit_no_input', __( 'Choose a file or paste some HTML to convert.', 'ai2kit' ), array( 'status' => 400 ) );
			}
		} catch ( IngestException $e ) {
			return new WP_Error(
				$e->slug,
				$e->getMessage(),
				array(
					'status' => $e->status,
					'hint'   => $e->hint,
				)
			);
		}
		return new WP_REST_Response( $job, 201 );
	}

	/**
	 * History.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function list_jobs( WP_REST_Request $request ) {
		$page = max( 1, (int) $request->get_param( 'page' ) );
		$rows = JobStore::recent( 50, ( $page - 1 ) * 50 );
		return rest_ensure_response( array_map( array( Jobs::class, 'public_view' ), $rows ) );
	}

	/**
	 * One job.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_job( WP_REST_Request $request ) {
		$job = JobStore::get( (string) $request['uuid'] );
		if ( ! $job ) {
			return new WP_Error( 'ai2kit_not_found', __( 'This conversion no longer exists.', 'ai2kit' ), array( 'status' => 404 ) );
		}
		// ?upload=1: everything the Convert screen needs to continue an uploaded job (opened by link).
		if ( $request->get_param( 'upload' ) ) {
			$view = Jobs::upload_view( $job );
			if ( ! $view ) {
				return new WP_Error( 'ai2kit_not_convertible', __( 'This conversion was already imported, or its files were cleaned up. Start a new one.', 'ai2kit' ), array( 'status' => 410 ) );
			}
			return rest_ensure_response( $view );
		}
		return rest_ensure_response( Jobs::public_view( $job ) );
	}

	/**
	 * Discard an un-imported job and its files.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function discard_job( WP_REST_Request $request ) {
		$job = JobStore::get( (string) $request['uuid'] );
		if ( ! $job ) {
			return new WP_Error( 'ai2kit_not_found', __( 'This conversion no longer exists.', 'ai2kit' ), array( 'status' => 404 ) );
		}
		Jobs::discard( $job );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * Import the converted document (PRD FR-23 … FR-26).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function import( WP_REST_Request $request ) {
		$job = JobStore::get( (string) $request['uuid'] );
		if ( ! $job ) {
			return new WP_Error( 'ai2kit_not_found', __( 'This conversion no longer exists.', 'ai2kit' ), array( 'status' => 404 ) );
		}
		if ( 'imported' === $job['status'] ) {
			return new WP_Error( 'ai2kit_already_imported', __( 'This conversion was already imported. Start a new one to import again.', 'ai2kit' ), array( 'status' => 409 ) );
		}
		$result = ( new Importer() )->run( $job, (array) $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			JobStore::update( $job['uuid'], array( 'status' => 'failed' ) );
			return $result;
		}
		return rest_ensure_response( $result );
	}

	/**
	 * Whether created items were edited since import (DESIGN.md §6.3).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function undo_check( WP_REST_Request $request ) {
		$job = JobStore::get( (string) $request['uuid'] );
		if ( ! $job ) {
			return new WP_Error( 'ai2kit_not_found', __( 'This conversion no longer exists.', 'ai2kit' ), array( 'status' => 404 ) );
		}
		return rest_ensure_response( Rollback::check( $job ) );
	}

	/**
	 * Undo an import (PRD FR-28).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function undo( WP_REST_Request $request ) {
		$job = JobStore::get( (string) $request['uuid'] );
		if ( ! $job ) {
			return new WP_Error( 'ai2kit_not_found', __( 'This conversion no longer exists.', 'ai2kit' ), array( 'status' => 404 ) );
		}
		if ( 'imported' !== $job['status'] ) {
			return new WP_Error( 'ai2kit_not_imported', __( 'Only imported conversions can be undone.', 'ai2kit' ), array( 'status' => 409 ) );
		}
		return rest_ensure_response( Rollback::run( $job ) );
	}

	/**
	 * Preflight checks (PRD FR-32).
	 *
	 * @return WP_REST_Response
	 */
	public function preflight() {
		return rest_ensure_response( Preflight::run() );
	}

	/**
	 * One-click fix.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function preflight_fix( WP_REST_Request $request ) {
		$fixed = Preflight::fix( sanitize_key( (string) $request->get_param( 'check' ) ) );
		if ( is_wp_error( $fixed ) ) {
			return $fixed;
		}
		return rest_ensure_response( Preflight::run() );
	}
}
