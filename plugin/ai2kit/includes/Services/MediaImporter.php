<?php
/**
 * Media import (PRD FR-26): job files, remote images and custom SVG icons
 * become Media Library attachments, deduped by SHA-1 (`_ai2kit_hash`).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * MediaImporter.
 */
final class MediaImporter {

	const IMAGE_EXT = array( 'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp' );

	/**
	 * Job UUID.
	 *
	 * @var string
	 */
	private $job;

	/**
	 * Job URL / dir prefix for local lookups.
	 *
	 * @var string
	 */
	private $job_url;

	/**
	 * Job directory.
	 *
	 * @var string
	 */
	private $job_dir;

	/**
	 * Whether to sideload remote URLs.
	 *
	 * @var bool
	 */
	private $remote;

	/**
	 * Resolved URL → [ url, id ] cache.
	 *
	 * @var array<string, mixed>
	 */
	private $cache = array();

	/**
	 * Attachments created by this import (for undo).
	 *
	 * @var int[]
	 */
	public $created = array();

	/**
	 * Count of reused (deduped) attachments.
	 *
	 * @var int
	 */
	public $reused = 0;

	/**
	 * URLs that couldn't be imported.
	 *
	 * @var string[]
	 */
	public $failed = array();

	/**
	 * Constructor.
	 *
	 * @param string $job    Job UUID.
	 * @param bool   $remote Sideload remote images.
	 */
	public function __construct( $job, $remote = true ) {
		$this->job     = $job;
		$this->job_url = Paths::job_url( $job );
		$this->job_dir = Paths::job_dir( $job );
		$this->remote  = $remote;
	}

	/**
	 * Walk elements; import every media value ({url, id}) and rewrite it.
	 *
	 * @param array<int, array<string, mixed>> $elements Elements.
	 * @return array<int, array<string, mixed>>
	 */
	public function process( array $elements ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		foreach ( $elements as &$el ) {
			$el['settings'] = $this->walk( $el['settings'] );
			if ( ! empty( $el['elements'] ) ) {
				$el['elements'] = $this->process( $el['elements'] );
			}
		}
		return $elements;
	}

	/**
	 * Recursively rewrite media values.
	 *
	 * @param mixed $value Settings value.
	 * @return mixed
	 */
	private function walk( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		// Atomic (v4) media: a typed image-src or svg-src whose url is itself a typed url value.
		if ( isset( $value['$$type'] ) && in_array( $value['$$type'], array( 'image-src', 'svg-src' ), true ) && is_array( $value['value'] ?? null ) ) {
			$url = $value['value']['url']['value'] ?? '';
			if ( is_string( $url ) && '' !== $url ) {
				$alt      = isset( $value['value']['alt']['value'] ) ? (string) $value['value']['alt']['value'] : '';
				$resolved = $this->resolve( $url, $alt );
				if ( $resolved ) {
					$value['value']['id']  = array(
						'$$type' => 'image-attachment-id',
						'value'  => $resolved['id'],
					);
					$value['value']['url'] = null;
				}
			}
			return $value;
		}
		if ( array_key_exists( 'url', $value ) && array_key_exists( 'id', $value ) && is_string( $value['url'] ) && '' !== $value['url'] ) {
			$resolved = $this->resolve( $value['url'], isset( $value['alt'] ) ? (string) $value['alt'] : '' );
			if ( $resolved ) {
				$value['url'] = $resolved['url'];
				$value['id']  = $resolved['id'];
			}
			return $value;
		}
		foreach ( $value as $k => $v ) {
			$value[ $k ] = $this->walk( $v );
		}
		return $value;
	}

