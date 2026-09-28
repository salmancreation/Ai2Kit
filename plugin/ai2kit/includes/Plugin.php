<?php
/**
 * Plugin bootstrap: wires admin, REST and cron.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit;

use ModinaTheme\Ai2Kit\Admin\Menu;
use ModinaTheme\Ai2Kit\Rest\Routes;
use ModinaTheme\Ai2Kit\Services\Cleanup;
use ModinaTheme\Ai2Kit\Services\ResidualCss;

defined( 'ABSPATH' ) || exit;

/**
 * Main plugin class.
 */
final class Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Get the instance, booting on first call.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->boot();
		}
		return self::$instance;
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	private function boot() {
		Installer::maybe_upgrade();

		add_action(
			'rest_api_init',
			static function () {
				( new Routes() )->register();
			}
		);
		add_action( Cleanup::HOOK, array( Cleanup::class, 'run' ) );
		add_action( 'elementor/frontend/before_get_builder_content', array( ResidualCss::class, 'enqueue' ) );

		if ( is_admin() ) {
			( new Menu() )->register();
		}

		// Front-end previews inside the compare panel render without the admin bar.
		add_action(
			'wp',
			static function () {
				if ( isset( $_GET['ai2kit_compare'] ) && current_user_can( 'manage_options' ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
					add_filter( 'show_admin_bar', '__return_false' );
				}
			}
		);
	}


	/**
	 * Whether Elementor is loaded.
	 *
	 * @return bool
	 */
	public static function elementor_ready() {
		return did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' );
	}
}
