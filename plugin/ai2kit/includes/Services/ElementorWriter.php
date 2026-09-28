<?php
/**
 * Save through Elementor's document API (PRD FR-24), so CSS generation,
 * revisions and caches stay correct. Never raw post meta.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * ElementorWriter.
 */
final class ElementorWriter {

	/**
	 * Create a draft page or a library template.
	 *
	 * @param string                           $title    Title.
	 * @param array<int, array<string, mixed>> $elements Validated elements.
	 * @param array<string, mixed>             $settings Page settings.
	 * @param string                           $output   page | template.
	 * @param string                           $job      Job UUID.
	 * @return array<string, mixed>|WP_Error { id, type, title, editUrl, viewUrl }
	 */
	public function create( $title, array $elements, array $settings, $output, $job ) {
		$documents = \Elementor\Plugin::$instance->documents;
		$is_page   = 'template' !== $output;
		$type      = $is_page ? 'wp-page' : 'page';
		$title     = '' !== $title ? $title : __( 'Converted page', 'ai2kit' );

		$document = $documents->create(
			$type,
			array(
				'post_title'  => $title,
				'post_status' => $is_page ? 'draft' : 'publish',
			),
			array(
				'_ai2kit_job' => $job,
			)
		);
		if ( ! $document instanceof \Elementor\Core\Base\Document ) {
			return new WP_Error( 'ai2kit_create_failed', __( 'Elementor couldn\'t create the page.', 'ai2kit' ), array( 'status' => 500 ) );
		}

		$saved = $document->save(
			array(
				'elements' => $elements,
				'settings' => $settings,
			)
		);
		if ( ! $saved ) {
			wp_delete_post( $document->get_main_id(), true );
			return new WP_Error( 'ai2kit_save_failed', __( 'Elementor couldn\'t save the converted layout.', 'ai2kit' ), array( 'status' => 500 ) );
		}

		$id = $document->get_main_id();
		if ( ! empty( $settings['template'] ) && $is_page ) {
			update_post_meta( $id, '_wp_page_template', $settings['template'] );
		}
		// Baseline for "edited since import" detection.
		update_post_meta( $id, '_ai2kit_imported_hash', self::content_hash( $id ) );

		return array(
			'id'      => $id,
			'type'    => $is_page ? 'page' : 'template',
			'title'   => get_the_title( $id ),
			'editUrl' => $document->get_edit_url(),
			'viewUrl' => $is_page ? get_preview_post_link( $id ) : get_permalink( $id ),
		);
	}

	/**
	 * Hash of the saved Elementor data, to detect later edits.
	 *
	 * @param int $post_id Post ID.
	 * @return string
	 */
	public static function content_hash( $post_id ) {
		return md5( (string) get_post_meta( $post_id, '_elementor_data', true ) . '|' . get_post_field( 'post_title', $post_id ) );
	}
}
