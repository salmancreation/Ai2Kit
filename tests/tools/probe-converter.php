<?php
/**
 * Show how Elementor's CSS → atomic converter handles given declarations.
 * Usage: npx wp-env run cli wp eval-file wp-content/ai2kit-tools/probe-converter.php
 */
use Elementor\Modules\AtomicWidgets\CssConverter\Css_Converter;
use Elementor\Modules\AtomicWidgets\CssConverter\Converter_Registry_Factory;
use Elementor\Modules\AtomicWidgets\CssConverter\Expander_Registry_Factory;
use Elementor\Modules\AtomicWidgets\CssConverter\Metrics\Null_Failure_Reporter;
$c = new Css_Converter( Converter_Registry_Factory::create( null ), new Null_Failure_Reporter(), Expander_Registry_Factory::create( null ), null );
$tests = array(
	'line-height: 1.2em',
	'background-image: url("https://example.test/a.jpg"); background-size: cover; background-position: 50% 50%; background-repeat: no-repeat',
	'background-image: linear-gradient(180deg, rgba(11, 31, 56, 0.35) 0%, rgba(11, 31, 56, 0.92) 100%), url("https://example.test/a.jpg"); background-size: auto, cover; background-position: 0% 0%, 50% 50%; background-repeat: repeat, no-repeat',
	'background: linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.5) 100%), url("https://example.test/a.jpg") center / cover no-repeat, rgb(11, 31, 56)',
	'transition: all 0.2s ease',
	'transition-duration: 0.15s',
	'transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
	'transition-property: color, background-color; transition-duration: 0.15s; transition-timing-function: ease',
	'box-shadow: 0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
	'transform: translate(0px, -4px)',
	'transform: scale(1.05, 1.05)',
	'opacity: 0.9',
	'background-color: rgb(20, 30, 40)',
	'border-color: rgb(20, 30, 40)',
	'text-decoration: underline',
);
foreach ( $tests as $t ) {
	$r = $c->convert( $t . ';' );
	printf( "%-70s props=%s left=%s\n", substr( $t, 0, 70 ), wp_json_encode( $r['props'] ) ?: '-', trim( $r['customCss'] ) ?: '-' );
}
