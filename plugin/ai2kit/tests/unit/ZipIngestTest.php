<?php
/**
 * ZIP safety (PRD FR-2, §12.7 security tests).
 *
 * @package Ai2Kit
 */

use ModinaTheme\Ai2Kit\Services\IngestException;
use ModinaTheme\Ai2Kit\Services\ZipIngest;
use PHPUnit\Framework\TestCase;

final class ZipIngestTest extends TestCase {

	/** @var string */
	private $tmp;

	protected function setUp(): void {
		$this->tmp = sys_get_temp_dir() . '/a2k-test-' . bin2hex( random_bytes( 4 ) );
		mkdir( $this->tmp . '/out', 0755, true );
	}

	protected function tearDown(): void {
		exec( 'rm -rf ' . escapeshellarg( $this->tmp ) );
	}

	/**
	 * Build a ZIP from name => contents (null = directory).
	 *
	 * @param array    $entries Entries.
	 * @param callable $tweak   Optional hook receiving the ZipArchive.
	 * @return string
	 */
	private function zip( array $entries, $tweak = null ) {
		$path = $this->tmp . '/in.zip';
		$zip  = new ZipArchive();
		$zip->open( $path, ZipArchive::CREATE | ZipArchive::OVERWRITE );
		foreach ( $entries as $name => $body ) {
			null === $body ? $zip->addEmptyDir( $name ) : $zip->addFromString( $name, $body );
		}
		if ( $tweak ) {
			$tweak( $zip );
		}
		$zip->close();
		return $path;
	}

	private function expectIngestError( $slug, callable $fn ) {
		try {
			$fn();
			$this->fail( "Expected $slug" );
		} catch ( IngestException $e ) {
			$this->assertSame( $slug, $e->slug );
			$this->assertNotSame( '', $e->hint );
		}
	}

	public function test_extracts_a_normal_build() {
		$zip = $this->zip(
			array(
				'dist/'                 => null,
				'dist/index.html'       => '<div id="root"></div>',
				'dist/assets/index.js'  => 'console.log(1)',
				'__MACOSX/._index.html' => 'junk',
				'.DS_Store'             => 'junk',
			)
		);
		$r   = ( new ZipIngest() )->extract( $zip, $this->tmp . '/out' );
		$this->assertSame( array( 'dist/assets/index.js', 'dist/index.html' ), $r['files'] );
		$this->assertFileExists( $this->tmp . '/out/dist/index.html' );
		$this->assertFileDoesNotExist( $this->tmp . '/out/.DS_Store' );
	}

	/** @dataProvider slip_names */
	public function test_rejects_zip_slip( $name ) {
		$zip = $this->zip( array( 'index.html' => 'x' ), static function ( ZipArchive $z ) use ( $name ) {
			$z->addFromString( 'placeholder', 'evil' );
			$z->renameName( 'placeholder', $name );
		} );
		$this->expectIngestError( 'ai2kit_zip_slip', function () use ( $zip ) {
			( new ZipIngest() )->extract( $zip, $this->tmp . '/out' );
		} );
		$this->assertFileDoesNotExist( $this->tmp . '/evil.txt' );
		$this->assertFileDoesNotExist( $this->tmp . '/out/index.html', 'nothing is written when validation fails' );
	}

	public function slip_names() {
		return array(
			'parent'       => array( '../evil.txt' ),
			'nested'       => array( 'a/../../evil.txt' ),
			'absolute'     => array( '/etc/evil.txt' ),
			'windows'      => array( 'C:/evil.txt' ),
			'backslash'    => array( '..\\evil.txt' ),
		);
	}

	public function test_rejects_symlinks() {
		$zip = $this->zip( array( 'index.html' => 'x', 'link' => '/etc/passwd' ), static function ( ZipArchive $z ) {
			$z->setExternalAttributesName( 'link', ZipArchive::OPSYS_UNIX, ( 0120777 << 16 ) );
		} );
		$this->expectIngestError( 'ai2kit_zip_symlink', function () use ( $zip ) {
			( new ZipIngest() )->extract( $zip, $this->tmp . '/out' );
		} );
	}

