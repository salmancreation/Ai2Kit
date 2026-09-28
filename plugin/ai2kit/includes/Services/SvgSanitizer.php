<?php
/**
 * Allowlist SVG sanitizer (PRD §10: SVGs are sanitized before entering the
 * Media Library). Drops scripts, event handlers, foreignObject, external
 * references and anything not on the allowlist. No WordPress functions.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- PHP's DOM API (documentElement, childNodes, …).

/**
 * SvgSanitizer.
 */
final class SvgSanitizer {

	const MAX_BYTES = 512000;

	const TAGS = array(
		'svg',
		'g',
		'path',
		'circle',
		'ellipse',
		'line',
		'polyline',
		'polygon',
		'rect',
		'defs',
		'lineargradient',
		'radialgradient',
		'stop',
		'clippath',
		'mask',
		'pattern',
		'symbol',
		'use',
		'title',
		'desc',
		'text',
		'tspan',
		'filter',
		'fegaussianblur',
		'feoffset',
		'feblend',
		'fecolormatrix',
		'femerge',
		'femergenode',
		'feflood',
		'fecomposite',
	);

	const ATTRS = array(
		'xmlns',
		'xmlns:xlink',
		'viewbox',
		'width',
		'height',
		'x',
		'y',
		'x1',
		'x2',
		'y1',
		'y2',
		'cx',
		'cy',
		'r',
		'rx',
		'ry',
		'd',
		'points',
		'fill',
		'fill-opacity',
		'fill-rule',
		'clip-rule',
		'stroke',
		'stroke-width',
		'stroke-linecap',
		'stroke-linejoin',
		'stroke-miterlimit',
		'stroke-dasharray',
		'stroke-dashoffset',
		'stroke-opacity',
		'opacity',
		'transform',
		'id',
		'class',
		'offset',
		'stop-color',
		'stop-opacity',
		'gradientunits',
		'gradienttransform',
		'clip-path',
		'mask',
		'preserveaspectratio',
		'href',
		'xlink:href',
		'font-size',
		'font-family',
		'font-weight',
		'text-anchor',
		'dominant-baseline',
		'stddeviation',
		'dx',
		'dy',
		'in',
		'in2',
		'result',
		'mode',
		'values',
		'type',
		'flood-color',
		'flood-opacity',
		'operator',
		'k1',
		'k2',
		'k3',
		'k4',
		'patternunits',
		'filterunits',
		'color',
		'version',
		'role',
		'aria-hidden',
	);

	/**
	 * Sanitize SVG markup. Returns null when it isn't a usable SVG.
	 *
	 * @param string $svg Markup.
	 * @return string|null
	 */
	public static function sanitize( $svg ) {
		if ( ! is_string( $svg ) || '' === trim( $svg ) || strlen( $svg ) > self::MAX_BYTES ) {
			return null;
		}
		// No DTDs / entities (XXE, billion laughs).
		if ( preg_match( '/<!DOCTYPE|<!ENTITY/i', $svg ) ) {
			return null;
		}
		$prev = libxml_use_internal_errors( true );
		$dom  = new \DOMDocument();
		$ok   = $dom->loadXML( $svg, LIBXML_NONET | LIBXML_NOBLANKS );
		libxml_clear_errors();
		libxml_use_internal_errors( $prev );
		if ( ! $ok || ! $dom->documentElement || 'svg' !== strtolower( $dom->documentElement->localName ) ) {
			return null;
		}
		self::clean( $dom->documentElement );
		if ( ! $dom->documentElement->hasAttribute( 'xmlns' ) ) {
			$dom->documentElement->setAttribute( 'xmlns', 'http://www.w3.org/2000/svg' );
		}
		return $dom->saveXML( $dom->documentElement );
	}

	/**
	 * Recursively remove disallowed nodes and attributes.
	 *
	 * @param \DOMElement $el Element.
	 * @return void
	 */
	private static function clean( \DOMElement $el ) {
		// Iterate over a static copy: removing while iterating a live list skips nodes.
		foreach ( iterator_to_array( $el->childNodes ) as $child ) {
			if ( $child instanceof \DOMElement ) {
				if ( ! in_array( strtolower( $child->localName ), self::TAGS, true ) ) {
					$el->removeChild( $child );
					continue;
				}
				self::clean( $child );
			} elseif ( $child instanceof \DOMProcessingInstruction || $child instanceof \DOMComment ) {
				$el->removeChild( $child );
			}
		}
		foreach ( iterator_to_array( $el->attributes ) as $attr ) {
			$name  = strtolower( $attr->nodeName );
			$value = trim( $attr->nodeValue );
			$bad   = ! in_array( $name, self::ATTRS, true )
				|| preg_match( '/^\s*(javascript|vbscript|data):/i', $value )
				|| ( in_array( $name, array( 'href', 'xlink:href' ), true ) && 0 !== strpos( $value, '#' ) )
				|| preg_match( '/url\(\s*["\']?(?!#)/i', $value )
				|| preg_match( '/expression\s*\(/i', $value );
			if ( $bad ) {
				$el->removeAttributeNode( $attr );
			}
		}
	}
}
// phpcs:enable
