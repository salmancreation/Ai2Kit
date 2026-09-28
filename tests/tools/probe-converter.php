<?php
use Elementor\Modules\AtomicWidgets\CssConverter\Css_Converter;
use Elementor\Modules\AtomicWidgets\CssConverter\Converter_Registry_Factory;
use Elementor\Modules\AtomicWidgets\CssConverter\Expander_Registry_Factory;
use Elementor\Modules\AtomicWidgets\CssConverter\Metrics\Null_Failure_Reporter;
$c = new Css_Converter( Converter_Registry_Factory::create( null ), new Null_Failure_Reporter(), Expander_Registry_Factory::create( null ), null );
$tests = array( 'font-family: ui-sans-serif, system-ui, -apple-system, sans-serif', 'font-family: Inter', 'font-family: "DM Sans", sans-serif' );
foreach ( $tests as $t ) { $r = $c->convert( $t . ';' ); echo $t, ' => ', wp_json_encode( $r['props'] ), ' left=', $r['customCss'], "\n"; }
$tests = array();
foreach ( $tests as $t ) {
	$r = $c->convert( $t . ';' );
	printf( "%-70s props=%s left=%s rej=%s\n", substr( $t, 0, 70 ), implode( ',', array_keys( $r['props'] ) ) ?: '-', trim( $r['customCss'] ) ?: '-', implode( ',', (array) $r['rejected'] ) ?: '-' );
}
