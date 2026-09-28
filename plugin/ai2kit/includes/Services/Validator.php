<?php
/**
 * Server-side validation of the browser's output (PRD FR-23).
 *
 * The browser output is never trusted: structure is schema-checked, every
 * string is sanitized for its context, URLs are escaped, and HTML fallbacks
 * lose <script> unless the user has unfiltered_html.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Validator.
 */
final class Validator {

	const WIDGETS      = array( 'heading', 'text-editor', 'image', 'button', 'icon', 'icon-list', 'video', 'divider', 'spacer', 'html' );
	const ATOMIC       = array( 'e-flexbox', 'e-div-block', 'e-grid', 'e-heading', 'e-paragraph', 'e-button', 'e-image', 'e-svg', 'e-divider', 'e-youtube' );
	const MAX_DEPTH    = 30;
	const MAX_ELEMENTS = 10000;
	const KEY_RE       = '/^[A-Za-z_][A-Za-z0-9_\-]{0,80}$/';
	const SVG_DATA_RE  = '#^data:image/svg\+xml;base64,[A-Za-z0-9+/=]+$#';

	/**
	 * Elements seen.
	 *
	 * @var int
	 */
	private $count = 0;

	/**
	 * IDs used in this document.
	 *
	 * @var array<string, true>
	 */
	private $ids = array();

	/**
	 * Validate and sanitize a document.
	 *
	 * @param mixed $doc Decoded JSON.
	 * @return array<string, mixed>|WP_Error { title, content, page_settings }
	 */
	public function document( $doc ) {
		if ( ! is_array( $doc ) || ! isset( $doc['content'] ) || ! is_array( $doc['content'] ) || ! $doc['content'] ) {
			return new WP_Error( 'ai2kit_invalid_document', __( 'The converted page is empty or malformed.', 'ai2kit' ), array( 'status' => 400 ) );
		}
		$this->count = 0;
		$this->ids   = array();
		$content     = $this->elements( $doc['content'], 0 );
		if ( is_wp_error( $content ) ) {
			return $content;
		}
		$template = isset( $doc['page_settings']['template'] ) ? (string) $doc['page_settings']['template'] : 'elementor_canvas';
		return array(
			'title'         => sanitize_text_field( (string) ( $doc['title'] ?? '' ) ),
			'content'       => $content,
			'page_settings' => array(
				'template' => in_array( $template, array( 'elementor_canvas', 'elementor_header_footer', 'default' ), true ) ? $template : 'elementor_canvas',
			),
		);
	}

	/**
	 * Validate an element list.
	 *
	 * @param array<int, array<string, mixed>> $elements Elements.
	 * @param int                              $depth    Nesting depth.
	 * @return array<int, array<string, mixed>>|WP_Error
	 */
	private function elements( array $elements, $depth ) {
		if ( $depth > self::MAX_DEPTH ) {
			return new WP_Error( 'ai2kit_too_deep', __( 'The converted page is nested too deeply.', 'ai2kit' ), array( 'status' => 400 ) );
		}
		$out = array();
		foreach ( $elements as $el ) {
			if ( ++$this->count > self::MAX_ELEMENTS ) {
				return new WP_Error( 'ai2kit_too_large', __( 'The converted page has too many elements.', 'ai2kit' ), array( 'status' => 400 ) );
			}
			if ( ! is_array( $el ) ) {
				return new WP_Error( 'ai2kit_invalid_element', __( 'The converted page contains an invalid element.', 'ai2kit' ), array( 'status' => 400 ) );
			}
			$type = $el['elType'] ?? '';
			if ( AtomicWriter::is_atomic( $el ) ) {
				// Atomic settings are parsed later by Elementor's own Props_Parser (AtomicWriter).
				$name = 'widget' === $type ? (string) ( $el['widgetType'] ?? '' ) : (string) $type;
				if ( ! in_array( $name, self::ATOMIC, true ) ) {
					return new WP_Error(
						'ai2kit_invalid_element',
						/* translators: %s: element type. */
						sprintf( __( 'The converted page contains an unsupported element (%s).', 'ai2kit' ), sanitize_text_field( $name ) ),
						array( 'status' => 400 )
					);
				}
				$clean = array(
					'id'       => $this->id( $el['id'] ?? '' ),
					'elType'   => 'widget' === $type ? 'widget' : $name,
					'isInner'  => ! empty( $el['isInner'] ),
					'settings' => is_array( $el['settings'] ?? null ) ? $el['settings'] : array(),
					'css'      => $this->css( $el['css'] ?? array() ),
				);
				if ( 'widget' === $type ) {
					$clean['widgetType'] = $name;
				}
				$children = $this->elements( (array) ( $el['elements'] ?? array() ), $depth + 1 );
				if ( is_wp_error( $children ) ) {
					return $children;
				}
				$clean['elements'] = $children;
				$out[]             = $clean;
				continue;
			}
			if ( 'container' === $type ) {
				$clean    = array(
					'id'       => $this->id( $el['id'] ?? '' ),
					'elType'   => 'container',
					'isInner'  => ! empty( $el['isInner'] ),
					'settings' => $this->settings( (array) ( $el['settings'] ?? array() ), 'container' ),
				);
				$children = $this->elements( (array) ( $el['elements'] ?? array() ), $depth + 1 );
				if ( is_wp_error( $children ) ) {
					return $children;
				}
				$clean['elements'] = $children;
			} elseif ( 'widget' === $type && in_array( $el['widgetType'] ?? '', self::WIDGETS, true ) ) {
				$clean = array(
					'id'         => $this->id( $el['id'] ?? '' ),
					'elType'     => 'widget',
					'widgetType' => $el['widgetType'],
					'settings'   => $this->settings( (array) ( $el['settings'] ?? array() ), $el['widgetType'] ),
					'elements'   => array(),
				);
			} else {
				return new WP_Error(
					'ai2kit_invalid_element',
					/* translators: %s: element type. */
					sprintf( __( 'The converted page contains an unsupported element (%s).', 'ai2kit' ), sanitize_text_field( (string) ( $el['widgetType'] ?? $type ) ) ),
					array( 'status' => 400 )
				);
			}
			$out[] = $clean;
		}
		return $out;
	}

