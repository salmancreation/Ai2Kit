<?php
/**
 * REST permissions and job creation (PRD §10, §12.7).
 *
 * @package Ai2Kit
 */

use Ai2Kit\Tests\TestCase;
use ModinaTheme\Ai2Kit\Services\Paths;

final class RestTest extends TestCase {

	public function test_every_route_requires_manage_options() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		foreach ( array( array( 'GET', '/jobs' ), array( 'POST', '/jobs' ), array( 'GET', '/preflight' ), array( 'POST', '/preflight', array( 'check' => 'container' ) ), array( 'GET', '/settings' ), array( 'POST', '/settings' ), array( 'POST', '/jobs/' . wp_generate_uuid4() . '/import' ), array( 'POST', '/jobs/' . wp_generate_uuid4() . '/undo' ) ) as $call ) {
			list( $m, $r ) = $call;
			$this->assertSame( 403, $this->rest( $m, $r, $call[2] ?? array() )->get_status(), "$m $r" );
		}
		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->rest( 'GET', '/jobs' )->get_status() );
	}

	public function test_pasted_html_creates_a_sandboxed_job() {
		$res = $this->rest( 'POST', '/jobs', array( 'html' => '<html><head><title>Paste</title></head><body><img src="/logo.png"><p>Hi</p></body></html>' ) );
		$this->assertSame( 201, $res->get_status() );
		$job = $res->get_data();
		$this->assertSame( 'Paste', $job['title'] );
		$this->assertStringStartsWith( Paths::job_url( $job['uuid'] ), $job['entryUrl'] );
		$html = file_get_contents( Paths::job_dir( $job['uuid'] ) . '/index.html' );
		$this->assertStringContainsString( 'Content-Security-Policy', $html );
		$this->assertContains( '/logo.png', $job['rewrite']['missing'] );
		$this->assertFileExists( dirname( Paths::jobs_root() ) . '/.htaccess' );
		$this->assertFileExists( Paths::jobs_root() . '/index.php' );
	}

	public function test_zip_upload_skips_php_and_rejects_zip_slip() {
		$tmp = wp_tempnam( 'a2k.zip' );
		$zip = new ZipArchive();
		$zip->open( $tmp, ZipArchive::OVERWRITE );
		$zip->addFromString( 'dist/index.html', '<div id="root"></div><script type="module" src="/assets/index-a.js"></script>' );
		$zip->addFromString( 'dist/assets/index-a.js', 'const u="/assets/hero.png";' );
		$zip->addFromString( 'dist/assets/hero.png', 'png' );
		$zip->addFromString( 'dist/backdoor.php', '<?php echo 1;' );
		$zip->close();

		$res = $this->rest( 'POST', '/jobs', array(), array( 'file' => array( 'name' => 'site.zip', 'tmp_name' => $tmp, 'size' => filesize( $tmp ), 'error' => 0 ) ) );
		$this->assertSame( 201, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$job = $res->get_data();
		$dir = Paths::job_dir( $job['uuid'] );
		$this->assertFileDoesNotExist( $dir . '/dist/backdoor.php' );
		$this->assertSame( array( 'dist/backdoor.php' ), $job['skipped'] );
		$this->assertStringEndsWith( '/dist/index.html', $job['entryUrl'] );
		$this->assertStringContainsString( Paths::job_url( $job['uuid'] ) . '/dist/assets/hero.png', file_get_contents( $dir . '/dist/assets/index-a.js' ) );
		$this->assertTrue( $job['hasScripts'] );

		// Zip-slip → clean 400 and no folder left behind.
		$before = glob( Paths::jobs_root() . '/*', GLOB_ONLYDIR );
		$zip    = new ZipArchive();
		$zip->open( $tmp, ZipArchive::OVERWRITE );
		$zip->addFromString( 'index.html', 'x' );
		$zip->addFromString( 'tmp', 'evil' );
		$zip->renameName( 'tmp', '../../evil.php.txt' );
		$zip->close();
		$res = $this->rest( 'POST', '/jobs', array(), array( 'file' => array( 'name' => 'evil.zip', 'tmp_name' => $tmp, 'size' => filesize( $tmp ), 'error' => 0 ) ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( 'ai2kit_zip_slip', $res->get_data()['code'] );
		$this->assertEquals( $before, glob( Paths::jobs_root() . '/*', GLOB_ONLYDIR ) );
	}

	public function test_source_zip_without_build_explains_how_to_build() {
		$tmp = wp_tempnam( 'a2k.zip' );
		$zip = new ZipArchive();
		$zip->open( $tmp, ZipArchive::OVERWRITE );
		$zip->addFromString( 'package.json', '{}' );
		$zip->addFromString( 'src/App.tsx', 'export default 1' );
		$zip->close();
		$res = $this->rest( 'POST', '/jobs', array(), array( 'file' => array( 'name' => 'src.zip', 'tmp_name' => $tmp, 'size' => filesize( $tmp ), 'error' => 0 ) ) );
		$this->assertSame( 422, $res->get_status() );
		$this->assertStringContainsString( '--base=./', $res->get_data()['data']['hint'] );
	}

	public function test_scripts_need_unfiltered_html() {
		$deny = static function ( $caps, $cap ) {
			return 'unfiltered_html' === $cap ? array( 'do_not_allow' ) : $caps;
		};
		add_filter( 'map_meta_cap', $deny, 10, 2 );
		$res = $this->rest( 'POST', '/jobs', array( 'html' => '<p>x</p><script>alert(1)</script>' ) );
		remove_filter( 'map_meta_cap', $deny, 10 );
		$this->assertSame( 403, $res->get_status() );
		$this->assertSame( 'ai2kit_scripts_not_allowed', $res->get_data()['code'] );
	}

	public function test_rejects_wrong_file_types() {
		$tmp = wp_tempnam( 'a2k.exe' );
		file_put_contents( $tmp, 'MZ' );
		$res = $this->rest( 'POST', '/jobs', array(), array( 'file' => array( 'name' => 'tool.exe', 'tmp_name' => $tmp, 'size' => 2, 'error' => 0 ) ) );
		$this->assertSame( 415, $res->get_status() );
		$res = $this->rest( 'POST', '/jobs', array() );
		$this->assertSame( 400, $res->get_status() );
	}

	public function test_preflight_reports_elementor_and_fixes_container() {
		$data = $this->rest( 'GET', '/preflight' )->get_data();
		$ids  = wp_list_pluck( $data['checks'], 'status', 'id' );
		$this->assertSame( 'success', $ids['elementor'] );
		$this->assertArrayHasKey( 'container', $ids );
		$this->assertSame( 400, $this->rest( 'POST', '/preflight', array( 'check' => 'nope' ) )->get_status() );
		$this->assertSame( 200, $this->rest( 'POST', '/preflight', array( 'check' => 'container' ) )->get_status() );
		$this->assertSame( 'active', get_option( 'elementor_experiment-container' ) );
	}

	public function test_settings_validate_enums() {
		$saved = $this->rest( 'POST', '/settings', array( 'output' => 'template', 'kitMode' => 'bogus', 'keepSource' => 1 ) )->get_data();
		$this->assertSame( 'template', $saved['output'] );
		$this->assertSame( 'merge', $saved['kitMode'] );
		$this->assertTrue( $saved['keepSource'] );
	}
}
