<?php
/**
 * Plugin settings (single option).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Settings.
 */
final class Settings {

	const OPTION = 'ai2kit_settings';

	/**
	 * Defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function defaults() {
		return array(
			'theme'            => 'system',  // light | dark | system.
			'output'           => 'page',    // page | template.
			'format'           => 'auto',    // auto | v3 | v4.
			'kitMode'          => 'merge',   // merge | replace.
			'importRemote'     => true,      // Sideload remote images into the Media Library.
			'keepSource'       => false,     // Keep job files past 24 h for re-runs.
			'welcomeDone'      => false,
			'diagnosticsOptIn' => false,
		);
	}

	/**
	 * All settings merged with defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function all() {
		$stored = get_option( self::OPTION, array() );
		return array_merge( self::defaults(), is_array( $stored ) ? $stored : array() );
	}

	/**
	 * One setting.
	 *
	 * @param string $key Key.
	 * @return mixed
	 */
	public static function get( $key ) {
		$all = self::all();
		return $all[ $key ] ?? null;
	}

	/**
	 * Validate and save a partial update.
	 *
	 * @param array<string, mixed> $input Raw input.
	 * @return array<string, mixed> Saved settings.
	 */
	public static function update( array $input ) {
		$current = self::all();
		$enums   = array(
			'theme'   => array( 'light', 'dark', 'system' ),
			'output'  => array( 'page', 'template' ),
			'format'  => array( 'auto', 'v3', 'v4' ),
			'kitMode' => array( 'merge', 'replace' ),
		);
		foreach ( $enums as $key => $allowed ) {
			if ( isset( $input[ $key ] ) && in_array( $input[ $key ], $allowed, true ) ) {
				$current[ $key ] = $input[ $key ];
			}
		}
		foreach ( array( 'importRemote', 'keepSource', 'welcomeDone', 'diagnosticsOptIn' ) as $bool ) {
			if ( isset( $input[ $bool ] ) ) {
				$current[ $bool ] = (bool) $input[ $bool ];
			}
		}
		update_option( self::OPTION, $current, false );
		return $current;
	}

	/**
	 * Upload cap (PRD FR-1: 50 MB default, filterable).
	 *
	 * @return int Bytes.
	 */
	public static function max_upload_bytes() {
		return (int) apply_filters( 'ai2kit_max_upload_bytes', 50 * MB_IN_BYTES );
	}
}
