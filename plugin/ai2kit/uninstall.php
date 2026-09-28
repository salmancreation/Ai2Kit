<?php
/**
 * Uninstall (PRD §10): remove options, the jobs table and job files.
 * User content (pages, templates, media) is kept.
 *
 * @package Ai2Kit
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Remove Ai2Kit data for the current site.
 *
 * @return void
 */
function ai2kit_uninstall_site() {
	global $wpdb;

	delete_option( 'ai2kit_settings' );
	delete_option( 'ai2kit_db_version' );
	wp_clear_scheduled_hook( 'ai2kit_cleanup_jobs' );

	$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $wpdb->prefix . 'ai2kit_jobs' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange

	$uploads = wp_upload_dir( null, false );
	$root    = trailingslashit( $uploads['basedir'] ) . 'ai2kit';
	if ( is_dir( $root ) ) {
		$items = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $items as $item ) {
			if ( $item->isDir() && ! $item->isLink() ) {
				rmdir( $item->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
			} else {
				wp_delete_file( $item->getPathname() );
			}
		}
		rmdir( $root ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
	}
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $ai2kit_site_id ) {
		switch_to_blog( $ai2kit_site_id );
		ai2kit_uninstall_site();
		restore_current_blog();
	}
} else {
	ai2kit_uninstall_site();
}