	/**
	 * Resolve one URL to an attachment.
	 *
	 * @param string $url URL or data URI.
	 * @param string $alt Alt text.
	 * @return array<string, mixed>|null { url, id }
	 */
	public function resolve( $url, $alt = '' ) {
		if ( isset( $this->cache[ $url ] ) ) {
			return $this->cache[ $url ];
		}
		$result = null;
		if ( 0 === strpos( $url, 'data:image/svg+xml;base64,' ) ) {
			$svg    = SvgSanitizer::sanitize( (string) base64_decode( substr( $url, 26 ), true ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
			$result = $svg ? $this->import_bytes( $svg, 'icon.svg', $url, $alt ) : null;
		} elseif ( 0 === strpos( $url, $this->job_url . '/' ) ) {
			$result = $this->import_local( $url, $alt );
		} elseif ( preg_match( '#^https?://#i', $url ) ) {
			$existing = attachment_url_to_postid( $url );
			if ( $existing ) {
				$result = array(
					'url' => wp_get_attachment_url( $existing ),
					'id'  => $existing,
				);
			} elseif ( $this->remote ) {
				$result = $this->import_remote( $url, $alt );
			}
		}
		if ( ! $result && 0 !== strpos( $url, 'data:' ) && ! preg_match( '#^https?://#i', $url ) ) {
			$this->failed[] = $url;
		}
		$this->cache[ $url ] = $result;
		return $result;
	}

	/**
	 * A file inside the job folder.
	 *
	 * @param string $url Job URL.
	 * @param string $alt Alt text.
	 * @return array<string, mixed>|null
	 */
	private function import_local( $url, $alt ) {
		$rel  = rawurldecode( (string) wp_parse_url( substr( $url, strlen( $this->job_url ) ), PHP_URL_PATH ) );
		$path = realpath( $this->job_dir . $rel );
		$root = realpath( $this->job_dir );
		if ( ! $path || ! $root || 0 !== strpos( $path, $root . DIRECTORY_SEPARATOR ) || ! is_file( $path ) ) {
			$this->failed[] = $url;
			return null;
		}
		$bytes = (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( 'svg' === strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ) ) {
			$bytes = (string) SvgSanitizer::sanitize( $bytes );
		}
		return '' === $bytes ? null : $this->import_bytes( $bytes, basename( $path ), $url, $alt );
	}

	/**
	 * A remote image (download_url: size- and type-checked by core).
	 *
	 * @param string $url Remote URL.
	 * @param string $alt Alt text.
	 * @return array<string, mixed>|null
	 */
	private function import_remote( $url, $alt ) {
		$tmp = download_url( $url, 20 );
		if ( is_wp_error( $tmp ) ) {
			$this->failed[] = $url;
			return null;
		}
		$bytes = (string) file_get_contents( $tmp ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		wp_delete_file( $tmp );
		$name = basename( (string) wp_parse_url( $url, PHP_URL_PATH ) );
		if ( ! preg_match( '/\.[a-z0-9]{2,5}$/i', $name ) ) {
			$name .= '.' . $this->sniff_ext( $bytes );
		}
		if ( 'svg' === strtolower( pathinfo( $name, PATHINFO_EXTENSION ) ) ) {
			$bytes = (string) SvgSanitizer::sanitize( $bytes );
		}
		return '' === $bytes ? null : $this->import_bytes( $bytes, $name, $url, $alt );
	}

	/**
	 * Guess an extension from magic bytes.
	 *
	 * @param string $bytes Data.
	 * @return string
	 */
	private function sniff_ext( $bytes ) {
		$head = substr( $bytes, 0, 12 );
		if ( 0 === strpos( $head, "\x89PNG" ) ) {
			return 'png';
		}
		if ( 0 === strpos( $head, "\xFF\xD8" ) ) {
			return 'jpg';
		}
		if ( 0 === strpos( $head, 'GIF8' ) ) {
			return 'gif';
		}
		if ( 'WEBP' === substr( $head, 8, 4 ) ) {
			return 'webp';
		}
		if ( false !== stripos( substr( $bytes, 0, 500 ), '<svg' ) ) {
			return 'svg';
		}
		return 'jpg';
	}

	/**
	 * Store bytes as an attachment, or reuse an existing one with the same hash.
	 *
	 * @param string $bytes  File contents.
	 * @param string $name   File name.
	 * @param string $source Original URL.
	 * @param string $alt    Alt text.
	 * @return array<string, mixed>|null
	 */
	private function import_bytes( $bytes, $name, $source, $alt ) {
		$ext = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, self::IMAGE_EXT, true ) ) {
			return null;
		}
		$hash = sha1( $bytes );
		$dupe = get_posts(
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_key'       => '_ai2kit_hash', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_value'     => $hash, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			)
		);
		if ( $dupe ) {
			++$this->reused;
			return array(
				'url' => wp_get_attachment_url( $dupe[0] ),
				'id'  => (int) $dupe[0],
			);
		}

		// SVG isn't an allowed upload type by default; allow it only for this sanitized write.
		$allow_svg = static function ( $mimes ) {
			$mimes['svg'] = 'image/svg+xml';
			return $mimes;
		};
		if ( 'svg' === $ext ) {
			add_filter( 'upload_mimes', $allow_svg );
		}
		$upload = wp_upload_bits( sanitize_file_name( $name ), null, $bytes );
		if ( 'svg' === $ext ) {
			remove_filter( 'upload_mimes', $allow_svg );
		}
		if ( ! empty( $upload['error'] ) ) {
			$this->failed[] = $source;
			return null;
		}

		$type = wp_check_filetype( $upload['file'], 'svg' === $ext ? array( 'svg' => 'image/svg+xml' ) : null );
		$id   = wp_insert_attachment(
			array(
				'post_mime_type' => $type['type'] ? $type['type'] : 'image/' . $ext,
				'post_title'     => sanitize_text_field( pathinfo( $name, PATHINFO_FILENAME ) ),
				'post_status'    => 'inherit',
			),
			$upload['file'],
			0,
			true
		);
		if ( is_wp_error( $id ) ) {
			wp_delete_file( $upload['file'] );
			$this->failed[] = $source;
			return null;
		}
		if ( 'svg' !== $ext ) {
			wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) );
		}
		update_post_meta( $id, '_ai2kit_hash', $hash );
		update_post_meta( $id, '_ai2kit_job', $this->job );
		update_post_meta( $id, '_ai2kit_source', esc_url_raw( 0 === strpos( $source, 'data:' ) ? '' : $source ) );
		if ( '' !== $alt ) {
			update_post_meta( $id, '_wp_attachment_image_alt', sanitize_text_field( $alt ) );
		}
		$this->created[] = (int) $id;
		return array(
			'url' => $upload['url'],
			'id'  => (int) $id,
		);
	}
}
