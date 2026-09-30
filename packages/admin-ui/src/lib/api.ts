/** REST client for ai2kit/v1. WordPress wires apiFetch's root URL and nonce. */
import apiFetch from '@wordpress/api-fetch';
import type { ElementorDocument, SectionReport, TokenTable } from '@ai2kit/engine';

export type ApiError = { code: string; message: string; data?: { status?: number; hint?: string } };

export type Job = {
	uuid: string;
	status: 'uploaded' | 'imported' | 'undone' | 'failed';
	title: string;
	sourceType: string;
	score: number | null;
	entryUrl: string | null;
	createdAt: string;
	importedAt: string | null;
	result: ImportResult | null;
	canRerun: boolean;
};

export type UploadedJob = Job & {
	files: string[];
	fileCount: number;
	entryHtml: string;
	skipped: string[];
	rewrite: { fixed: number; missing: string[] };
	hasScripts: boolean;
};

export type CheckStatus = 'success' | 'warning' | 'blocking';
export type PreflightCheck = { id: string; status: CheckStatus; title: string; detail: string; fix?: { label: string } };
export type Preflight = { ready: boolean; checks: PreflightCheck[] };

export type CreatedItem = { id: number; type: 'page' | 'template'; title: string; editUrl: string; viewUrl: string };
export type ImportResult = {
	created: CreatedItem[];
	media: { created: number[]; reused: number; failed: string[] };
	kit: { colors: number; fonts: number; mode: 'merge' | 'replace' };
	checks: Array< { type: string; text: string } >;
	sections: Array< { label: string; score: number; mode: 'native' | 'html' } >;
};

export type ImportPayload = {
	document: ElementorDocument;
	tokens: TokenTable;
	applyTokens: boolean;
	output: 'page' | 'template';
	kitMode: 'merge' | 'replace';
	title: string;
	score: number;
	sourceType: string;
	keepForCompare?: boolean;
	format: 'v3' | 'v4';
	report: Array< Pick< SectionReport, 'label' | 'mode' > & { score: number } >;
};

const NS = '/ai2kit/v1';

export const api = {
	uploadFile( file: File ): Promise< UploadedJob > {
		const body = new FormData();
		body.append( 'file', file );
		return apiFetch( { path: `${ NS }/jobs`, method: 'POST', body } );
	},
	uploadHtml( html: string ): Promise< UploadedJob > {
		return apiFetch( { path: `${ NS }/jobs`, method: 'POST', data: { html } } );
	},
	jobs(): Promise< Job[] > {
		return apiFetch( { path: `${ NS }/jobs` } );
	},
	job( uuid: string ): Promise< Job > {
		return apiFetch( { path: `${ NS }/jobs/${ uuid }` } );
	},
	/** An uploaded job, ready to convert (opened by link, e.g. one an agent created). */
	uploadedJob( uuid: string ): Promise< UploadedJob > {
		return apiFetch( { path: `${ NS }/jobs/${ uuid }?upload=1` } );
	},
	discard( uuid: string ): Promise< { deleted: boolean } > {
		return apiFetch( { path: `${ NS }/jobs/${ uuid }`, method: 'DELETE' } );
	},
	importJob( uuid: string, payload: ImportPayload ): Promise< ImportResult > {
		return apiFetch( { path: `${ NS }/jobs/${ uuid }/import`, method: 'POST', data: payload } );
	},
	undoCheck( uuid: string ): Promise< { edited: boolean; items: Array< { id: number; title: string; exists: boolean; edited: boolean } > } > {
		return apiFetch( { path: `${ NS }/jobs/${ uuid }/undo` } );
	},
	undo( uuid: string ): Promise< { trashed: number; mediaDeleted: number; kitRestored: boolean } > {
		return apiFetch( { path: `${ NS }/jobs/${ uuid }/undo`, method: 'POST' } );
	},
	preflight(): Promise< Preflight > {
		return apiFetch( { path: `${ NS }/preflight` } );
	},
	fix( check: string ): Promise< Preflight > {
		return apiFetch( { path: `${ NS }/preflight`, method: 'POST', data: { check } } );
	},
	saveSettings( patch: Partial< Ai2kitSettings > ): Promise< Ai2kitSettings > {
		return apiFetch( { path: `${ NS }/settings`, method: 'POST', data: patch } );
	},
};

export function asApiError( e: unknown ): ApiError {
	if ( e && typeof e === 'object' && 'message' in e ) return e as ApiError;
	return { code: 'unknown', message: String( e ) };
}
