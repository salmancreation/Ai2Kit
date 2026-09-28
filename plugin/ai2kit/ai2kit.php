<?php
/**
 * Plugin Name:       Ai2Kit – AI Website to Elementor Converter
 * Plugin URI:        https://ai2kit.com
 * Description:       Convert AI-built sites (Lovable, Bolt, v0, Gemini, HTML templates) into editable Elementor pages — locally, inside wp-admin.
 * Version:           0.2.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Requires Plugins:  elementor
 * Author:            ModinaTheme
 * Author URI:        https://modinatheme.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ai2kit
 * Domain Path:       /languages
 *
 * @package Ai2Kit
 */

defined( 'ABSPATH' ) || exit;

define( 'AI2KIT_VERSION', '0.2.0' );
define( 'AI2KIT_FILE', __FILE__ );
define( 'AI2KIT_DIR', plugin_dir_path( __FILE__ ) );
define( 'AI2KIT_URL', plugin_dir_url( __FILE__ ) );
define( 'AI2KIT_MIN_ELEMENTOR', '3.25.0' );

/*
 * PSR-4 autoloader for ModinaTheme\Ai2Kit\ → includes/. Kept in-house so the
 * plugin runs without a Composer vendor folder (Composer is dev-only).
 */
spl_autoload_register(
	static function ( $class_name ) {
		$prefix = 'ModinaTheme\\Ai2Kit\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}
		$relative = str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) );
		$file     = AI2KIT_DIR . 'includes/' . $relative . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}
);

register_activation_hook( __FILE__, array( 'ModinaTheme\\Ai2Kit\\Installer', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'ModinaTheme\\Ai2Kit\\Installer', 'deactivate' ) );

add_action(
	'plugins_loaded',
	static function () {
		ModinaTheme\Ai2Kit\Plugin::instance();
	}
);
