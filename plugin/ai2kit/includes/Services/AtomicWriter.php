<?php
/**
 * Elementor v4 (Atomic) output (PRD §8.2).
 *
 * The engine sends atomic elements with typed content settings and plain CSS
 * per breakpoint. Here, Elementor's own CSS converter turns that CSS into
 * typed style props, Elementor's Style_Parser and Props_Parser validate and
 * sanitize styles and settings, and whatever the converter can't express is
 * returned as residual CSS scoped to the element's style class.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

use Elementor\Modules\AtomicWidgets\CssConverter\Converter_Registry_Factory;
use Elementor\Modules\AtomicWidgets\CssConverter\Css_Converter;
use Elementor\Modules\AtomicWidgets\CssConverter\Expander_Registry_Factory;
use Elementor\Modules\AtomicWidgets\CssConverter\Metrics\Null_Failure_Reporter;
use Elementor\Modules\AtomicWidgets\Parsers\Props_Parser;
use Elementor\Modules\AtomicWidgets\Parsers\Style_Parser;
use Elementor\Modules\AtomicWidgets\Styles\Style_Schema;

defined( 'ABSPATH' ) || exit;

/**
 * AtomicWriter.
 */
final class AtomicWriter {

	const BREAKPOINTS = array( 'desktop', 'tablet', 'mobile' );

	/**
	 * CSS blocks sent by the engine → style variant meta (breakpoint, state).
	 */
	const VARIANTS = array(
		'desktop' => array( 'desktop', null ),
		'tablet'  => array( 'tablet', null ),
		'mobile'  => array( 'mobile', null ),
		'hover'   => array( 'desktop', 'hover' ),
	);

	/**
	 * Converter instance.
	 *
	 * @var Css_Converter|null
	 */
	private $converter = null;

	/**
	 * Residual rules produced from converter leftovers.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	public $residual = array();

	/**
	 * Settings/style problems found while parsing (reported, not fatal).
	 *
	 * @var array<int, string>
	 */
	public $warnings = array();

	/**
	 * Whether this Elementor can build atomic elements.
	 *
	 * @return bool
	 */
	public static function available() {
		return class_exists( Css_Converter::class )
			&& class_exists( Props_Parser::class )
			&& class_exists( Style_Parser::class )
			&& \Elementor\Plugin::$instance->experiments->is_feature_active( 'e_atomic_elements' );
	}

	/**
	 * Whether an element (as sent by the engine) is atomic.
	 *
	 * @param array<string, mixed> $el Element.
	 * @return bool
	 */
	public static function is_atomic( array $el ) {
		$type = (string) ( $el['elType'] ?? '' );
		return 0 === strpos( $type, 'e-' ) || ( 'widget' === $type && 0 === strpos( (string) ( $el['widgetType'] ?? '' ), 'e-' ) );
	}

	/**
	 * Build atomic elements in a (possibly mixed) tree.
	 *
	 * @param array<int, array<string, mixed>> $elements Elements.
	 * @return array<int, array<string, mixed>>
	 */
	public function build( array $elements ) {
		foreach ( $elements as &$el ) {
			if ( self::is_atomic( $el ) ) {
				$el = $this->build_element( $el );
			}
			if ( ! empty( $el['elements'] ) ) {
				$el['elements'] = $this->build( $el['elements'] );
			}
		}
		return $elements;
	}

