<?php
/**
 * Jobs table access (PRD FR-28).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * JobStore.
 */
final class JobStore {

	const STATUSES = array( 'uploaded', 'imported', 'undone', 'failed' );

	/**
	 * Table name.
	 *
	 * @return string
	 */
	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'ai2kit_jobs';
	}

	/**
	 * Insert a job.
	 *
	 * @param array<string, mixed> $data Columns.
	 * @return array<string, mixed>|null
	 */
	public static function create( array $data ) {
		global $wpdb;
		$now  = current_time( 'mysql', true );
		$row  = array(
			'uuid'        => $data['uuid'],
			'user_id'     => get_current_user_id(),
			'status'      => 'uploaded',
			'source_type' => substr( sanitize_key( $data['source_type'] ?? '' ), 0, 40 ),
			'title'       => substr( sanitize_text_field( $data['title'] ?? '' ), 0, 255 ),
			'entry'       => substr( $data['entry'] ?? '', 0, 255 ),
			'created_at'  => $now,
			'updated_at'  => $now,
		);
		$done = $wpdb->insert( self::table(), $row ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		return $done ? self::get( $data['uuid'] ) : null;
	}

	/**
	 * Get by UUID.
	 *
	 * @param string $uuid Job UUID.
	 * @return array<string, mixed>|null
	 */
	public static function get( $uuid ) {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM %i WHERE uuid = %s', self::table(), $uuid ), ARRAY_A );
		return $row ? self::hydrate( $row ) : null;
	}

	/**
	 * Update columns.
	 *
	 * @param string               $uuid Job UUID.
	 * @param array<string, mixed> $data Columns.
	 * @return bool
	 */
	public static function update( $uuid, array $data ) {
		global $wpdb;
		foreach ( array( 'result', 'kit_backup' ) as $json ) {
			if ( isset( $data[ $json ] ) && ! is_string( $data[ $json ] ) ) {
				$data[ $json ] = wp_json_encode( $data[ $json ] );
			}
		}
		if ( isset( $data['status'] ) && ! in_array( $data['status'], self::STATUSES, true ) ) {
			return false;
		}
		$data['updated_at'] = current_time( 'mysql', true );
		return false !== $wpdb->update( self::table(), $data, array( 'uuid' => $uuid ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Recent jobs for History (DESIGN.md §6.3).
	 *
	 * @param int $limit Max rows.
	 * @param int $offset Offset.
	 * @return array<string, mixed>
	 */
	public static function recent( $limit = 50, $offset = 0 ) {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM %i WHERE status <> 'uploaded' OR created_at > %s ORDER BY id DESC LIMIT %d OFFSET %d", self::table(), gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS ), $limit, $offset ), ARRAY_A );
		return array_map( array( __CLASS__, 'hydrate' ), (array) $rows );
	}

	/**
	 * Uploaded (never imported) jobs older than a cutoff, for cleanup.
	 *
	 * @param int $older_than Seconds.
	 * @return array<string, mixed>
	 */
	public static function stale( $older_than ) {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT uuid, status, keep_source FROM %i WHERE created_at < %s AND keep_source = 0', self::table(), gmdate( 'Y-m-d H:i:s', time() - $older_than ) ), ARRAY_A );
		return (array) $rows;
	}

	/**
	 * Decode JSON columns and cast types.
	 *
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private static function hydrate( array $row ) {
		$row['id']          = (int) $row['id'];
		$row['user_id']     = (int) $row['user_id'];
		$row['score']       = null === $row['score'] ? null : (int) $row['score'];
		$row['keep_source'] = (bool) $row['keep_source'];
		$row['result']      = $row['result'] ? json_decode( $row['result'], true ) : null;
		$row['kit_backup']  = $row['kit_backup'] ? json_decode( $row['kit_backup'], true ) : null;
		return $row;
	}
}
