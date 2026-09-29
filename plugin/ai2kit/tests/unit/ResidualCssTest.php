<?php
/**
 * Residual CSS validation and scoping (PRD G6, §10).
 *
 * @package Ai2Kit
 */

use ModinaTheme\Ai2Kit\Services\ResidualCss;
use PHPUnit\Framework\TestCase;

final class ResidualCssTest extends TestCase {

	public function test_scopes_rules_per_document_and_breakpoint() {
		$css = ResidualCss::build(
			array(
				array( 'className' => 'a2k-r-abc1234', 'target' => ' .elementor-heading-title', 'breakpoint' => 'desktop', 'decls' => array( 'background-image' => 'linear-gradient(90deg, rgb(124, 58, 237), #2563eb)', '-webkit-background-clip' => 'text', 'color' => 'transparent' ), 'label' => 'Hero' ),
				array( 'className' => 'a2k-r-def5678', 'breakpoint' => 'mobile', 'decls' => array( 'transform' => 'none' ) ),
			),
			42
		);
		$this->assertStringContainsString( "/* Hero */\n.elementor-42 .a2k-r-abc1234 .elementor-heading-title{background-image:linear-gradient(90deg, rgb(124, 58, 237), #2563eb) !important;-webkit-background-clip:text !important;color:transparent !important}", $css );
		$this->assertStringContainsString( "@media (max-width:767px){\n.elementor-42 .a2k-r-def5678{transform:none !important}\n}", $css );
	}

	public function test_hover_state_rules() {
		$css = ResidualCss::build(
			array( array( 'className' => 'e-abc1234-a2k', 'breakpoint' => 'desktop', 'state' => 'hover', 'decls' => array( 'transition-duration' => '0.2s', 'box-shadow' => '0px 4px 6px 0px rgba(0, 0, 0, 0.1)' ) ) ),
			7
		);
		$this->assertSame( '.elementor-7 .e-abc1234-a2k:hover{transition-duration:0.2s !important;box-shadow:0px 4px 6px 0px rgba(0, 0, 0, 0.1) !important}', $css );
	}

	/** @dataProvider hostile */
	public function test_rejects_hostile_input( $rule ) {
		$this->assertSame( '', ResidualCss::build( array( $rule ), 1 ) );
	}

	public function hostile() {
		$ok = array( 'className' => 'a2k-r-x', 'breakpoint' => 'desktop' );
		return array(
			'breakout'        => array( $ok + array( 'decls' => array( 'color' => 'red}body{display:none' ) ) ),
			'style end'       => array( $ok + array( 'decls' => array( 'color' => '</style><script>alert(1)</script>' ) ) ),
			'remote url'      => array( $ok + array( 'decls' => array( 'background-image' => 'url(https://evil.test/p.png)' ) ) ),
			'expression'      => array( $ok + array( 'decls' => array( 'filter' => 'expression(alert(1))' ) ) ),
			'import'          => array( $ok + array( 'decls' => array( 'color' => '@import "x"' ) ) ),
			'comment'         => array( $ok + array( 'decls' => array( 'color' => 'red/*' ) ) ),
			'unknown prop'    => array( $ok + array( 'decls' => array( 'position' => 'fixed' ) ) ),
			'bad state'       => array( $ok + array( 'state' => 'hover{}', 'decls' => array( 'color' => 'red' ) ) ),
			'bad class'       => array( array( 'className' => 'x}body{', 'breakpoint' => 'desktop', 'decls' => array( 'color' => 'red' ) ) ),
			'bad target'      => array( $ok + array( 'target' => ' *', 'decls' => array( 'color' => 'red' ) ) ),
			'unbalanced quote' => array( $ok + array( 'decls' => array( 'font-family' => '"Inter, sans-serif' ) ) ),
			'bad breakpoint'  => array( array( 'className' => 'a2k-r-x', 'breakpoint' => 'print', 'decls' => array( 'color' => 'red' ) ) ),
		);
	}

	public function test_allows_font_stacks() {
		$css = ResidualCss::build( array( array( 'className' => 'a2k-r-x', 'breakpoint' => 'desktop', 'decls' => array( 'font-family' => 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' ) ) ), 1 );
		$this->assertStringContainsString( 'font-family:ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif !important', $css );
	}

	public function test_label_cannot_close_the_comment() {
		$css = ResidualCss::build( array( array( 'className' => 'a2k-r-x', 'breakpoint' => 'desktop', 'decls' => array( 'color' => 'red' ), 'label' => 'Hi */ body{display:none} /*' ) ), 3 );
		$this->assertSame( 1, substr_count( $css, '*/' ) );
		$this->assertStringNotContainsString( 'display:none', $css );
	}
}