	/**
	 * CSS blocks per breakpoint: declarations only (no rules, at-rules or markup).
	 *
	 * @param mixed $css Map of breakpoint => declarations.
	 * @return array<string, string>
	 */
	private function css( $css ) {
		$out = array();
		foreach ( array( 'desktop', 'tablet', 'mobile' ) as $bp ) {
			if ( isset( $css[ $bp ] ) && is_string( $css[ $bp ] ) && strlen( $css[ $bp ] ) < 8000 ) {
				$clean = preg_replace( '/[{}<>@\\\\]|\/\*|expression\s*\(|javascript:/i', '', $css[ $bp ] );
				if ( '' !== trim( (string) $clean ) ) {
					$out[ $bp ] = (string) $clean;
				}
			}
		}
		return $out;
	}

	/**
	 * Keep valid unique 7-hex IDs; replace anything else.
	 *
	 * @param mixed $id Proposed ID.
	 * @return string
	 */
	private function id( $id ) {
		$id = is_string( $id ) ? strtolower( $id ) : '';
		while ( ! preg_match( '/^[0-9a-f]{7}$/', $id ) || isset( $this->ids[ $id ] ) ) {
			$id = substr( md5( wp_generate_uuid4() ), 0, 7 );
		}
		$this->ids[ $id ] = true;
		return $id;
	}

	/**
	 * Sanitize a settings map for an element type.
	 *
	 * @param array<string, mixed> $settings Settings.
	 * @param string               $type     container | widget type.
	 * @return array<string, mixed>
	 */
	private function settings( array $settings, $type ) {
		$out = array();
		foreach ( $settings as $key => $value ) {
			if ( ! is_string( $key ) || ! preg_match( self::KEY_RE, $key ) ) {
				continue;
			}
			if ( '__globals__' === $key ) {
				$out[ $key ] = $this->globals( $value );
				continue;
			}
			$out[ $key ] = $this->value( $value, $key, $type, 0 );
		}
		return $out;
	}

	/**
	 * Global references: globals/colors?id=x or globals/typography?id=x only.
	 *
	 * @param mixed $value Map.
	 * @return array<string, mixed>
	 */
	private function globals( $value ) {
		$out = array();
		foreach ( (array) $value as $k => $ref ) {
			if ( is_string( $k ) && preg_match( self::KEY_RE, $k ) && is_string( $ref ) && preg_match( '#^globals/(colors|typography)\?id=[A-Za-z0-9_-]{1,40}$#', $ref ) ) {
				$out[ $k ] = $ref;
			}
		}
		return $out;
	}

	/**
	 * Sanitize one value by context.
	 *
	 * @param mixed  $value Value.
	 * @param string $key   Setting key (or nested key).
	 * @param string $type  Element type.
	 * @param int    $depth Nesting depth inside the value.
	 * @return mixed
	 */
	private function value( $value, $key, $type, $depth ) {
		if ( $depth > 6 ) {
			return null;
		}
		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			return $value;
		}
		if ( is_array( $value ) ) {
			$out = array();
			foreach ( $value as $k => $v ) {
				if ( is_int( $k ) || preg_match( self::KEY_RE, $k ) ) {
					$out[ $k ] = $this->value( $v, is_int( $k ) ? $key : $k, $type, $depth + 1 );
				}
			}
			return $out;
		}
		$value = (string) $value;

		// HTML fallback widget.
		if ( 'html' === $type && 'html' === $key ) {
			return current_user_can( 'unfiltered_html' ) ? $value : wp_kses_post( $value );
		}
		// Rich text.
		if ( ( 'text-editor' === $type && 'editor' === $key ) || ( 'heading' === $type && 'title' === $key ) ) {
			return wp_kses_post( $value );
		}
		// URLs. SVG data URIs are allowed only for icons awaiting upload.
		if ( 'url' === $key || preg_match( '/_url$/', $key ) ) {
			if ( preg_match( self::SVG_DATA_RE, $value ) && strlen( $value ) < 700000 ) {
				return $value;
			}
			return esc_url_raw( $value );
		}
		return sanitize_text_field( $value );
	}
}
