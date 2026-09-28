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
