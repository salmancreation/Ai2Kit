<?php
/**
 * Dumps Elementor's control registry for the element types Ai2Kit emits.
 * Output: tests/fixtures/elementor/controls-v3.json — the reference the v3
 * emitter's settings keys are validated against (PRD §0.4, §12.2).
 *
 * Run: npx wp-env run cli wp eval-file wp-content/ai2kit-tools/dump-controls.php --context=admin > tests/fixtures/elementor/controls-v3.json
 */
$plugin  = \Elementor\Plugin::$instance;
// Style controls are only registered in editor context (optimized control loading).
\Elementor\Core\Frontend\Performance::set_use_style_controls( true );
$widgets = [ 'heading', 'text-editor', 'image', 'button', 'icon', 'icon-list', 'video', 'divider', 'spacer', 'html', 'accordion', 'tabs', 'image-carousel', 'icon-box', 'image-box', 'counter', 'testimonial' ];
$out     = [
	'elementor_version' => ELEMENTOR_VERSION,
	'experiments'       => [],
	'elements'          => [],
	'widgets'           => [],
	'element_types'     => array_keys( $plugin->elements_manager->get_element_types() ),
	'widget_types'      => array_keys( $plugin->widgets_manager->get_widget_types() ),
];
foreach ( [ 'container', 'e_atomic_elements', 'nested-elements', 'e_opt_in_v4_page', 'e_classes', 'e_variables' ] as $exp ) {
	$out['experiments'][ $exp ] = $plugin->experiments->is_feature_active( $exp );
}
$simplify = static function ( array $controls ) {
	$r = [];
	foreach ( $controls as $name => $c ) {
		if ( in_array( $c['type'] ?? '', [ 'section', 'tab', 'tabs', 'heading', 'raw_html', 'divider', 'deprecated_notice', 'alert', 'notice' ], true ) ) {
			continue;
		}
		$entry = [ 'type' => $c['type'] ?? '' ];
		if ( isset( $c['default'] ) && '' !== $c['default'] && [] !== $c['default'] ) {
			$entry['default'] = $c['default'];
		}
		if ( ! empty( $c['options'] ) && is_array( $c['options'] ) ) {
			$entry['options'] = array_map( 'strval', array_keys( $c['options'] ) );
		}
		if ( ! empty( $c['is_responsive'] ) || array_key_exists( 'responsive', $c ) ) {
			$entry['responsive'] = true;
		}
		if ( ! empty( $c['fields'] ) && is_array( $c['fields'] ) ) {
			$entry['fields'] = array_keys( $c['fields'] );
		}
		$r[ $name ] = $entry;
	}
	ksort( $r );
	return $r;
};
$container = $plugin->elements_manager->get_element_types( 'container' );
if ( $container ) {
	$out['elements']['container'] = $simplify( $container->get_controls() );
}
foreach ( $widgets as $w ) {
	$type = $plugin->widgets_manager->get_widget_types( $w );
	if ( $type ) {
		$out['widgets'][ $w ] = $simplify( $type->get_controls() );
	}
}
$kit = $plugin->kits_manager->get_active_kit_for_frontend();
$out['kit'] = [
	'system_colors'     => $kit->get_settings( 'system_colors' ),
	'system_typography' => array_map( static function ( $t ) { return [ '_id' => $t['_id'], 'title' => $t['title'] ]; }, (array) $kit->get_settings( 'system_typography' ) ),
];
echo wp_json_encode( $out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
