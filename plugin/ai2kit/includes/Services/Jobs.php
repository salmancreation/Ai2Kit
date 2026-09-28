<?php
/**
 * Job creation from uploads and pasted HTML (PRD §6.1).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Jobs.
 */
final class Jobs {

	/**
	 * From an uploaded file ($_FILES entry).
	 *
	 * @param array $file Upload array.
	 * @return array
	 * @throws IngestException On invalid input.
	 */
	public static function from_upload( array $file ) {
		if ( ! empty( $file['error'] ) ) {
			throw new IngestException( 'ai2kit_upload_failed', __( 'The upload didn\'t finish.', 'ai2kit' ), __( 'Check your connection and the server upload limit, then try again.', 'ai2kit' ) );
		}
		$tmp  = (string) ( $file['tmp_name'] ?? '' );
		$name = sanitize_file_name( (string) ( $file['name'] ?? '' ) );
		$size = (int) ( $file['size'] ?? 0 );

		/**
		 * Whether to accept a non-HTTP-upload temp path (used by tests and CLI).
		 *
		 * @param bool $trusted Default false.
		 */
		$trusted = (bool) apply_filters( 'ai2kit_trust_upload_path', false );
		if ( ! $tmp || ! is_file( $tmp ) || ( ! $trusted && ! is_uploaded_file( $tmp ) ) ) {
			throw new IngestException( 'ai2kit_upload_failed', __( 'The upload didn\'t finish.', 'ai2kit' ), __( 'Try again.', 'ai2kit' ) );
		}
		$max = Settings::max_upload_bytes();
		if ( $size > $max || filesize( $tmp ) > $max ) {
			throw new IngestException(
				'ai2kit_too_large',
				/* translators: %d: size limit in megabytes. */
				sprintf( __( 'This file is larger than %d MB.', 'ai2kit' ), (int) ( $max / MB_IN_BYTES ) ),
				__( 'Remove large videos or unused files, or raise the limit with the ai2kit_max_upload_bytes filter.', 'ai2kit' ),
				413
			);
		}

		$ext = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, array( 'zip', 'html', 'htm' ), true ) ) {
			throw new IngestException( 'ai2kit_bad_type', __( 'This file type isn\'t supported.', 'ai2kit' ), __( 'Upload an .html file or a .zip of your built site.', 'ai2kit' ), 415 );
		}

		$uuid = wp_generate_uuid4();
		$dir  = self::make_dir( $uuid );
		try {
			if ( 'zip' === $ext ) {
				$head = (string) file_get_contents( $tmp, false, null, 0, 4 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				if ( "PK\x03\x04" !== $head && "PK\x05\x06" !== $head ) {
					throw new IngestException( 'ai2kit_bad_zip', __( 'This isn\'t a valid ZIP file.', 'ai2kit' ), __( 'Re-create the ZIP and try again.', 'ai2kit' ) );
				}
				$extracted = ( new ZipIngest() )->extract( $tmp, $dir );
				$files     = $extracted['files'];
				$skipped   = $extracted['skipped'];
			} else {
				copy( $tmp, $dir . '/index.html' );
				$files   = array( 'index.html' );
				$skipped = array();
			}
			$title = preg_replace( '/\.(zip|html?)$/i', '', $name );
			return self::finish( $uuid, $dir, $files, $skipped, $title );
		} catch ( \Throwable $e ) {
			Paths::remove_dir( $dir );
			throw $e;
		}
	}

	/**
	 * From pasted HTML.
	 *
	 * @param string $html Markup.
	 * @return array
	 * @throws IngestException On invalid input.
	 */
	public static function from_html( $html ) {
		if ( strlen( $html ) > 5 * MB_IN_BYTES ) {
			throw new IngestException( 'ai2kit_too_large', __( 'The pasted HTML is larger than 5 MB.', 'ai2kit' ), __( 'Save it as an .html file and upload that instead.', 'ai2kit' ), 413 );
		}
		$uuid = wp_generate_uuid4();
		$dir  = self::make_dir( $uuid );
		file_put_contents( $dir . '/index.html', $html ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		try {
			return self::finish( $uuid, $dir, array( 'index.html' ), array(), __( 'Pasted HTML', 'ai2kit' ) );
		} catch ( \Throwable $e ) {
			Paths::remove_dir( $dir );
			throw $e;
		}
	}

	/**
	 * Create the job directory.
	 *
	 * @param string $uuid Job UUID.
	 * @return string
	 * @throws IngestException When the folder can't be created.
	 */
	private static function make_dir( $uuid ) {
		Paths::ensure_jobs_root();
		$dir = Paths::job_dir( $uuid );
		if ( ! wp_mkdir_p( $dir ) ) {
			throw new IngestException( 'ai2kit_fs', __( 'We couldn\'t create a working folder in wp-content/uploads.', 'ai2kit' ), __( 'Check that the uploads folder is writable.', 'ai2kit' ), 500 );
		}
		return $dir;
	}

	/**
	 * Entry detection, script gating, rewrite, DB row.
	 *
	 * @param string   $uuid    Job UUID.
	 * @param string   $dir     Job directory.
	 * @param string[] $files   Extracted files.
	 * @param string[] $skipped Blocked files that were not extracted.
	 * @param string   $title   Default title.
	 * @return array
	 * @throws IngestException When no entry or scripts aren't allowed.
	 */
	private static function finish( $uuid, $dir, array $files, array $skipped, $title ) {
		$entry = ZipIngest::find_entry( $files );
		if ( ! $entry ) {
			$has_package = (bool) preg_grep( '#(^|/)package\.json$#i', $files );
			throw new IngestException(
				'ai2kit_no_entry',
				$has_package ? __( 'This ZIP is the project source, not the built site.', 'ai2kit' ) : __( 'This ZIP has no index.html.', 'ai2kit' ),
				$has_package ? __( 'Run "npm run build -- --base=./" and upload the dist folder as a ZIP.', 'ai2kit' ) : __( 'Upload the built dist folder, not the source.', 'ai2kit' ),
				422
			);
		}

		if ( ! current_user_can( 'unfiltered_html' ) && ZipIngest::has_scripts( $dir, $files ) ) {
			throw new IngestException(
				'ai2kit_scripts_not_allowed',
				__( 'This site runs JavaScript, and your account isn\'t allowed to run scripts on this site.', 'ai2kit' ),
				__( 'Ask an administrator (or a network super admin on multisite) to convert it.', 'ai2kit' ),
				403
			);
		}

		$entry_dir  = dirname( $entry );
		$root_dir   = '.' === $entry_dir ? $dir : $dir . '/' . $entry_dir;
		$root_url   = Paths::job_url( $uuid ) . ( '.' === $entry_dir ? '' : '/' . implode( '/', array_map( 'rawurlencode', explode( '/', $entry_dir ) ) ) );
		$root_files = array();
		$prefix     = '.' === $entry_dir ? '' : $entry_dir . '/';
		foreach ( $files as $f ) {
			if ( '' === $prefix || 0 === strpos( $f, $prefix ) ) {
				$root_files[] = substr( $f, strlen( $prefix ) );
			}
		}

		$rewriter = new AssetRewriter( $root_dir, $root_url );
		$rewriter->rewrite_all( $root_files );

		$entry_path = $dir . '/' . $entry;
		$html       = (string) file_get_contents( $entry_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$doc_title  = preg_match( '/<title[^>]*>(.*?)<\/title>/is', $html, $m ) ? trim( wp_strip_all_tags( html_entity_decode( $m[1] ) ) ) : '';
		file_put_contents( $entry_path, AssetRewriter::inject_sandbox( $html ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents

		$job = JobStore::create(
			array(
				'uuid'  => $uuid,
				'title' => $doc_title ? $doc_title : $title,
				'entry' => $entry,
			)
		);
		if ( ! $job ) {
			throw new IngestException( 'ai2kit_db', __( 'We couldn\'t save this conversion.', 'ai2kit' ), __( 'Deactivate and reactivate Ai2Kit to repair its database table.', 'ai2kit' ), 500 );
		}

		$view                = self::public_view( $job );
		$view['files']       = array_slice( $files, 0, 400 );
		$view['fileCount']   = count( $files );
		$view['entryHtml']   = substr( $html, 0, 200000 );
		$view['skipped']     = $skipped;
		$view['rewrite']     = array(
			'fixed'   => $rewriter->rewritten,
			'missing' => array_slice( $rewriter->missing, 0, 50 ),
		);
		$view['hasScripts'] = ZipIngest::has_scripts( $dir, $files );
		return $view;
	}

	/**
	 * Shape a job row for the UI.
	 *
	 * @param array $job Row.
	 * @return array
	 */
	public static function public_view( array $job ) {
		$files_exist = is_dir( Paths::job_dir( $job['uuid'] ) );
		return array(
			'uuid'       => $job['uuid'],
			'status'     => $job['status'],
			'title'      => $job['title'],
			'sourceType' => $job['source_type'],
			'score'      => $job['score'],
			'entryUrl'   => $files_exist ? Paths::job_url( $job['uuid'] ) . '/' . implode( '/', array_map( 'rawurlencode', explode( '/', $job['entry'] ) ) ) : null,
			'createdAt'  => self::iso( $job['created_at'] ),
			'importedAt' => $job['imported_at'] ? self::iso( $job['imported_at'] ) : null,
			'result'     => $job['result'],
			'canRerun'   => $files_exist,
		);
	}

	/**
	 * GMT MySQL datetime → ISO 8601 with offset.
	 *
	 * @param string $gmt Datetime in UTC.
	 * @return string
	 */
	private static function iso( $gmt ) {
		return gmdate( 'c', (int) strtotime( $gmt . ' UTC' ) );
	}

	/**
	 * Discard a job's files; forget it entirely when it was never imported.
	 *
	 * @param array $job Row.
	 */
	public static function discard( array $job ) {
		Cleanup::remove_job_files( $job['uuid'] );
		if ( 'uploaded' === $job['status'] ) {
			global $wpdb;
			$wpdb->delete( JobStore::table(), array( 'uuid' => $job['uuid'] ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		}
	}
}
