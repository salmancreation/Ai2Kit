<?php
/**
 * Integration bootstrap: real WordPress test suite + Elementor, inside wp-env.
 *
 * @package Ai2Kit
 */

$_tests_dir = getenv( 'WP_TESTS_DIR' ) ? getenv( 'WP_TESTS_DIR' ) : '/wordpress-phpunit';
if ( ! file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "WordPress test suite not found in $_tests_dir. Run inside wp-env (tests-cli).\n" );
	exit( 1 );
}

define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', dirname( __DIR__, 2 ) . '/vendor/yoast/phpunit-polyfills' );
// wp-env mounts the repo's tests/fixtures at wp-content/ai2kit-fixtures.
define( 'AI2KIT_FIXTURES', getenv( 'AI2KIT_FIXTURES' ) ? getenv( 'AI2KIT_FIXTURES' ) : '/var/www/html/wp-content/ai2kit-fixtures' );

require_once $_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require WP_CONTENT_DIR . '/plugins/elementor/elementor.php';
		require dirname( __DIR__, 2 ) . '/ai2kit.php';
	}
);
tests_add_filter(
	'setup_theme',
	static function () {
		\ModinaTheme\Ai2Kit\Installer::activate();
	}
);

require $_tests_dir . '/includes/bootstrap.php';
require __DIR__ . '/TestCase.php';
