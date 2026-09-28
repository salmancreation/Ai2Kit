<?php
/**
 * User-facing ingest error: what happened + what to do next (DESIGN.md §6.4).
 *
 * @package Ai2Kit
 */

namespace ModinaTheme\Ai2Kit\Services;

/**
 * IngestException.
 */
class IngestException extends \RuntimeException {

	/**
	 * Machine code.
	 *
	 * @var string
	 */
	public $slug;

	/**
	 * HTTP status.
	 *
	 * @var int
	 */
	public $status;

	/**
	 * What to do next.
	 *
	 * @var string
	 */
	public $hint;

	/**
	 * Constructor.
	 *
	 * @param string $slug    Machine code.
	 * @param string $message What happened.
	 * @param string $hint    What to do next.
	 * @param int    $status  HTTP status.
	 */
	public function __construct( $slug, $message, $hint = '', $status = 400 ) {
		parent::__construct( $message );
		$this->slug   = $slug;
		$this->hint   = $hint;
		$this->status = $status;
	}
}
