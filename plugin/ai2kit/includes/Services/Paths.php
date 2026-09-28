<?php
/**
 * Job folder locations and hardening (PRD FR-2, §10).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Paths.
 */
final class Paths {

	const UUID_RE = '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/';

	/**
	 * Absolute path of the jobs root, without trailing slash.
	 *
	 * @return string
	 */
	public static function jobs_root() {
		$uploads = wp_upload_dir( null, false );
		return untrailingslashit( $uploads['basedir'] ) . '/ai2kit/jobs';
	}

	/**
	 * Public URL of the jobs root, without trailing slash.
	 *
	 * @return string
	 */
	public static function jobs_url() {
		$uploads = wp_upload_dir( null, false );
		return untrailingslashit( set_url_scheme( $uploads['baseurl'] ) ) . '/ai2kit/jobs';
	}

	/**
	 * Job directory.
	 *
	 * @param string $uuid Job UUID.
	 * @return string
	 */
	public static function job_dir( $uuid ) {
		self::assert_uuid( $uuid );
		return self::jobs_root() . '/' . $uuid;
	}

	/**
	 * Job URL.
	 *
	 * @param string $uuid Job UUID.
	 * @return string
	 */
	public static function job_url( $uuid ) {
		self::assert_uuid( $uuid );
		return self::jobs_url() . '/' . $uuid;
	}

	/**
	 * Guard against path injection through the UUID.
	 *
	 * @param string $uuid Job UUID.
	 * @throws \InvalidArgumentException When the UUID is malformed.
	 * @return void
	 */
	public static function assert_uuid( $uuid ) {
		if ( ! is_string( $uuid ) || ! preg_match( self::UUID_RE, $uuid ) ) {
			throw new \InvalidArgumentException( 'Invalid job id.' );
		}
	}

	/**
	 * Create the jobs root with an index guard and PHP-deny rules.
	 *
	 * @return bool
	 */
	public static function ensure_jobs_root() {
		$root = self::jobs_root();
		if ( ! wp_mkdir_p( $root ) ) {
			return false;
		}
		$parent = dirname( $root );
		foreach ( array( $parent, $root ) as $dir ) {
			if ( ! file_exists( $dir . '/index.php' ) ) {
				file_put_contents( $dir . '/index.php', "<?php\n// Silence is golden.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
		$htaccess = $parent . '/.htaccess';
		if ( ! file_exists( $htaccess ) ) {
			file_put_contents( $htaccess, self::htaccess_rules() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}
		return true;
	}

	/**
	 * Apache rules: never execute scripts, never list directories.
	 *
	 * @return string
	 */
	public static function htaccess_rules() {
		return <<<'HT'
# Ai2Kit job files are static. Never execute scripts here.
Options -Indexes -ExecCGI
<FilesMatch "\.(?i:php\d?|phtml|phar|pht|phps|cgi|pl|py|sh|asp|aspx|jsp)$">
	<IfModule mod_authz_core.c>
		Require all denied
	</IfModule>
	<IfModule !mod_authz_core.c>
		Order allow,deny
		Deny from all
	</IfModule>
</FilesMatch>
<IfModule mod_php.c>
	php_flag engine off
</IfModule>
<IfModule mod_php7.c>
	php_flag engine off
</IfModule>

HT;
	}

	/**
	 * Recursively delete a directory inside the jobs root only.
	 *
	 * @param string $dir Directory.
	 * @return bool
	 */
	public static function remove_dir( $dir ) {
		$root = realpath( self::jobs_root() );
		$real = realpath( $dir );
		if ( ! $root || ! $real || 0 !== strpos( $real, $root . DIRECTORY_SEPARATOR ) ) {
			return false;
		}
		$items = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $real, \FilesystemIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $items as $item ) {
			if ( $item->isDir() && ! $item->isLink() ) {
				rmdir( $item->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
			} else {
				wp_delete_file( $item->getPathname() );
			}
		}
		return rmdir( $real ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
	}
}