	public function test_skips_executable_and_server_config_files() {
		$zip = $this->zip(
			array(
				'index.html'       => 'x',
				'shell.php'        => '<?php system($_GET[1]);',
				'img/a.PHTML'      => 'x',
				'x.phar'           => 'x',
				'.htaccess'        => 'x',
				'sub/.user.ini'    => 'x',
				'web.config'       => 'x',
				'style.php5'       => 'x',
			)
		);
		$r   = ( new ZipIngest() )->extract( $zip, $this->tmp . '/out' );
		$this->assertSame( array( 'index.html' ), $r['files'] );
		$this->assertCount( 7, $r['skipped'] );
		$this->assertFileDoesNotExist( $this->tmp . '/out/shell.php' );
		$this->assertFileDoesNotExist( $this->tmp . '/out/.htaccess' );
	}

	public function test_enforces_file_count_cap() {
		$zip = $this->zip( array( 'a.html' => '1', 'b.html' => '2', 'c.html' => '3' ) );
		$this->expectIngestError( 'ai2kit_too_many_files', function () use ( $zip ) {
			( new ZipIngest( 2 ) )->extract( $zip, $this->tmp . '/out' );
		} );
	}

	public function test_enforces_uncompressed_size_cap() {
		$zip = $this->zip( array( 'index.html' => str_repeat( 'A', 5000 ) ) );
		$this->expectIngestError( 'ai2kit_zip_too_big', function () use ( $zip ) {
			( new ZipIngest( 100, 1000 ) )->extract( $zip, $this->tmp . '/out' );
		} );
	}

	public function test_rejects_non_zip() {
		file_put_contents( $this->tmp . '/fake.zip', 'not a zip' );
		$this->expectIngestError( 'ai2kit_bad_zip', function () {
			( new ZipIngest() )->extract( $this->tmp . '/fake.zip', $this->tmp . '/out' );
		} );
	}

	public function test_safe_path() {
		$this->assertSame( 'a/b.html', ZipIngest::safe_path( './a//b.html' ) );
		$this->assertNull( ZipIngest::safe_path( "a\0.html" ) );
		$this->assertNull( ZipIngest::safe_path( '' ) );
		$this->assertNull( ZipIngest::safe_path( 'a/../../b' ) );
	}

	public function test_find_entry() {
		$this->assertSame( 'index.html', ZipIngest::find_entry( array( 'about.html', 'index.html' ) ) );
		$this->assertSame( 'dist/index.html', ZipIngest::find_entry( array( 'src/index.html', 'dist/index.html', 'package.json' ) ) );
		$this->assertSame( 'my-site/dist/index.html', ZipIngest::find_entry( array( 'my-site/index.html', 'my-site/dist/index.html' ) ) );
		$this->assertSame( 'site/index.htm', ZipIngest::find_entry( array( 'site/deep/index.html', 'site/index.htm' ) ) );
		$this->assertSame( 'home.html', ZipIngest::find_entry( array( 'css/a.css', 'home.html', 'x/y.html' ) ) );
		$this->assertNull( ZipIngest::find_entry( array( 'package.json', 'src/App.tsx' ) ) );
	}

	public function test_detects_scripts() {
		file_put_contents( $this->tmp . '/a.html', '<p onclick="x()">x</p>' );
		file_put_contents( $this->tmp . '/b.html', '<p>plain</p>' );
		$this->assertTrue( ZipIngest::has_scripts( $this->tmp, array( 'a.html' ) ) );
		$this->assertFalse( ZipIngest::has_scripts( $this->tmp, array( 'b.html' ) ) );
		$this->assertTrue( ZipIngest::has_scripts( $this->tmp, array( 'b.html', 'assets/x.js' ) ) );
	}
}
