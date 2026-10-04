<?php
/**
 * Undo an import (PRD FR-28): trash created pages/templates, delete the
 * media the import created, restore the kit.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Rollback.
 */
final class Rollback {

	/**
	 * Which created items were edited since import (DESIGN.md §6.3).
	 *
	 * @param array<string, mixed> $job Job row.
	 * @return array{ edited: bool, items: array<int, array<string, mixed>> }
	 */
	public static function check( array $job ) {
		$items  = array();
		$edited = false;
		foreach ( (array) ( $job['result']['created'] ?? array() ) as $c ) {
			$id      = (int) ( $c['id'] ?? 0 );
			$exists  = $id && get_post( $id ) && 'trash' !== get_post_status( $id );
			$is_mod  = $exists && get_post_meta( $id, '_ai2kit_imported_hash', true ) !== ElementorWriter::content_hash( $id );
			$edited  = $edited || $is_mod;
			$items[] = array(
				'id'     => $id,
				'title'  => $exists ? get_the_title( $id ) : ( $c['title'] ?? '' ),
				'exists' => (bool) $exists,
				'edited' => (bool) $is_mod,
			);
		}
		return array(
			'edited' => $edited,
			'items'  => $items,
		);
	}

	/**
	 * Undo.
	 *
	 * @param array<string, mixed> $job Job row.
	 * @return array<string, mixed>
	 */
	public static function run( array $job ) {
		$trashed = 0;
		foreach ( (array) ( $job['result']['created'] ?? array() ) as $c ) {
			$id = (int) ( $c['id'] ?? 0 );
			if ( $id && get_post_meta( $id, '_ai2kit_job', true ) === $job['uuid'] && wp_trash_post( $id ) ) {
				++$trashed;
			}
		}
		$deleted = 0;
		foreach ( (array) ( $job['result']['media']['created'] ?? array() ) as $id ) {
			$id = (int) $id;
			// Only media this job created, and only if nothing else started using it.
			if ( $id && get_post_meta( $id, '_ai2kit_job', true ) === $job['uuid'] && ! self::attachment_in_use( $id, $job['uuid'] ) && wp_delete_attachment( $id, true ) ) {
				++$deleted;
			}
		}
		$kit_restored = false;
		if ( is_array( $job['kit_backup'] ) ) {
			KitWriter::restore( $job['kit_backup'] );
			$kit_restored = true;
		}
		/**
		 * Fires while an import is undone, after its pages, templates and media were removed.
		 * Add-ons revert what they changed (menus, site settings).
		 *
		 * @param array<string, mixed> $job Job row (result as stored at import).
		 */
		do_action( 'ai2kit_undo_import', $job );
		JobStore::update( $job['uuid'], array( 'status' => 'undone' ) );
		return array(
			'trashed'      => $trashed,
			'mediaDeleted' => $deleted,
			'kitRestored'  => $kit_restored,
		);
	}

	/**
	 * Whether another (non-job) Elementor document references the attachment.
	 *
	 * @param int    $id  Attachment ID.
	 * @param string $job Job UUID.
	 * @return bool
	 */
	private static function attachment_in_use( $id, $job ) {
		global $wpdb;
		$like = '%' . $wpdb->esc_like( '"id":' . $id . ',' ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$posts = $wpdb->get_col( $wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_elementor_data' AND meta_value LIKE %s LIMIT 20", $like ) );
		foreach ( $posts as $post_id ) {
			if ( get_post_meta( (int) $post_id, '_ai2kit_job', true ) !== $job && 'trash' !== get_post_status( (int) $post_id ) ) {
				return true;
			}
		}
		return false;
	}
}
