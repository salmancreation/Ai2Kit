<?php
/**
 * Residual scoped CSS (PRD G6): styles no Elementor Free control expresses
 * (gradient text, transforms, filters) are stored per document and printed
 * scoped to it. The browser sends structured declarations, never raw CSS;
 * every property and value is checked here.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * ResidualCss.
 */
final class ResidualCss {

	const META = '_ai2kit_residual_css';

	const PROPS = array(
		'transform',
		'filter',
		'backdrop-filter',
		'-webkit-backdrop-filter',
		'mix-blend-mode',
		'background-image',
		'background-clip',
		'-webkit-background-clip',
		'color',
		'-webkit-text-fill-color',
		'font-family',
		// Leftovers from Elementor's CSS → atomic converter (v4).
		'width',
		'max-width',
		'height',
		'min-height',
		'align-self',
		'gap',
		'row-gap',
		'column-gap',
		'flex-shrink',
		'grid-template-columns',
		'object-fit',
		'inset-block-start',
		'inset-inline-start',
		'z-index',
		// Hover state leftovers (FR-22).
		'opacity',
		'box-shadow',
		'background-color',
		'border-color',
		'text-decoration',
		'transition',
		'transition-duration',
		'transition-property',
		'transition-timing-function',
	);

	/**
	 * Allowed states → selector suffix.
	 */
	const STATES = array(
		''      => '',
		'hover' => ':hover',
	);

	const TARGETS = array( '', ' .elementor-heading-title', ' .elementor-widget-container', ' .elementor-button', ' .elementor-button-icon svg', ' img' );

	const MEDIA = array(
		'desktop' => '',
		'tablet'  => '(max-width:1024px)',
		'mobile'  => '(max-width:767px)',
	);

	/**
	 * Whether a value is safe inside a declaration.
	 *
	 * @param string $value CSS value.
	 * @return bool
	 */
	public static function safe_value( $value ) {
		if ( ! is_string( $value ) || '' === $value || strlen( $value ) > 600 ) {
			return false;
		}
		// No breaking out of the declaration or the style element; no scripts or remote loads.
		if ( preg_match( '/[<>{};@\\\\]|\/\*|expression\s*\(|javascript:|behaviou?r\s*:|-moz-binding|url\s*\(/i', $value ) ) {
			return false;
		}
		// Quotes (font names) must be balanced, or the value could swallow the rest of the stylesheet.
		if ( 0 !== substr_count( $value, '"' ) % 2 || 0 !== substr_count( $value, "'" ) % 2 ) {
			return false;
		}
		return (bool) preg_match( '/^[a-zA-Z0-9\s#%.,()\-+\/"\']+$/', $value );
	}

	/**
	 * Compile validated rules into a scoped stylesheet.
	 *
	 * @param mixed $rules   Rules from the engine.
	 * @param int   $post_id Document ID (scope).
	 * @return string
	 */
	public static function build( $rules, $post_id ) {
		if ( ! is_array( $rules ) ) {
			return '';
		}
		$scope = '.elementor-' . absint( $post_id );
		$by    = array(
			'desktop' => array(),
			'tablet'  => array(),
			'mobile'  => array(),
		);
		foreach ( array_slice( $rules, 0, 500 ) as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}
			$class  = isset( $rule['className'] ) ? (string) $rule['className'] : '';
			$bp     = isset( $rule['breakpoint'] ) ? (string) $rule['breakpoint'] : 'desktop';
			$target = isset( $rule['target'] ) ? (string) $rule['target'] : '';
			$state  = isset( $rule['state'] ) ? (string) $rule['state'] : '';
			if ( ! preg_match( '/^(a2k-[a-z0-9-]{1,40}|e-[0-9a-f]{7}-a2k)$/', $class ) || ! isset( self::MEDIA[ $bp ] ) || ! in_array( $target, self::TARGETS, true ) || ! isset( self::STATES[ $state ] ) ) {
				continue;
			}
			$decls = array();
			foreach ( (array) ( $rule['decls'] ?? array() ) as $prop => $value ) {
				if ( in_array( $prop, self::PROPS, true ) && self::safe_value( $value ) ) {
					$decls[] = $prop . ':' . trim( $value ) . ' !important';
				}
			}
			if ( ! $decls ) {
				continue;
			}
			$label       = isset( $rule['label'] ) ? preg_replace( '/[^\p{L}\p{N} ?!.,\'-]/u', '', (string) $rule['label'] ) : '';
			$by[ $bp ][] = ( $label ? '/* ' . substr( $label, 0, 60 ) . " */\n" : '' ) . $scope . ' .' . $class . self::STATES[ $state ] . $target . '{' . implode( ';', $decls ) . '}';
		}
		$css = implode( "\n", $by['desktop'] );
		foreach ( array( 'tablet', 'mobile' ) as $bp ) {
			if ( $by[ $bp ] ) {
				$css .= "\n@media " . self::MEDIA[ $bp ] . "{\n" . implode( "\n", $by[ $bp ] ) . "\n}";
			}
		}
		return trim( $css );
	}

	/**
	 * Print a document's residual CSS whenever Elementor renders that document
	 * (pages, and templates rendered inside other pages). Hooked to
	 * `elementor/frontend/before_get_builder_content`, which fires for every
	 * document — unlike the post CSS enqueue hook, which Elementor skips for
	 * fully atomic (v4) documents that have no classic CSS.
	 *
	 * @param object $document Elementor document.
	 * @return void
	 */
	public static function enqueue( $document ) {
		if ( ! is_object( $document ) || ! method_exists( $document, 'get_main_id' ) ) {
			return;
		}
		$post_id = (int) $document->get_main_id();
		$css     = $post_id ? (string) get_post_meta( $post_id, self::META, true ) : '';
		if ( '' === $css ) {
			return;
		}
		$handle = 'ai2kit-residual-' . $post_id;
		if ( wp_style_is( $handle, 'enqueued' ) ) {
			return;
		}
		wp_register_style( $handle, false, array(), AI2KIT_VERSION );
		wp_enqueue_style( $handle );
		wp_add_inline_style( $handle, $css );
	}
}
