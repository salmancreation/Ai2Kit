<?php
/**
 * Preflight checks with one-click fixes (PRD FR-32, DESIGN.md §5.5).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

use ModinaTheme\Ai2Kit\Plugin;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Preflight.
 */
final class Preflight {

	/**
	 * Whether Elementor's Flexbox Container experiment is active.
	 *
	 * @return bool
	 */
	public static function container_active() {
		if ( ! Plugin::elementor_ready() ) {
			return false;
		}
		$exp = \Elementor\Plugin::$instance->experiments;
		// Container graduated to a core feature in newer versions; treat unknown as active.
		return ! $exp->get_features( 'container' ) || $exp->is_feature_active( 'container' );
	}

	/**
	 * Run all checks.
	 *
	 * @return array{ ready: bool, checks: array<int, array<string, mixed>> }
	 */
	public static function run() {
		$checks = array();
		$add    = static function ( $id, $status, $title, $detail, $fix = null ) use ( &$checks ) {
			$checks[] = array_filter(
				array(
					'id'     => $id,
					'status' => $status,
					'title'  => $title,
					'detail' => $detail,
					'fix'    => $fix,
				),
				static function ( $v ) {
					return null !== $v;
				}
			);
		};

		$ready = Plugin::elementor_ready();
		if ( ! $ready ) {
			$add( 'elementor', 'blocking', __( 'Elementor is not active', 'ai2kit' ), __( 'Install and activate Elementor (the free version works).', 'ai2kit' ) );
		} elseif ( version_compare( ELEMENTOR_VERSION, AI2KIT_MIN_ELEMENTOR, '<' ) ) {
			$add(
				'elementor',
				'blocking',
				/* translators: %s: installed Elementor version. */
				sprintf( __( 'Elementor %s is too old', 'ai2kit' ), ELEMENTOR_VERSION ),
				/* translators: %s: minimum Elementor version. */
				sprintf( __( 'Update Elementor to %s or newer.', 'ai2kit' ), AI2KIT_MIN_ELEMENTOR )
			);
		} else {
			/* translators: %s: Elementor version. */
			$add( 'elementor', 'success', sprintf( __( 'Elementor %s', 'ai2kit' ), ELEMENTOR_VERSION ), __( 'Supported version.', 'ai2kit' ) );
		}

		if ( $ready ) {
			if ( self::container_active() ) {
				$add( 'container', 'success', __( 'Flexbox Container is on', 'ai2kit' ), __( 'Converted layouts use containers.', 'ai2kit' ) );
			} else {
				$add( 'container', 'blocking', __( 'Flexbox Container is off', 'ai2kit' ), __( 'Imported pages would render blank.', 'ai2kit' ), array( 'label' => __( 'Enable', 'ai2kit' ) ) );
			}
			$atomic = \Elementor\Plugin::$instance->experiments->is_feature_active( 'e_atomic_elements' );
			$add(
				'atomic',
				'success',
				$atomic ? __( 'Atomic editor (v4) is on', 'ai2kit' ) : __( 'Classic widgets (v3)', 'ai2kit' ),
				$atomic ? __( 'Pages use atomic elements (v4). Widgets without an atomic version stay classic, on the same page.', 'ai2kit' ) : __( 'Pages use containers and classic widgets.', 'ai2kit' )
			);
			$add(
				'pro',
				'success',
				defined( 'ELEMENTOR_PRO_VERSION' ) ? __( 'Elementor Pro detected', 'ai2kit' ) : __( 'Elementor Free', 'ai2kit' ),
				__( 'Everything Ai2Kit Free does works without Elementor Pro.', 'ai2kit' )
			);
		}

		if ( ! class_exists( '\ZipArchive' ) ) {
			$add( 'zip', 'warning', __( 'ZIP uploads are unavailable', 'ai2kit' ), __( 'The PHP zip extension is missing. You can still upload a single HTML file.', 'ai2kit' ) );
		}

		$memory = wp_convert_hr_to_bytes( (string) ini_get( 'memory_limit' ) );
		if ( $memory > 0 && $memory < 256 * MB_IN_BYTES ) {
			/* translators: %s: memory limit, e.g. 128M. */
			$add( 'memory', 'warning', sprintf( __( 'PHP memory limit is %s', 'ai2kit' ), ini_get( 'memory_limit' ) ), __( 'Large sites may fail to import. 256M or more is recommended.', 'ai2kit' ) );
		}
		$max_time = (int) ini_get( 'max_execution_time' );
		if ( $max_time > 0 && $max_time < 60 ) {
			/* translators: %d: seconds. */
			$add( 'time', 'warning', sprintf( __( 'PHP time limit is %d seconds', 'ai2kit' ), $max_time ), __( 'Imports with many images may time out. 60 seconds or more is recommended.', 'ai2kit' ) );
		}
		$upload = wp_max_upload_size();
		if ( $upload < 20 * MB_IN_BYTES ) {
			/* translators: %s: size, e.g. 8 MB. */
			$add( 'upload', 'warning', sprintf( __( 'Upload limit is %s', 'ai2kit' ), size_format( $upload ) ), __( 'Larger ZIPs will be rejected by the server.', 'ai2kit' ) );
		}
		if ( ! current_user_can( 'unfiltered_html' ) ) {
			$add( 'scripts', 'warning', __( 'Your account can\'t run scripts', 'ai2kit' ), __( 'You can convert plain HTML. React/Vite builds need an administrator.', 'ai2kit' ) );
		}

		$blocking = array_filter(
			$checks,
			static function ( $c ) {
				return 'blocking' === $c['status'];
			}
		);
		return array(
			'ready'  => ! $blocking,
			'checks' => $checks,
		);
	}

	/**
	 * Apply a safe fix.
	 *
	 * @param string $check Check id.
	 * @return true|WP_Error
	 */
	public static function fix( $check ) {
		if ( 'container' === $check && Plugin::elementor_ready() ) {
			update_option( 'elementor_experiment-container', 'active' );
			return true;
		}
		return new WP_Error( 'ai2kit_no_fix', __( 'This check has no automatic fix.', 'ai2kit' ), array( 'status' => 400 ) );
	}
}
