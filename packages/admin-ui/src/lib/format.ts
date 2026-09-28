/** Small, pure formatting helpers (unit-tested). */

export function bytes( n: number ): string {
	if ( n < 1024 ) return `${ n } B`;
	if ( n < 1024 * 1024 ) return `${ Math.round( n / 1024 ) } KB`;
	return `${ ( n / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
}

export type FileKind = 'zip' | 'html' | 'other';

export function fileKind( name: string ): FileKind {
	const ext = name.toLowerCase().split( '.' ).pop() ?? '';
	if ( ext === 'zip' ) return 'zip';
	if ( ext === 'html' || ext === 'htm' ) return 'html';
	return 'other';
}

export function band( score: number ): 'high' | 'mid' | 'low' {
	return score >= 90 ? 'high' : score >= 70 ? 'mid' : 'low';
}

/** Localized date using the site locale (WordPress date format is PHP-style; Intl is the closest client-side match). */
export function localDate( iso: string | null, locale?: string ): string {
	if ( ! iso ) return '—';
	const d = new Date( iso );
	if ( Number.isNaN( d.getTime() ) ) return '—';
	return new Intl.DateTimeFormat( locale, { dateStyle: 'medium', timeStyle: 'short' } ).format( d );
}

/** Resolve the UI theme: explicit choice, or the OS preference for "system" (DESIGN.md §3.3). */
export function resolveTheme( choice: 'light' | 'dark' | 'system', prefersDark: boolean ): 'light' | 'dark' {
	return choice === 'system' ? ( prefersDark ? 'dark' : 'light' ) : choice;
}
