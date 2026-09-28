<?php
/**
 * Global Colors / Global Fonts (PRD FR-19 … FR-21, FR-25).
 *
 * Merge mode (default) adds tokens as custom globals and remaps the
 * document's references to them; replace mode overwrites the four system
 * colors/fonts. The previous kit settings are always backed up for undo.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * KitWriter.
 */
final class KitWriter {

	const SYSTEM_IDS = array( 'primary', 'secondary', 'text', 'accent' );

	/**
	 * Active kit document.
	 *
	 * @return \Elementor\Core\Kits\Documents\Kit|null
	 */
	public static function kit() {
		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();
		return $kit && $kit->get_id() ? $kit : null;
	}

	/**
	 * Make sure an active kit exists. Containers read kit settings while
	 * saving, so a site whose kit was deleted can't save any page.
	 *
	 * @return bool
	 */
	public static function ensure_kit() {
		if ( self::kit() ) {
			return true;
		}
		$manager = \Elementor\Plugin::$instance->kits_manager;
		$id      = $manager->create_default();
		if ( ! $id || is_wp_error( $id ) ) {
			return false;
		}
		update_option( $manager::OPTION_ACTIVE, $id );
		return (bool) self::kit();
	}

	/**
	 * Raw stored kit settings.
	 *
	 * @return array
	 */
	public static function raw_settings() {
		$kit = self::kit();
		if ( ! $kit ) {
			return array();
		}
		$meta = get_post_meta( $kit->get_id(), '_elementor_page_settings', true );
		return is_array( $meta ) ? $meta : array();
	}

	/**
	 * Apply tokens.
	 *
	 * @param array  $tokens { colors: [], fonts: [] } from the engine.
	 * @param string $mode   merge | replace.
	 * @param string $job    Job UUID (namespaces custom ids).
	 * @return array{ map: array<string,string>, backup: array, colors: int, fonts: int }
	 */
	public function apply( array $tokens, $mode, $job ) {
		$kit    = self::kit();
		$backup = self::raw_settings();
		if ( ! $kit ) {
			return array(
				'map'    => array(),
				'backup' => null,
				'colors' => 0,
				'fonts'  => 0,
			);
		}
		$settings = $backup;
		$map      = array();

		$colors = $this->clean_colors( $tokens['colors'] ?? array() );
		$fonts  = $this->clean_fonts( $tokens['fonts'] ?? array() );

		foreach ( array( 'colors', 'typography' ) as $group ) {
			$items  = 'colors' === $group ? $colors : $fonts;
			$system = (array) ( $settings[ 'system_' . $group ] ?? $this->default_system( $group ) );
			$custom = (array) ( $settings[ 'custom_' . $group ] ?? array() );

			foreach ( $items as $item ) {
				$is_system = in_array( $item['_id'], self::SYSTEM_IDS, true );
				if ( $is_system && 'replace' === $mode ) {
					$replaced = false;
					foreach ( $system as &$s ) {
						if ( ( $s['_id'] ?? '' ) === $item['_id'] ) {
							$s        = array_merge( array( 'title' => $s['title'] ?? $item['title'] ), $item, array( 'title' => $s['title'] ?? $item['title'] ) );
							$replaced = true;
						}
					}
					unset( $s );
					if ( ! $replaced ) {
						$system[] = $item;
					}
					continue;
				}
				// Custom (or system in merge mode): stable per-job id so re-imports don't collide.
				$new_id = $is_system ? 'a2k' . substr( md5( $job . $group . $item['_id'] ), 0, 6 ) : $item['_id'];
				$map[ $group . ':' . $item['_id'] ] = $new_id;
				$item['_id'] = $new_id;
				$custom      = array_values( array_filter( $custom, static function ( $c ) use ( $new_id ) { return ( $c['_id'] ?? '' ) !== $new_id; } ) );
				$custom[]    = $item;
			}
			$settings[ 'system_' . $group ] = $system;
			$settings[ 'custom_' . $group ] = $custom;
		}

		$kit->save( array( 'settings' => $settings ) );

		return array(
			'map'    => $map,
			'backup' => $backup,
			'colors' => count( $colors ),
			'fonts'  => count( $fonts ),
		);
	}

	/**
	 * Restore a backup (undo).
	 *
	 * @param array $backup Raw settings.
	 */
	public static function restore( array $backup ) {
		$kit = self::kit();
		if ( ! $kit ) {
			return;
		}
		// Write the exact previous meta: saving through the document would add
		// Elementor's defaults, so undo wouldn't be a true restore.
		if ( $backup ) {
			update_post_meta( $kit->get_id(), '_elementor_page_settings', $backup );
		} else {
			delete_post_meta( $kit->get_id(), '_elementor_page_settings' );
		}
		\Elementor\Plugin::$instance->files_manager->clear_cache();
	}

