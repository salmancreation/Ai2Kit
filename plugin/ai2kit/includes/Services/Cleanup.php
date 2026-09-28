<?php
/**
 * Hourly cleanup of job folders (PRD FR-5).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Cleanup.
 */
final class Cleanup {

	const HOOK = 'ai2kit_cleanup_jobs';

	/**
	 * Delete job folders older than 24 h unless the user chose to keep the source.
	 *
	 * @return void
	 */
	public static function run() {
		foreach ( JobStore::stale( DAY_IN_SECONDS ) as $row ) {
			self::remove_job_files( $row['uuid'] );
		}
		// Orphaned folders (no DB row) are removed too.
		$root = Paths::jobs_root();
		if ( ! is_dir( $root ) ) {
			return;
		}
		foreach ( (array) glob( $root . '/*', GLOB_ONLYDIR ) as $dir ) {
			$uuid = basename( $dir );
			if ( preg_match( Paths::UUID_RE, $uuid ) && filemtime( $dir ) < time() - DAY_IN_SECONDS && ! JobStore::get( $uuid ) ) {
				Paths::remove_dir( $dir );
			}
		}
	}

	/**
	 * Remove one job's files.
	 *
	 * @param string $uuid Job UUID.
	 * @return void
	 */
	public static function remove_job_files( $uuid ) {
		try {
			$dir = Paths::job_dir( $uuid );
		} catch ( \InvalidArgumentException $e ) {
			return;
		}
		if ( is_dir( $dir ) ) {
			Paths::remove_dir( $dir );
		}
	}
}