	/**
	 * One atomic element: settings parsed by its own schema, CSS converted to a local style.
	 *
	 * @param array<string, mixed> $el Element.
	 * @return array<string, mixed>
	 */
	private function build_element( array $el ) {
		$name  = 'widget' === $el['elType'] ? $el['widgetType'] : $el['elType'];
		$class = $this->element_class( $name );
		$css   = (array) ( $el['css'] ?? array() );
		unset( $el['css'] );

		$style_id = 'e-' . $el['id'] . '-a2k';
		$variants = array();
		foreach ( self::VARIANTS as $block => $meta ) {
			if ( empty( $css[ $block ] ) || ! is_string( $css[ $block ] ) ) {
				continue;
			}
			$result = $this->converter()->convert( $css[ $block ] );
			if ( ! empty( $result['props'] ) ) {
				$variants[] = array(
					'meta'       => array(
						'breakpoint' => $meta[0],
						'state'      => $meta[1],
					),
					'props'      => $result['props'],
					'custom_css' => null,
				);
			}
			$this->leftovers( (string) ( $result['customCss'] ?? '' ), $style_id, $meta[0], (string) $meta[1] );
		}

		$settings = (array) ( $el['settings'] ?? array() );
		unset( $settings['classes'] );
		$styles = array();
		if ( $variants ) {
			$style  = array(
				'id'       => $style_id,
				'label'    => 'local',
				'type'     => 'class',
				'variants' => $variants,
			);
			$parsed = Style_Parser::make( Style_Schema::get() )->parse( $style );
			if ( ! $parsed->is_valid() ) {
				$this->warnings[] = sprintf( 'Some styles on %s were dropped: %s', $name, implode( ', ', array_keys( (array) $parsed->errors()->all() ) ) );
			}
			$styles[ $style_id ] = $parsed->unwrap();
			$settings['classes'] = array(
				'$$type' => 'classes',
				'value'  => array( $style_id ),
			);
		} elseif ( $this->has_residual( $style_id ) ) {
			// Residual-only styles still need the class on the element.
			$settings['classes'] = array(
				'$$type' => 'classes',
				'value'  => array( $style_id ),
			);
		}

		if ( $class ) {
			$parsed = Props_Parser::make( $class::get_props_schema() )->parse( $settings );
			if ( ! $parsed->is_valid() ) {
				$this->warnings[] = sprintf( 'Some settings on %s were dropped: %s', $name, implode( ', ', array_keys( (array) $parsed->errors()->all() ) ) );
			}
			$settings = $parsed->unwrap();
		}

		$el['settings']        = $settings;
		$el['styles']          = $styles;
		$el['editor_settings'] = array();
		$el['version']         = '0.0';
		return $el;
	}

	/**
	 * CSS the converter couldn't express → residual rules scoped by the style class.
	 *
	 * @param string $css      Leftover declarations.
	 * @param string $style_id Style class.
	 * @param string $bp       Breakpoint.
	 * @param string $state    State ('' or 'hover').
	 * @return void
	 */
	private function leftovers( $css, $style_id, $bp, $state = '' ) {
		$decls = array();
		foreach ( explode( ';', $css ) as $decl ) {
			$parts = explode( ':', $decl, 2 );
			if ( 2 === count( $parts ) ) {
				$decls[ strtolower( trim( $parts[0] ) ) ] = trim( $parts[1] );
			}
		}
		if ( $decls ) {
			$rule = array(
				'className'  => $style_id,
				'breakpoint' => $bp,
				'decls'      => $decls,
			);
			if ( $state ) {
				$rule['state'] = $state;
			}
			$this->residual[] = $rule;
		}
	}

	/**
	 * Whether residual rules exist for a style class.
	 *
	 * @param string $style_id Style class.
	 * @return bool
	 */
	private function has_residual( $style_id ) {
		foreach ( $this->residual as $r ) {
			if ( $r['className'] === $style_id ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * The PHP class of a registered atomic element type.
	 *
	 * @param string $name Element type.
	 * @return string|null
	 */
	private function element_class( $name ) {
		$plugin = \Elementor\Plugin::$instance;
		$type   = $plugin->widgets_manager->get_widget_types( $name );
		if ( ! $type ) {
			$type = $plugin->elements_manager->get_element_types( $name );
		}
		return $type && method_exists( $type, 'get_props_schema' ) ? get_class( $type ) : null;
	}

	/**
	 * Elementor's CSS → atomic converter (without Variables: tokens stay literal values).
	 *
	 * @return Css_Converter
	 */
	private function converter() {
		if ( null === $this->converter ) {
			$this->converter = new Css_Converter(
				Converter_Registry_Factory::create( null ),
				new Null_Failure_Reporter(),
				Expander_Registry_Factory::create( null ),
				null
			);
		}
		return $this->converter;
	}
}