	/**
	 * Elementor's default system items, when the kit has never been saved.
	 *
	 * @param string $group colors | typography.
	 * @return array
	 */
	private function default_system( $group ) {
		$kit = self::kit();
		return $kit ? (array) $kit->get_settings( 'system_' . $group ) : array();
	}

	/**
	 * Engine color tokens → kit items.
	 *
	 * @param array $colors Tokens.
	 * @return array
	 */
	private function clean_colors( array $colors ) {
		$out = array();
		foreach ( array_slice( $colors, 0, 40 ) as $c ) {
			$id  = isset( $c['id'] ) ? preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $c['id'] ) : '';
			$hex = isset( $c['hex'] ) ? (string) $c['hex'] : '';
			if ( '' === $id || ! preg_match( '/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/', $hex ) ) {
				continue;
			}
			$out[] = array(
				'_id'   => $id,
				'title' => sanitize_text_field( (string) ( $c['title'] ?? $id ) ),
				'color' => strtoupper( $hex ),
			);
		}
		return $out;
	}

	/**
	 * Engine font tokens → kit typography items.
	 *
	 * @param array $fonts Tokens.
	 * @return array
	 */
	private function clean_fonts( array $fonts ) {
		$out    = array();
		$slider = static function ( $n, $unit ) {
			return array(
				'unit'  => $unit,
				'size'  => round( (float) $n, 2 ),
				'sizes' => array(),
			);
		};
		foreach ( array_slice( $fonts, 0, 20 ) as $f ) {
			$id = isset( $f['id'] ) ? preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $f['id'] ) : '';
			if ( '' === $id || empty( $f['family'] ) ) {
				continue;
			}
			$item = array(
				'_id'                    => $id,
				'title'                  => sanitize_text_field( (string) ( $f['title'] ?? $id ) ),
				'typography_typography'  => 'custom',
				'typography_font_family' => sanitize_text_field( (string) $f['family'] ),
			);
			if ( ! empty( $f['weight'] ) && preg_match( '/^([1-9]00|normal|bold)$/', (string) $f['weight'] ) ) {
				$item['typography_font_weight'] = (string) $f['weight'];
			}
			if ( ! empty( $f['size'] ) ) {
				$item['typography_font_size'] = $slider( $f['size'], 'px' );
			}
			if ( ! empty( $f['sizeTablet'] ) ) {
				$item['typography_font_size_tablet'] = $slider( $f['sizeTablet'], 'px' );
			}
			if ( ! empty( $f['sizeMobile'] ) ) {
				$item['typography_font_size_mobile'] = $slider( $f['sizeMobile'], 'px' );
			}
			foreach ( array( 'lineHeight' => '', 'lineHeightTablet' => '_tablet', 'lineHeightMobile' => '_mobile' ) as $key => $suffix ) {
				if ( ! empty( $f[ $key ] ) ) {
					$item[ 'typography_line_height' . $suffix ] = $slider( $f[ $key ], 'em' );
				}
			}
			if ( ! empty( $f['letterSpacing'] ) ) {
				$item['typography_letter_spacing'] = $slider( $f['letterSpacing'], 'px' );
			}
			if ( ! empty( $f['textTransform'] ) && in_array( $f['textTransform'], array( 'uppercase', 'lowercase', 'capitalize' ), true ) ) {
				$item['typography_text_transform'] = $f['textTransform'];
			}
			$out[] = $item;
		}
		return $out;
	}

	/**
	 * Rewrite global references in elements after merge-mode id changes.
	 *
	 * @param array $elements Elements.
	 * @param array $map      "colors:primary" => "a2kxxxxxx".
	 * @return array
	 */
	public static function remap( array $elements, array $map ) {
		if ( ! $map ) {
			return $elements;
		}
		foreach ( $elements as &$el ) {
			if ( ! empty( $el['settings']['__globals__'] ) ) {
				foreach ( $el['settings']['__globals__'] as $k => $ref ) {
					if ( preg_match( '#^globals/(colors|typography)\?id=(.+)$#', $ref, $m ) && isset( $map[ $m[1] . ':' . $m[2] ] ) ) {
						$el['settings']['__globals__'][ $k ] = 'globals/' . $m[1] . '?id=' . $map[ $m[1] . ':' . $m[2] ];
					}
				}
			}
			if ( ! empty( $el['elements'] ) ) {
				$el['elements'] = self::remap( $el['elements'], $map );
			}
		}
		return $elements;
	}
}
