<?php
/**
 * Activation, schema and upgrades.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit;

use ModinaTheme\Ai2Kit\Services\Cleanup;
use ModinaTheme\Ai2Kit\Services\JobStore;
use ModinaTheme\Ai2Kit\Services\Paths;

defined( 'ABSPATH' ) || exit;

/**
 * Installer.
 */
final class Installer {

	const DB_VERSION        = '1';
	const DB_VERSION_OPTION = 'ai2kit_db_version';

	/**
	 * Activation hook.
	 */
	public static function activate() {
		self::create_table();
		Paths::ensure_jobs_root();
		if ( ! wp_next_scheduled( Cleanup::HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', Cleanup::HOOK );
		}
	}

	/**
	 * Deactivation hook.
	 */
	public static function deactivate() {
		wp_clear_scheduled_hook( Cleanup::HOOK );
	}

	/**
	 * Create/upgrade the schema when the stored version is stale (covers multisite and updates).
	 */
	public static function maybe_upgrade() {
		if ( get_option( self::DB_VERSION_OPTION ) !== self::DB_VERSION ) {
			self::create_table();
		}
	}

	/**
	 * Jobs table (PRD FR-28).
	 */
	public static function create_table() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table   = JobStore::table();
		$charset = $wpdb->get_charset_collate();
		$sql     = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			status varchar(20) NOT NULL DEFAULT 'uploaded',
			source_type varchar(40) NOT NULL DEFAULT '',
			title varchar(255) NOT NULL DEFAULT '',
			entry varchar(255) NOT NULL DEFAULT '',
			score tinyint(3) unsigned DEFAULT NULL,
			keep_source tinyint(1) NOT NULL DEFAULT 0,
			result longtext NULL,
			kit_backup longtext NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			imported_at datetime DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY uuid (uuid),
			KEY status (status),
			KEY created_at (created_at)
		) {$charset};";

		dbDelta( $sql );
		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, false );
	}
}
