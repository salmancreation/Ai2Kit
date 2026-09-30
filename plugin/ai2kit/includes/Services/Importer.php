<?php
/**
 * Import orchestration: validate → media → kit → document → job record.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

use ModinaTheme\Ai2Kit\Plugin;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Importer.
 */
final class Importer {

	/**
	 * Run an import.
	 *
	 * @param array<string, mixed> $job    Job row.
	 * @param array<string, mixed> $params Request body: document, tokens, output, kitMode, applyTokens, score, report.
	 * @return array<string, mixed>|WP_Error
	 */
	public function run( array $job, array $params ) {
		if ( ! Plugin::elementor_ready() ) {
			return new WP_Error( 'ai2kit_no_elementor', __( 'Elementor is not active.', 'ai2kit' ), array( 'status' => 409 ) );
		}
		if ( ! Preflight::container_active() ) {
			return new WP_Error( 'ai2kit_flexbox_off', __( 'Flexbox Container is off, so imported pages would render blank.', 'ai2kit' ), array( 'status' => 409 ) );
		}

		if ( ! KitWriter::ensure_kit() ) {
			return new WP_Error( 'ai2kit_no_kit', __( 'Elementor\'s site settings (kit) are missing and couldn\'t be recreated.', 'ai2kit' ), array( 'status' => 500 ) );
		}

		$doc = ( new Validator() )->document( $params['document'] ?? null );
		if ( is_wp_error( $doc ) ) {
			return $doc;
		}

		$settings = Settings::all();
		$output   = in_array( $params['output'] ?? '', array( 'page', 'template' ), true ) ? $params['output'] : $settings['output'];
		$kit_mode = in_array( $params['kitMode'] ?? '', array( 'merge', 'replace' ), true ) ? $params['kitMode'] : $settings['kitMode'];
		$title    = isset( $params['title'] ) ? sanitize_text_field( (string) $params['title'] ) : $doc['title'];

		// Media first: widgets reference attachment ids.
		$media    = new MediaImporter( $job['uuid'], (bool) $settings['importRemote'] );
		$elements = $media->process( $doc['content'] );

		// v4: Elementor converts the CSS and parses settings and styles (AtomicWriter).
		$atomic_residual = array();
		if ( 'v4' === ( $params['document']['format'] ?? 'v3' ) ) {
			if ( ! AtomicWriter::available() ) {
				foreach ( $media->created as $id ) {
					wp_delete_attachment( $id, true );
				}
				return new WP_Error( 'ai2kit_no_atomic', __( 'Elementor v4 output needs Elementor 4 with the Atomic editor turned on. Choose classic widgets (v3) instead.', 'ai2kit' ), array( 'status' => 409 ) );
			}
			$atomic          = new AtomicWriter();
			$elements        = $atomic->build( $elements );
			$atomic_residual = $atomic->residual;
			// Background images live in the converted styles: import them too.
			$elements = $media->process_styles( $elements );
		}

		// Tokens → kit, with backup.
		$kit = array(
			'map'    => array(),
			'backup' => null,
			'colors' => 0,
			'fonts'  => 0,
		);
		if ( ! empty( $params['applyTokens'] ) && ! empty( $params['tokens'] ) && is_array( $params['tokens'] ) ) {
			$kit = ( new KitWriter() )->apply( $params['tokens'], $kit_mode, $job['uuid'] );
		}
		$elements = KitWriter::remap( $elements, $kit['map'] );

		$created = ( new ElementorWriter() )->create( $title, $elements, $doc['page_settings'], $output, $job['uuid'] );
		if ( is_wp_error( $created ) ) {
			if ( $kit['backup'] ) {
				KitWriter::restore( $kit['backup'] );
			}
			foreach ( $media->created as $id ) {
				wp_delete_attachment( $id, true );
			}
			return $created;
		}

		$residual       = ResidualCss::build( array_merge( (array) ( $params['document']['residual'] ?? array() ), $atomic_residual ), $created['id'] );
		$residual_rules = substr_count( $residual, '{' ) - substr_count( $residual, '@media' );
		if ( '' !== $residual ) {
			update_post_meta( $created['id'], ResidualCss::META, $residual );
		}

		$fallbacks = $this->count_fallbacks( $elements );
		$checks    = array();
		if ( $fallbacks ) {
			$checks[] = array(
				'type' => 'fallback',
				/* translators: %d: number of blocks kept as HTML. */
				'text' => sprintf( _n( '%d block was kept as HTML — review it in Elementor.', '%d blocks were kept as HTML — review them in Elementor.', $fallbacks, 'ai2kit' ), $fallbacks ),
			);
		}
		if ( $this->has_form( $elements ) ) {
			$checks[] = array(
				'type' => 'form',
				'text' => __( 'A form was kept as HTML. Connect it to an email address or a form plugin before going live.', 'ai2kit' ),
			);
		}
		if ( $residual_rules > 0 ) {
			$checks[] = array(
				'type' => 'residual',
				/* translators: %d: number of CSS rules. */
				'text' => sprintf( _n( '%d style no Elementor control covers (like gradient text) was kept as CSS scoped to this page.', '%d styles no Elementor control covers (like gradient text or rotation) were kept as CSS scoped to this page.', $residual_rules, 'ai2kit' ), $residual_rules ),
			);
		}
		if ( $media->icon_fallbacks ) {
			$checks[] = array(
				'type' => 'icons',
				/* translators: %d: number of icons. */
				'text' => sprintf( _n( '%d icon couldn\'t be imported as SVG and uses the closest Font Awesome icon instead.', '%d icons couldn\'t be imported as SVG and use the closest Font Awesome icon instead.', $media->icon_fallbacks, 'ai2kit' ), $media->icon_fallbacks ),
			);
		}
		if ( $media->failed ) {
			$checks[] = array(
				'type' => 'media',
				/* translators: %d: number of images. */
				'text' => sprintf( _n( '%d image couldn\'t be imported and still points to its original address.', '%d images couldn\'t be imported and still point to their original addresses.', count( $media->failed ), 'ai2kit' ), count( $media->failed ) ),
			);
		}

		$result = array(
			'created'  => array( $created ),
			'media'    => array(
				'created' => $media->created,
				'reused'  => $media->reused,
				'failed'  => array_slice( $media->failed, 0, 50 ),
			),
			'residual' => $residual_rules,
			'kit'      => array(
				'colors' => $kit['colors'],
				'fonts'  => $kit['fonts'],
				'mode'   => $kit_mode,
			),
			'checks'   => $checks,
			'sections' => $this->report( $params['report'] ?? array() ),
		);

		/**
		 * Filters an import's result before it is stored with the job (add-ons add what they created).
		 * Anything added under `created` is trashed by Undo when it carries the `_ai2kit_job` meta.
		 *
		 * @param array<string, mixed> $result  Result (created, media, kit, checks, sections).
		 * @param array<string, mixed> $job     Job row.
		 * @param array<string, mixed> $params  Request body.
		 * @param array<string, mixed> $created The created page or template.
		 */
		$result = (array) apply_filters( 'ai2kit_import_result', $result, $job, $params, $created );

		JobStore::update(
			$job['uuid'],
			array(
				'status'      => 'imported',
				'title'       => $title,
				'source_type' => sanitize_key( (string) ( $params['sourceType'] ?? '' ) ),
				'score'       => max( 0, min( 100, (int) ( $params['score'] ?? 0 ) ) ),
				'imported_at' => current_time( 'mysql', true ),
				'result'      => $result,
				'kit_backup'  => null !== $kit['backup'] ? $kit['backup'] : null,
			)
		);
		// Files stay for the post-import compare view when asked; cron removes them within 24 h.
		if ( ! $settings['keepSource'] && empty( $params['keepForCompare'] ) ) {
			Cleanup::remove_job_files( $job['uuid'] );
		}

		return $result;
	}

