<?php
/**
 * Admin menu and app mount (DESIGN.md §4).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Admin;

use ModinaTheme\Ai2Kit\Plugin;
use ModinaTheme\Ai2Kit\Services\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Menu.
 */
final class Menu {

	const SLUG = 'ai2kit';

	/**
	 * Screens → submenu slugs.
	 *
	 * @var string[]
	 */
	private $hooks = array();

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_menu', array( $this, 'add_menus' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( AI2KIT_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Logo mark: two offset rounded squares joined by an arrow notch (DESIGN.md §2).
	 *
	 * @param string $fill Fill color.
	 * @return string
	 */
	public static function logo_svg( $fill = 'currentColor' ) {
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="' . esc_attr( $fill ) . '"><rect x="1" y="1" width="10" height="10" rx="3"/><rect x="9" y="9" width="10" height="10" rx="3" fill-opacity=".55"/><path d="M11.5 4.5h3a1 1 0 0 1 1 1v3l-1.6-1.6-2.9 2.9-1.3-1.3 2.9-2.9z"/></svg>';
	}

	/**
	 * Add the top-level menu and submenus.
	 *
	 * @return void
	 */
	public function add_menus() {
		$cap  = 'manage_options';
		$icon = 'data:image/svg+xml;base64,' . base64_encode( self::logo_svg( '#a7aaad' ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode

		$this->hooks[] = add_menu_page( __( 'Ai2Kit', 'ai2kit' ), __( 'Ai2Kit', 'ai2kit' ), $cap, self::SLUG, array( $this, 'render' ), $icon, 58.7 );
		$this->hooks[] = add_submenu_page( self::SLUG, __( 'Convert', 'ai2kit' ), __( 'Convert', 'ai2kit' ), $cap, self::SLUG, array( $this, 'render' ) );
		$this->hooks[] = add_submenu_page( self::SLUG, __( 'History', 'ai2kit' ), __( 'History', 'ai2kit' ), $cap, self::SLUG . '-history', array( $this, 'render' ) );
		$this->hooks[] = add_submenu_page( self::SLUG, __( 'Settings', 'ai2kit' ), __( 'Settings', 'ai2kit' ), $cap, self::SLUG . '-settings', array( $this, 'render' ) );
		$this->hooks[] = add_submenu_page( self::SLUG, __( 'Help', 'ai2kit' ), __( 'Help', 'ai2kit' ), $cap, self::SLUG . '-help', array( $this, 'render' ) );
		$this->hooks[] = add_submenu_page( self::SLUG, __( 'Go Pro', 'ai2kit' ), __( 'Go Pro', 'ai2kit' ), $cap, self::SLUG . '-pro', array( $this, 'render' ) );
	}

	/**
	 * Which app screen the current admin page maps to.
	 *
	 * @return string
	 */
	private function current_screen() {
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : self::SLUG; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$map  = array(
			self::SLUG               => 'convert',
			self::SLUG . '-history'  => 'history',
			self::SLUG . '-settings' => 'settings',
			self::SLUG . '-help'     => 'help',
			self::SLUG . '-pro'      => 'pro',
		);
		return $map[ $page ] ?? 'convert';
	}

	/**
	 * Mount point. The React app renders everything inside .ai2kit-app.
	 *
	 * @return void
	 */
	public function render() {
		$built = file_exists( AI2KIT_DIR . 'build/index.js' );
		echo '<div class="wrap ai2kit-wrap">';
		// Where core's common.js moves admin notices — outside the React root (otherwise it inserts
		// them after the app's own <h1>). The app gathers them into its "Site notices" pill.
		echo '<hr class="wp-header-end">';
		echo '<div id="ai2kit-root" class="ai2kit-app" data-screen="' . esc_attr( $this->current_screen() ) . '">';
		if ( ! $built ) {
			echo '<div class="notice notice-warning inline"><p>' . esc_html__( 'The Ai2Kit admin app has not been built yet. Run the build and reload this page.', 'ai2kit' ) . '</p></div>';
		} else {
			echo '<noscript>' . esc_html__( 'Ai2Kit needs JavaScript to convert pages.', 'ai2kit' ) . '</noscript>';
		}
		echo '</div></div>';
	}

	/**
	 * Enqueue the app only on Ai2Kit screens.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public function enqueue( $hook ) {
		if ( ! in_array( $hook, $this->hooks, true ) ) {
			return;
		}
		$asset_file = AI2KIT_DIR . 'build/index.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		wp_enqueue_script( 'ai2kit-admin', AI2KIT_URL . 'build/index.js', $asset['dependencies'], $asset['version'], true );
		wp_set_script_translations( 'ai2kit-admin', 'ai2kit', AI2KIT_DIR . 'languages' );
		if ( file_exists( AI2KIT_DIR . 'build/index.css' ) ) {
			wp_enqueue_style( 'ai2kit-admin', AI2KIT_URL . 'build/index.css', array(), $asset['version'] );
			wp_style_add_data( 'ai2kit-admin', 'rtl', 'replace' );
		}

		$elementor_version = defined( 'ELEMENTOR_VERSION' ) ? ELEMENTOR_VERSION : null;
		$config            = array(
			'screen'        => $this->current_screen(),
			'restUrl'       => esc_url_raw( rest_url( 'ai2kit/v1/' ) ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'adminUrl'      => esc_url_raw( admin_url() ),
			'version'       => AI2KIT_VERSION,
			'elementor'     => array(
				'active'  => Plugin::elementor_ready(),
				'version' => $elementor_version,
				'pro'     => defined( 'ELEMENTOR_PRO_VERSION' ),
				'atomic'  => Plugin::elementor_ready() && \ModinaTheme\Ai2Kit\Services\AtomicWriter::available(),
			),
			'maxUploadMb'   => (int) floor( min( wp_max_upload_size(), Settings::max_upload_bytes() ) / MB_IN_BYTES ),
			'canRunScripts' => current_user_can( 'unfiltered_html' ),
			'settings'      => Settings::all(),
			'dateFormat'    => get_option( 'date_format' ) . ' ' . get_option( 'time_format' ),
			'userId'        => get_current_user_id(),
			'isRtl'         => is_rtl(),
			'logo'          => self::logo_svg(),
		);
		wp_add_inline_script( 'ai2kit-admin', 'window.ai2kitConfig = ' . wp_json_encode( $config ) . ';', 'before' );
	}

	/**
	 * "Convert" link on the Plugins screen.
	 *
	 * @param array<string, mixed> $links Links.
	 * @return array<string, mixed>
	 */
	public function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Convert', 'ai2kit' ) . '</a>' );
		return $links;
	}
}
