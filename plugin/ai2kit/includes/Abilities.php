<?php
/**
 * Agent tools (PRD §5.1, M5.5): WordPress Abilities that AI agents can call.
 * The MCP Adapter plugin exposes them as MCP tools (Claude Desktop, Cursor …).
 *
 * Local only — no external requests. Conversion itself needs a browser, so an
 * agent creates a job and hands the user its review link; everything around it
 * (checks, status, report, undo) is callable directly.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit;

use ModinaTheme\Ai2Kit\Services\IngestException;
use ModinaTheme\Ai2Kit\Services\Jobs;
use ModinaTheme\Ai2Kit\Services\JobStore;
use ModinaTheme\Ai2Kit\Services\Paths;
use ModinaTheme\Ai2Kit\Services\Preflight;
use ModinaTheme\Ai2Kit\Services\Rollback;
use WP_Error;

// phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Messages are returned as ability data (JSON), not printed.

defined( 'ABSPATH' ) || exit;

/**
 * Abilities.
 */
final class Abilities {

	const CATEGORY = 'ai2kit';

	const UUID_PATTERN = '^[0-9a-f-]{36}$';

	/**
	 * Hook in when the Abilities API exists (WordPress 6.9+).
	 *
	 * @return void
	 */
	public static function register() {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}
		add_action( 'wp_abilities_api_categories_init', array( __CLASS__, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( __CLASS__, 'register_abilities' ) );
	}