	/**
	 * Count HTML fallback widgets.
	 *
	 * @param array<int, array<string, mixed>> $elements Elements.
	 * @return int
	 */
	private function count_fallbacks( array $elements ) {
		$n = 0;
		foreach ( $elements as $el ) {
			if ( 'html' === ( $el['widgetType'] ?? '' ) ) {
				++$n;
			}
			$n += $this->count_fallbacks( $el['elements'] ?? array() );
		}
		return $n;
	}

	/**
	 * Whether any HTML fallback contains a form.
	 *
	 * @param array<int, array<string, mixed>> $elements Elements.
	 * @return bool
	 */
	private function has_form( array $elements ) {
		foreach ( $elements as $el ) {
			if ( 'html' === ( $el['widgetType'] ?? '' ) && false !== stripos( (string) ( $el['settings']['html'] ?? '' ), '<form' ) ) {
				return true;
			}
			if ( $this->has_form( $el['elements'] ?? array() ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Keep a compact, sanitized per-section report for History.
	 *
	 * @param mixed $report Sections from the engine.
	 * @return array<int, array<string, mixed>>
	 */
	private function report( $report ) {
		$out = array();
		foreach ( array_slice( (array) $report, 0, 60 ) as $s ) {
			if ( ! is_array( $s ) ) {
				continue;
			}
			$out[] = array(
				'label' => sanitize_text_field( (string) ( $s['label'] ?? '' ) ),
				'score' => max( 0, min( 100, (int) ( $s['score'] ?? 0 ) ) ),
				'mode'  => 'html' === ( $s['mode'] ?? '' ) ? 'html' : 'native',
			);
		}
		return $out;
	}
}
