<?php
/**
 * Safe ZIP extraction (PRD FR-2).
 *
 * Rejects path traversal (zip-slip), symlinks and executable/server-config
 * files; caps file count and uncompressed size, counting real bytes written
 * rather than trusting the archive headers. Uses no WordPress functions so it
 * can be unit-tested in isolation.
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

/**
 * ZipIngest.
 */
final class ZipIngest {

	const MAX_FILES = 5000;
	const MAX_BYTES = 209715200; // 200 MB uncompressed.

	/** Executable or server-config files never leave the archive. */
	const BLOCKED = '/(\.(php\d?|phtml|phar|pht|phps|cgi|pl|py|sh|asp|aspx|jsp|exe|dll|so)$|(^|\/)\.(htaccess|htpasswd|user\.ini)$|(^|\/)web\.config$)/i';

	/** OS junk we silently skip. */
	const JUNK = '/(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|\.git\/|node_modules\/)/';

	/**
	 * Max files.
	 *
	 * @var int
	 */
	private $max_files;

	/**
	 * Max bytes.
	 *
	 * @var int
	 */
	private $max_bytes;

	/**
	 * Constructor.
	 *
	 * @param int $max_files Max file count.
	 * @param int $max_bytes Max total uncompressed bytes.
	 */
	public function __construct( $max_files = self::MAX_FILES, $max_bytes = self::MAX_BYTES ) {
		$this->max_files = $max_files;
		$this->max_bytes = $max_bytes;
	}

	/**
	 * Normalize an entry name, or null when it is unsafe.
	 *
	 * @param string $name Raw entry name.
	 * @return string|null
	 */
	public static function safe_path( $name ) {
		if ( ! is_string( $name ) || '' === $name || false !== strpos( $name, "\0" ) || preg_match( '/[\x00-\x1f]/', $name ) ) {
			return null;
		}
		$name = str_replace( '\\', '/', $name );
		if ( '/' === $name[0] || preg_match( '/^[a-zA-Z]:/', $name ) ) {
			return null;
		}
		$parts = array();
		foreach ( explode( '/', $name ) as $seg ) {
			if ( '' === $seg || '.' === $seg ) {
				continue;
			}
			if ( '..' === $seg ) {
				return null;
			}
			$parts[] = $seg;
		}
		return $parts ? implode( '/', $parts ) : null;
	}