	/**
	 * Category.
	 *
	 * @return void
	 */
	public static function register_category() {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}
		wp_register_ability_category(
			self::CATEGORY,
			array(
				'label'       => __( 'Ai2Kit', 'ai2kit' ),
				'description' => __( 'Convert AI-built websites (Lovable, Bolt, v0, HTML) into editable Elementor pages.', 'ai2kit' ),
			)
		);
	}

	/**
	 * Abilities.
	 *
	 * @return void
	 */
	public static function register_abilities() {
		foreach ( self::definitions() as $name => $args ) {
			wp_register_ability( 'ai2kit/' . $name, $args );
		}
	}

	/**
	 * Ability definitions, keyed by name without the namespace.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function definitions() {
		$uuid = array(
			'type'        => 'string',
			'pattern'     => self::UUID_PATTERN,
			'description' => __( 'The conversion job ID (a UUID) from ai2kit/create-job or ai2kit/list-jobs.', 'ai2kit' ),
		);
		$job  = self::job_schema();

		return array(
			'create-job'  => array(
				'label'               => __( 'Create a conversion job', 'ai2kit' ),
				'description'         => __( 'Prepares an AI-built website for conversion into an Elementor page. Give either the full HTML of a page (for example one you generated), or the attachment ID of a .zip or .html file in the Media Library (a built Lovable, Bolt or v0 dist folder, or an HTML template). Remote URLs are not accepted. The conversion runs in the browser: give the returned review_url to the user, who opens it in wp-admin, clicks "Start conversion", reviews and imports. Then use ai2kit/get-job to read the result.', 'ai2kit' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'html'          => array(
							'type'        => 'string',
							'minLength'   => 1,
							'maxLength'   => 5 * MB_IN_BYTES,
							'description' => __( 'A complete HTML page (inline CSS, or Tailwind from its CDN, is fine).', 'ai2kit' ),
						),
						'attachment_id' => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Media Library attachment ID of a .zip or .html file.', 'ai2kit' ),
						),
						'title'         => array(
							'type'        => 'string',
							'maxLength'   => 200,
							'description' => __( 'Optional title for the page or template. Defaults to the page\'s <title>.', 'ai2kit' ),
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => $job,
				'execute_callback'    => array( __CLASS__, 'create_job' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'meta'                => self::meta( false, false, false ),
			),
			'list-jobs'   => array(
				'label'               => __( 'List conversions', 'ai2kit' ),
				'description'         => __( 'Lists recent Ai2Kit conversions, newest first: imported pages with their edit links and scores, jobs waiting to be converted, undone and failed ones.', 'ai2kit' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'                 => 'object',
					'default'              => array(),
					'properties'           => array(
						'status' => array(
							'type'        => 'string',
							'enum'        => JobStore::STATUSES,
							'description' => __( 'Only jobs with this status. "uploaded" means waiting to be converted.', 'ai2kit' ),
						),
						'limit'  => array(
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => 50,
							'default' => 20,
						),
					),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'jobs' => array(
							'type'  => 'array',
							'items' => $job,
						),
					),
					'required'   => array( 'jobs' ),
				),
				'execute_callback'    => array( __CLASS__, 'list_jobs' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'meta'                => self::meta( true, false, true ),
			),
			'get-job'     => array(
				'label'               => __( 'Get a conversion', 'ai2kit' ),
				'description'         => __( 'Status and report of one conversion: created pages (edit and view links), overall and per-section match scores, which sections were kept as HTML, and anything to check after import (forms, images, icons).', 'ai2kit' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array( 'uuid' => $uuid ),
					'required'             => array( 'uuid' ),
					'additionalProperties' => false,
				),
				'output_schema'       => $job,
				'execute_callback'    => array( __CLASS__, 'get_job' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'meta'                => self::meta( true, false, true ),
			),
			'undo-import' => array(
				'label'               => __( 'Undo an import', 'ai2kit' ),
				'description'         => __( 'Undoes an imported conversion: moves its pages to the trash, deletes the images it added and restores the previous Global Colors and Fonts. Refuses when the pages were edited since import unless confirm_edited is true — ask the user first.', 'ai2kit' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'uuid'           => $uuid,
						'confirm_edited' => array(
							'type'        => 'boolean',
							'default'     => false,
							'description' => __( 'Undo even if the pages were edited after import (those edits are lost from the page, which stays in the trash).', 'ai2kit' ),
						),
					),
					'required'             => array( 'uuid' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'trashed'       => array( 'type' => 'integer' ),
						'media_deleted' => array( 'type' => 'integer' ),
						'kit_restored'  => array( 'type' => 'boolean' ),
					),
					'required'   => array( 'trashed', 'media_deleted', 'kit_restored' ),
				),
				'execute_callback'    => array( __CLASS__, 'undo_import' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'meta'                => self::meta( false, true, true ),
			),
			'preflight'   => array(
				'label'               => __( 'Check the site', 'ai2kit' ),
				'description'         => __( 'Checks that this site can import conversions: Elementor version, Flexbox Container, SVG uploads, memory, time and upload limits, and whether the current user may convert sites that run JavaScript. Blocking checks must be fixed in wp-admin → Ai2Kit first.', 'ai2kit' ),
				'category'            => self::CATEGORY,
				'input_schema'        => array(
					'type'                 => 'object',
					'default'              => array(),
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'ready'  => array( 'type' => 'boolean' ),
						'checks' => array(
							'type'  => 'array',
							'items' => array(
								'type'       => 'object',
								'properties' => array(
									'id'     => array( 'type' => 'string' ),
									'status' => array(
										'type' => 'string',
										'enum' => array( 'success', 'warning', 'blocking' ),
									),
									'title'  => array( 'type' => 'string' ),
									'detail' => array( 'type' => 'string' ),
								),
							),
						),
					),
					'required'   => array( 'ready', 'checks' ),
				),
				'execute_callback'    => array( __CLASS__, 'preflight' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'meta'                => self::meta( true, false, true ),
			),
		);
	}

	/**
	 * Every ability requires manage_options, like the REST routes (PRD §10).
	 *
	 * @return bool
	 */
	public static function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Execute: create-job.
	 *
	 * @param array<string, mixed> $input Input.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function create_job( $input ) {
		$input = (array) $input;
		$html  = isset( $input['html'] ) ? (string) $input['html'] : '';
		$id    = isset( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0;
		if ( ( '' === trim( $html ) ) === ( 0 === $id ) ) {
			return new WP_Error( 'ai2kit_bad_input', __( 'Give either html or attachment_id (exactly one).', 'ai2kit' ), array( 'status' => 400 ) );
		}
		try {
			$view = $id ? Jobs::from_attachment( $id ) : Jobs::from_html( $html );
		} catch ( IngestException $e ) {
			return new WP_Error(
				$e->slug,
				$e->hint ? $e->getMessage() . ' ' . $e->hint : $e->getMessage(),
				array( 'status' => $e->status )
			);
		}
		$title = isset( $input['title'] ) ? sanitize_text_field( (string) $input['title'] ) : '';
		if ( '' !== $title ) {
			JobStore::update( $view['uuid'], array( 'title' => $title ) );
		}
		$job = JobStore::get( $view['uuid'] );
		return $job ? self::summary( $job ) : new WP_Error( 'ai2kit_db', __( 'We couldn\'t save this conversion.', 'ai2kit' ), array( 'status' => 500 ) );
	}

	/**
	 * Execute: list-jobs.
	 *
	 * @param array<string, mixed>|null $input Input.
	 * @return array{ jobs: array<int, array<string, mixed>> }
	 */
	public static function list_jobs( $input = null ) {
		$input  = (array) $input;
		$status = isset( $input['status'] ) ? (string) $input['status'] : '';
		$limit  = isset( $input['limit'] ) ? max( 1, min( 50, (int) $input['limit'] ) ) : 20;
		$jobs   = array();
		foreach ( JobStore::recent( 50 ) as $job ) {
			if ( '' === $status || $status === $job['status'] ) {
				$jobs[] = self::summary( $job );
			}
		}
		return array( 'jobs' => array_slice( $jobs, 0, $limit ) );
	}

	/**
	 * Execute: get-job.
	 *
	 * @param array<string, mixed> $input Input.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function get_job( $input ) {
		$job = self::find( $input );
		return is_wp_error( $job ) ? $job : self::summary( $job );
	}

	/**
	 * Execute: undo-import.
	 *
	 * @param array<string, mixed> $input Input.
	 * @return array<string, mixed>|WP_Error
	 */
	public static function undo_import( $input ) {
		$job = self::find( $input );
		if ( is_wp_error( $job ) ) {
			return $job;
		}
		if ( 'imported' !== $job['status'] ) {
			return new WP_Error( 'ai2kit_not_imported', __( 'Only imported conversions can be undone.', 'ai2kit' ), array( 'status' => 409 ) );
		}
		if ( empty( $input['confirm_edited'] ) && Rollback::check( $job )['edited'] ) {
			return new WP_Error( 'ai2kit_edited_since_import', __( 'These pages were edited after import. Ask the user, then call again with confirm_edited: true to undo anyway.', 'ai2kit' ), array( 'status' => 409 ) );
		}
		$done = Rollback::run( $job );
		return array(
			'trashed'       => (int) $done['trashed'],
			'media_deleted' => (int) $done['mediaDeleted'],
			'kit_restored'  => (bool) $done['kitRestored'],
		);
	}

	/**
	 * Execute: preflight.
	 *
	 * @return array<string, mixed>
	 */
	public static function preflight() {
		$run    = Preflight::run();
		$checks = array();
		foreach ( $run['checks'] as $c ) {
			$checks[] = array(
				'id'     => (string) $c['id'],
				'status' => (string) $c['status'],
				'title'  => wp_strip_all_tags( (string) $c['title'] ),
				'detail' => wp_strip_all_tags( (string) $c['detail'] ),
			);
		}
		return array(
			'ready'  => (bool) $run['ready'],
			'checks' => $checks,
		);
	}

	/**
	 * Look up the job named by input.uuid.
	 *
	 * @param mixed $input Input.
	 * @return array<string, mixed>|WP_Error
	 */
	private static function find( $input ) {
		$job = JobStore::get( (string) ( ( (array) $input )['uuid'] ?? '' ) );
		return $job ? $job : new WP_Error( 'ai2kit_not_found', __( 'This conversion no longer exists.', 'ai2kit' ), array( 'status' => 404 ) );
	}

	/**
	 * A job as agents see it: snake_case, links, and the next step.
	 *
	 * @param array<string, mixed> $job Row.
	 * @return array<string, mixed>
	 */
	public static function summary( array $job ) {
		$view   = Jobs::public_view( $job );
		$result = is_array( $job['result'] ) ? $job['result'] : array();

		$pages = array();
		foreach ( (array) ( $result['created'] ?? array() ) as $c ) {
			$pages[] = array(
				'id'       => (int) ( $c['id'] ?? 0 ),
				'type'     => (string) ( $c['type'] ?? '' ),
				'title'    => (string) ( $c['title'] ?? '' ),
				'edit_url' => (string) ( $c['editUrl'] ?? '' ),
				'view_url' => (string) ( $c['viewUrl'] ?? '' ),
			);
		}
		$sections = array();
		foreach ( (array) ( $result['sections'] ?? array() ) as $s ) {
			$sections[] = array(
				'label' => (string) ( $s['label'] ?? '' ),
				'score' => (int) ( $s['score'] ?? 0 ),
				'mode'  => (string) ( $s['mode'] ?? '' ),
			);
		}
		$checks = array();
		foreach ( (array) ( $result['checks'] ?? array() ) as $c ) {
			$checks[] = (string) ( $c['text'] ?? '' );
		}

		$convertible = 'uploaded' === $job['status'] && is_dir( Paths::job_dir( $job['uuid'] ) );
		switch ( $job['status'] ) {
			case 'uploaded':
				$next = $convertible
					? __( 'Waiting for conversion. Give the user review_url: they open it in wp-admin, click "Start conversion", review the sections and click "Import to WordPress". Then call ai2kit/get-job.', 'ai2kit' )
					: __( 'The uploaded files were cleaned up. Create a new job.', 'ai2kit' );
				break;
			case 'imported':
				$next = __( 'Imported as a draft. Share edit_url so the user can review and publish it in Elementor. ai2kit/undo-import reverts it.', 'ai2kit' );
				break;
			case 'undone':
				$next = __( 'This import was undone.', 'ai2kit' );
				break;
			default:
				$next = __( 'The import failed. Ask the user to try again from wp-admin → Ai2Kit, where the error is shown.', 'ai2kit' );
		}

		return array(
			'uuid'        => $job['uuid'],
			'title'       => (string) $job['title'],
			'status'      => $job['status'],
			'source_type' => (string) $job['source_type'],
			'score'       => $job['score'],
			'created_at'  => $view['createdAt'],
			'imported_at' => $view['importedAt'],
			'review_url'  => $convertible ? Jobs::review_url( $job['uuid'] ) : null,
			'pages'       => $pages,
			'sections'    => $sections,
			'checks'      => $checks,
			'next_step'   => $next,
		);
	}

	/**
	 * Output schema of summary().
	 *
	 * @return array<string, mixed>
	 */
	private static function job_schema() {
		$str = array( 'type' => 'string' );
		return array(
			'type'       => 'object',
			'properties' => array(
				'uuid'        => $str,
				'title'       => $str,
				'status'      => array(
					'type' => 'string',
					'enum' => JobStore::STATUSES,
				),
				'source_type' => $str,
				'score'       => array(
					'type'        => array( 'integer', 'null' ),
					'description' => 'Overall visual match, 0–100.',
				),
				'created_at'  => $str,
				'imported_at' => array( 'type' => array( 'string', 'null' ) ),
				'review_url'  => array(
					'type'        => array( 'string', 'null' ),
					'description' => 'wp-admin link where the user converts this job.',
				),
				'pages'       => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'id'       => array( 'type' => 'integer' ),
							'type'     => $str,
							'title'    => $str,
							'edit_url' => $str,
							'view_url' => $str,
						),
					),
				),
				'sections'    => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'label' => $str,
							'score' => array( 'type' => 'integer' ),
							'mode'  => array(
								'type' => 'string',
								'enum' => array( 'native', 'html', '' ),
							),
						),
					),
				),
				'checks'      => array(
					'type'  => 'array',
					'items' => $str,
				),
				'next_step'   => $str,
			),
			'required'   => array( 'uuid', 'status', 'review_url', 'pages', 'next_step' ),
		);
	}

	/**
	 * Exposure to agents (Abilities API `public`, MCP Adapter `mcp.public`) and behavior hints.
	 *
	 * @param bool $read_only   Changes nothing.
	 * @param bool $destructive May remove things.
	 * @param bool $idempotent  Repeating it has no further effect.
	 * @return array<string, mixed>
	 */
	private static function meta( $read_only, $destructive, $idempotent ) {
		return array(
			'public'       => true,
			'show_in_rest' => true,
			'mcp'          => array(
				'public' => true,
				'type'   => 'tool',
			),
			'annotations'  => array(
				'readonly'    => $read_only,
				'destructive' => $destructive,
				'idempotent'  => $idempotent,
			),
		);
	}
}
// phpcs:enable
