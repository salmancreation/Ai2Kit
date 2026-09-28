<?php
/**
 * Dumps Elementor v4 (Atomic) prop schemas for the elements Ai2Kit emits and
 * the style schema. Output: tests/fixtures/elementor/atomic-schema.json.
 *
 * Run: npx wp-env run cli wp eval-file wp-content/ai2kit-tools/dump-atomic.php --context=admin > tests/fixtures/elementor/atomic-schema.json
 */
use Elementor\Modules\AtomicWidgets\Styles\Style_Schema;

$plugin = \Elementor\Plugin::$instance;
$out    = array(
	'elementor_version' => ELEMENTOR_VERSION,
	'atomic_active'     => $plugin->experiments->is_feature_active( 'e_atomic_elements' ),
	'elements'          => array(),
	'style_schema'      => array(),
);
$types = array_merge( $plugin->elements_manager->get_element_types(), $plugin->widgets_manager->get_widget_types() );
foreach ( array( 'e-flexbox', 'e-div-block', 'e-grid', 'e-heading', 'e-paragraph', 'e-button', 'e-image', 'e-svg', 'e-divider', 'e-youtube', 'e-list' ) as $name ) {
	if ( empty( $types[ $name ] ) ) {
		continue;
	}
	$class = get_class( $types[ $name ] );
	$out['elements'][ $name ] = array(
		'class'  => $class,
		'elType' => $types[ $name ] instanceof \Elementor\Widget_Base ? 'widget' : $name,
		'props'  => json_decode( wp_json_encode( $class::get_props_schema() ), true ),
	);
}
$out['style_schema'] = json_decode( wp_json_encode( Style_Schema::get() ), true );

/**
 * Keep only structure: drop dynamic-tag/overridable union members and editor meta.
 *
 * @param mixed $x Schema node.
 * @return mixed
 */
function ai2kit_trim_schema( $x ) {
	if ( ! is_array( $x ) ) {
		return $x;
	}
	$out = array();
	foreach ( $x as $k => $v ) {
		if ( in_array( $k, array( 'meta', 'initial_value', 'dependencies' ), true ) ) {
			continue;
		}
		if ( 'prop_types' === $k && is_array( $v ) ) {
			unset( $v['dynamic'], $v['overridable'] );
		}
		$out[ $k ] = ai2kit_trim_schema( $v );
	}
	return $out;
}
foreach ( $out['elements'] as $name => $el ) {
	$out['elements'][ $name ]['props'] = ai2kit_trim_schema( $el['props'] );
}
$out['style_schema'] = ai2kit_trim_schema( $out['style_schema'] );
echo wp_json_encode( $out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