	/**
	 * Extract into $dest (which must exist and be empty).
	 *
	 * @param string $zip_path Archive path.
	 * @param string $dest     Destination directory.
	 * @return array{files: string[], bytes: int, skipped: string[]}
	 * @throws IngestException When the archive is unsafe or unreadable.
	 */
	public function extract( $zip_path, $dest ) {
		if ( ! class_exists( '\ZipArchive' ) ) {
			throw new IngestException( 'ai2kit_no_zip', __( 'This server cannot open ZIP files (the PHP zip extension is missing).', 'ai2kit' ), __( 'Ask your host to enable the PHP "zip" extension, or upload a single HTML file instead.', 'ai2kit' ), 500 );
		}
		$zip = new \ZipArchive();
		if ( true !== $zip->open( $zip_path ) ) {
			throw new IngestException( 'ai2kit_bad_zip', __( 'We couldn\'t open this ZIP file.', 'ai2kit' ), __( 'Re-create the ZIP and try again.', 'ai2kit' ) );
		}

		try {
			$count = $zip->numFiles;
			if ( $count > $this->max_files ) {
				throw new IngestException( 'ai2kit_too_many_files', sprintf( /* translators: 1: number of files in the ZIP, 2: maximum allowed. */ __( 'This ZIP has %1$d files; the limit is %2$d.', 'ai2kit' ), $count, $this->max_files ), __( 'Upload only the built site (the dist folder), not the whole project.', 'ai2kit' ) );
			}

			// Pass 1: validate every entry before writing anything.
			$plan     = array();
			$declared = 0;
			$skipped  = array();
			for ( $i = 0; $i < $count; $i++ ) {
				$stat = $zip->statIndex( $i );
				$name = $stat['name'];
				if ( preg_match( self::JUNK, $name ) ) {
					continue;
				}
				$path = self::safe_path( $name );
				if ( null === $path ) {
					throw new IngestException( 'ai2kit_zip_slip', __( 'This ZIP contains an unsafe file path.', 'ai2kit' ), __( 'Re-create the ZIP from the site folder and try again.', 'ai2kit' ) );
				}
				if ( $this->is_symlink( $zip, $i ) ) {
					throw new IngestException( 'ai2kit_zip_symlink', __( 'This ZIP contains a symbolic link, which isn\'t allowed.', 'ai2kit' ), __( 'Re-create the ZIP without links.', 'ai2kit' ) );
				}
				$is_dir = '/' === substr( $name, -1 );
				if ( ! $is_dir && preg_match( self::BLOCKED, $path ) ) {
					$skipped[] = $path;
					continue;
				}
				$declared += (int) $stat['size'];
				if ( $declared > $this->max_bytes ) {
					throw new IngestException( 'ai2kit_zip_too_big', sprintf( /* translators: %d: size limit in megabytes. */ __( 'This ZIP unpacks to more than %d MB.', 'ai2kit' ), (int) ( $this->max_bytes / 1048576 ) ), __( 'Remove large videos or unused files and try again.', 'ai2kit' ) );
				}
				$plan[] = array( $i, $path, $is_dir );
			}

			// Pass 2: stream each file, counting the real bytes.
			$written = 0;
			$files   = array();
			foreach ( $plan as list( $i, $path, $is_dir ) ) {
				$target = $dest . '/' . $path;
				if ( $is_dir ) {
					$this->mkdir( $target );
					continue;
				}
				$this->mkdir( dirname( $target ) );
				$in = $zip->getStream( $zip->getNameIndex( $i ) );
				if ( ! $in ) {
					throw new IngestException( 'ai2kit_bad_zip', __( 'A file in this ZIP couldn\'t be read.', 'ai2kit' ), __( 'Re-create the ZIP and try again.', 'ai2kit' ) );
				}
				$out = fopen( $target, 'wb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
				while ( ! feof( $in ) ) {
					$chunk    = fread( $in, 65536 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
					$written += strlen( (string) $chunk );
					if ( $written > $this->max_bytes ) {
						fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
						fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
						throw new IngestException( 'ai2kit_zip_too_big', sprintf( /* translators: %d: size limit in megabytes. */ __( 'This ZIP unpacks to more than %d MB.', 'ai2kit' ), (int) ( $this->max_bytes / 1048576 ) ), __( 'Remove large videos or unused files and try again.', 'ai2kit' ) );
					}
					fwrite( $out, (string) $chunk ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				}
				fclose( $in ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				$files[] = $path;
			}
		} finally {
			$zip->close();
		}

		sort( $files );
		return array(
			'files'   => $files,
			'bytes'   => $written,
			'skipped' => $skipped,
		);
	}

	/**
	 * Unix symlink bit in the entry's external attributes.
	 *
	 * @param \ZipArchive $zip Archive.
	 * @param int         $i   Index.
	 * @return bool
	 */
	private function is_symlink( \ZipArchive $zip, $i ) {
		$opsys = 0;
		$attr  = 0;
		if ( ! $zip->getExternalAttributesIndex( $i, $opsys, $attr ) ) {
			return false;
		}
		return \ZipArchive::OPSYS_UNIX === $opsys && 0120000 === ( ( $attr >> 16 ) & 0170000 );
	}

	/**
	 * Create a directory tree.
	 *
	 * @param string $dir Directory.
	 */
	private function mkdir( $dir ) {
		if ( ! is_dir( $dir ) ) {
			mkdir( $dir, 0755, true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir
		}
	}

	/**
	 * Pick the entry HTML file: root index.html, then common build folders,
	 * then the shallowest index.html, then the shallowest .html file.
	 *
	 * @param string[] $files Relative paths.
	 * @return string|null
	 */
	public static function find_entry( array $files ) {
		$lower = array();
		foreach ( $files as $f ) {
			$lower[ strtolower( $f ) ] = $f;
		}
		$prefixes = array( '', 'dist/', 'out/', 'build/', 'public/', 'docs/' );
		foreach ( $prefixes as $p ) {
			foreach ( array( 'index.html', 'index.htm' ) as $name ) {
				if ( isset( $lower[ $p . $name ] ) ) {
					return $lower[ $p . $name ];
				}
			}
		}
		$by_depth = static function ( $a, $b ) {
			return substr_count( $a, '/' ) - substr_count( $b, '/' ) ?: strcmp( $a, $b );
		};
		$index = array_values( array_filter( $files, static function ( $f ) { return (bool) preg_match( '#(^|/)index\.html?$#i', $f ) && false === strpos( $f, 'node_modules/' ); } ) );
		if ( $index ) {
			usort( $index, $by_depth );
			// Prefer a built folder (dist/out/build) at any depth.
			foreach ( $index as $f ) {
				if ( preg_match( '#(^|/)(dist|out|build)/index\.html?$#i', $f ) ) {
					return $f;
				}
			}
			return $index[0];
		}
		$html = array_values( array_filter( $files, static function ( $f ) { return (bool) preg_match( '/\.html?$/i', $f ); } ) );
		if ( $html ) {
			usort( $html, $by_depth );
			return $html[0];
		}
		return null;
	}

	/**
	 * Whether the upload ships JavaScript (gated by unfiltered_html, PRD §10).
	 *
	 * @param string   $dir   Job directory.
	 * @param string[] $files Relative paths.
	 * @return bool
	 */
	public static function has_scripts( $dir, array $files ) {
		foreach ( $files as $f ) {
			if ( preg_match( '/\.(m?js|jsx|ts|tsx)$/i', $f ) ) {
				return true;
			}
			if ( preg_match( '/\.html?$/i', $f ) && filesize( $dir . '/' . $f ) < 5242880 ) {
				$html = (string) file_get_contents( $dir . '/' . $f ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				if ( preg_match( '/<script\b|\son[a-z]+\s*=/i', $html ) ) {
					return true;
				}
			}
		}
		return false;
	}
}
