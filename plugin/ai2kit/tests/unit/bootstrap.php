<?php
/**
 * Unit bootstrap: pure services only, no WordPress.
 *
 * @package Ai2Kit
 */

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';

if ( ! function_exists( '__' ) ) {
	function __( $text, $domain = 'default' ) { // phpcs:ignore
		return $text;
	}
}

if ( ! function_exists( 'absint' ) ) {
	function absint( $n ) { // phpcs:ignore
		return abs( (int) $n );
	}
}
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
