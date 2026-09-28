/**
 * Convert wizard (DESIGN.md §6.1, §6.2):
 * Upload → Check → Convert (progress) → Review → Import → Done.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { detectSource, emit, type Analysis, type ConversionResult, type SourceInfo } from '@ai2kit/engine';
import { api, asApiError, type ApiError, type ImportResult, type Preflight, type UploadedJob } from '../lib/api';
import { CancelledError, runConversion, type StageId, type StageState } from '../lib/runner';
import { ActionBar, PageTitle, Shell } from '../components/Shell';
import { Stepper, type StepIndex } from '../components/Stepper';
import { DropZone } from '../components/DropZone';
import { SourceBadge } from '../components/SourceBadge';
import { PreflightList } from '../components/PreflightList';
import { ProgressPanel } from '../components/ProgressPanel';
import { SectionRow } from '../components/SectionRow';
import { ComparePanel } from '../components/ComparePanel';
import { TokenCard } from '../components/TokenCard';
import { ImportSummary } from '../components/ImportSummary';
import { Icon } from '../components/Icon';
import { Button, Card, Checkbox, ErrorNotice, Field, Modal, Segmented, Spinner, UpsellChip, inputClass, useToast } from '../components/ui';
import s from '../components/convert.module.css';
import r from '../components/review.module.css';

type Step = 'upload' | 'check' | 'convert' | 'review' | 'importing' | 'done';

const STEP_INDEX: Record< Step, StepIndex > = { upload: 0, check: 1, convert: 2, review: 2, importing: 3, done: 3 };
const STAGES: StageId[] = [ 'render', 'capture', 'sections', 'tokens', 'build' ];
const freshStages = (): StageState[] => STAGES.map( ( id ) => ( { id, status: 'pending' } ) );

type Conv = {
	analysis: Analysis;
	result: ConversionResult;
	frozen: Record< string, string >;
	modes: Record< string, 'native' | 'html' >;
};

export function Convert() {
	const cfg = window.ai2kitConfig;
	const toast = useToast();
	const [ step, setStep ] = useState< Step >( 'upload' );
	const [ welcome, setWelcome ] = useState( ! cfg.settings.welcomeDone );
	const [ diagnostics, setDiagnostics ] = useState( cfg.settings.diagnosticsOptIn );
	const [ preflight, setPreflight ] = useState< Preflight | null >( null );
	const [ fixing, setFixing ] = useState< string | null >( null );

	const [ file, setFile ] = useState< File | null >( null );
	const [ pasteOpen, setPasteOpen ] = useState( false );
	const [ pasted, setPasted ] = useState( '' );
	const [ uploading, setUploading ] = useState( false );
	const [ uploadError, setUploadError ] = useState< ApiError | null >( null );
	const [ job, setJob ] = useState< UploadedJob | null >( null );
	const [ source, setSource ] = useState< SourceInfo | null >( null );

	const [ output, setOutput ] = useState< 'page' | 'template' >( cfg.settings.output );
	const [ format, setFormat ] = useState< 'auto' | 'v3' | 'v4' >( cfg.settings.format );
	// PRD §8.3: Auto → v4 when the Atomic editor is on, else v3.
	const resolvedFormat: 'v3' | 'v4' = format === 'auto' ? ( cfg.elementor.atomic ? 'v4' : 'v3' ) : format === 'v4' && ! cfg.elementor.atomic ? 'v3' : format;
	const [ title, setTitle ] = useState( '' );

	const [ stages, setStages ] = useState< StageState[] >( freshStages );
	const [ log, setLog ] = useState< string[] >( [] );
	const [ runError, setRunError ] = useState< string | null >( null );
	const frameRef = useRef< HTMLIFrameElement >( null );
	const abortRef = useRef< AbortController | null >( null );

	const [ conv, setConv ] = useState< Conv | null >( null );
	const [ tab, setTab ] = useState< 'sections' | 'tokens' >( 'sections' );
	const [ expanded, setExpanded ] = useState< string | null >( null );
	const [ hovered, setHovered ] = useState< string | null >( null );
	const [ applyTokens, setApplyTokens ] = useState( true );
	const [ kitMode, setKitMode ] = useState< 'merge' | 'replace' >( cfg.settings.kitMode );

	const [ importError, setImportError ] = useState< ApiError | null >( null );
	const [ imported, setImported ] = useState< ImportResult | null >( null );
	const [ compareOpen, setCompareOpen ] = useState( false );
	const [ undoOpen, setUndoOpen ] = useState( false );
	const [ undoEdited, setUndoEdited ] = useState( false );
	const [ undoing, setUndoing ] = useState( false );

	/* Preflight runs quietly in the background (§6.1). */
	useEffect( () => {
		api.preflight().then( setPreflight ).catch( () => setPreflight( null ) );
	}, [] );

	const fix = async ( id: string ): Promise< void > => {
		setFixing( id );
		try {
			setPreflight( await api.fix( id ) );
			toast( 'success', __( 'Fixed.', 'ai2kit' ) );
		} catch ( e ) {
			toast( 'danger', asApiError( e ).message );
		} finally {
			setFixing( null );
		}
	};

	/* Upload → job + detection badge. */
	const upload = useCallback(
		async ( what: File | string ): Promise< void > => {
			setUploading( true );
			setUploadError( null );
			setJob( null );
			setSource( null );
			try {
				const j = typeof what === 'string' ? await api.uploadHtml( what ) : await api.uploadFile( what );
				setJob( j );
				setTitle( j.title );
				setSource( detectSource( { files: j.files, html: j.entryHtml } ) );
			} catch ( e ) {
				setUploadError( asApiError( e ) );
			} finally {
				setUploading( false );
			}
		},
		[]
	);

	const onFile = ( f: File | null ): void => {
		setFile( f );
		if ( f ) upload( f );
		else {
			if ( job ) api.discard( job.uuid ).catch( () => undefined );
			setJob( null );
			setSource( null );
			setUploadError( null );
		}
	};

	/* Conversion run: starts once the progress panel's iframe is mounted. */
	const startRun = useCallback( async () => {
		if ( ! job?.entryUrl || ! frameRef.current ) return;
		const controller = new AbortController();
		abortRef.current = controller;
		setStages( freshStages() );
		setLog( [] );
		setRunError( null );
		const started: Partial< Record< StageId, number > > = {};
		try {
			const out = await runConversion( frameRef.current, job.entryUrl, job.uuid, {
				signal: controller.signal,
				format: resolvedFormat,
				onLog: ( line ) => setLog( ( l ) => [ ...l, `[${ new Date().toLocaleTimeString() }] ${ line }` ] ),
				onStage: ( id, status, detail ) => {
					if ( status === 'active' && ! started[ id ] ) started[ id ] = performance.now();
					setStages( ( list ) =>
						list.map( ( st ) =>
							st.id === id ? { ...st, status, detail, ms: status === 'done' ? performance.now() - ( started[ id ] ?? performance.now() ) : st.ms } : st
						)
					);
				},
			} );
			setConv( out );
			setStep( 'review' );
		} catch ( e ) {
			if ( e instanceof CancelledError ) return;
			setStages( ( list ) => list.map( ( st ) => ( st.status === 'active' ? { ...st, status: 'error' } : st ) ) );
			setRunError( e instanceof Error ? e.message : String( e ) );
		}
	}, [ job, resolvedFormat ] );

	useEffect( () => {
		if ( step === 'convert' ) startRun();
	}, [ step, startRun ] );

	const cancelRun = (): void => {
		abortRef.current?.abort();
		setStep( 'check' );
	};

	/* Review: optimistic re-emit on every toggle / rename. */
	const reemit = ( analysis: Analysis, modes: Record< string, 'native' | 'html' >, frozen: Record< string, string > ): ConversionResult => emit( analysis, { frozen, modes, title, format: resolvedFormat } );

	const setMode = ( id: string, m: 'native' | 'html' ): void => {
		if ( ! conv ) return;
		const modes = { ...conv.modes, [ id ]: m };
		setConv( { ...conv, modes, result: reemit( conv.analysis, modes, conv.frozen ) } );
	};

	const rename = ( kind: 'colors' | 'fonts', id: string, name: string ): void => {
		if ( ! conv ) return;
		const tokens = {
			...conv.analysis.tokens,
			colors: kind === 'colors' ? conv.analysis.tokens.colors.map( ( c ) => ( c.id === id ? { ...c, title: name } : c ) ) : conv.analysis.tokens.colors,
			fonts: kind === 'fonts' ? conv.analysis.tokens.fonts.map( ( f ) => ( f.id === id ? { ...f, title: name } : f ) ) : conv.analysis.tokens.fonts,
		};
		const analysis = { ...conv.analysis, tokens };
		setConv( { ...conv, analysis, result: reemit( analysis, conv.modes, conv.frozen ) } );
	};

	const doImport = async (): Promise< void > => {
		if ( ! conv || ! job ) return;
		setStep( 'importing' );
		setImportError( null );
		const result = reemit( conv.analysis, conv.modes, conv.frozen );
		try {
			const res = await api.importJob( job.uuid, {
				document: { ...result.document, title },
				tokens: result.tokens,
				applyTokens,
				output,
				kitMode,
				title,
				score: result.overall,
				sourceType: source?.type ?? '',
				keepForCompare: true,
				format: resolvedFormat,
				report: result.sections.map( ( x ) => ( { label: x.label, mode: x.mode, score: x.score.score } ) ),
			} );
			setImported( res );
			setStep( 'done' );
		} catch ( e ) {
			setImportError( asApiError( e ) );
			setStep( 'review' );
		}
	};

	const reset = (): void => {
		if ( job ) api.discard( job.uuid ).catch( () => undefined );
		setStep( 'upload' );
		setFile( null );
		setJob( null );
		setSource( null );
		setConv( null );
		setImported( null );
		setPasted( '' );
		setCompareOpen( false );
		setTab( 'sections' );
	};

	const openUndo = async (): Promise< void > => {
		if ( ! job ) return;
		try {
			setUndoEdited( ( await api.undoCheck( job.uuid ) ).edited );
		} catch {
			setUndoEdited( false );
		}
		setUndoOpen( true );
	};

	const doUndo = async (): Promise< void > => {
		if ( ! job ) return;
		setUndoing( true );
		try {
			const res = await api.undo( job.uuid );
			toast(
				'success',
				sprintf(
					/* translators: %d: number of pages moved to trash. */
					_n( 'Undone — %d page moved to trash.', 'Undone — %d pages moved to trash.', res.trashed, 'ai2kit' ),
					res.trashed
				)
			);
			setUndoOpen( false );
			reset();
		} catch ( e ) {
			toast( 'danger', asApiError( e ).message );
		} finally {
			setUndoing( false );
		}
	};

	const blocking = preflight?.checks.filter( ( c ) => c.status === 'blocking' ) ?? [];
	const isSourceZip = source?.type === 'source-zip';
	const highlight = useMemo( () => conv?.result.sections.find( ( x ) => x.id === hovered )?.rect ?? null, [ conv, hovered ] );

	/* ------------------------------------------------------------ */

	const body = ( (): JSX.Element => {
		if ( step === 'upload' ) {
			return (
				<>
					<PageTitle title={ __( 'Convert', 'ai2kit' ) } lead={ __( 'Turn an AI-built site into an editable Elementor page.', 'ai2kit' ) } />
					{ welcome && (
						<Card className={ s.welcome }>
							<h2 className={ s.cardTitle }>{ __( 'Convert AI-built sites into editable Elementor pages.', 'ai2kit' ) }</h2>
							<ul className={ s.bullets }>
								<li>
									<Icon name="shield" /> { __( 'Local & private — your code never leaves this site', 'ai2kit' ) }
								</li>
								<li>
									<Icon name="layers" /> { __( 'Native widgets, global colors and fonts', 'ai2kit' ) }
								</li>
								<li>
									<Icon name="check" /> { __( 'Works on Elementor Free', 'ai2kit' ) }
								</li>
							</ul>
							<Checkbox checked={ diagnostics } onChange={ setDiagnostics } label={ __( 'Share anonymous diagnostics to help improve conversions', 'ai2kit' ) } help={ __( 'Optional. Off unless you tick it.', 'ai2kit' ) } />
							<Button
								variant="primary"
								iconAfter="arrowRight"
								onClick={ () => {
									setWelcome( false );
									api.saveSettings( { welcomeDone: true, diagnosticsOptIn: diagnostics } ).catch( () => undefined );
								} }
							>
								{ __( 'Start converting', 'ai2kit' ) }
							</Button>
						</Card>
					) }
					{ preflight && preflight.ready && <p className={ s.ready }>{ __( 'Your site is ready ✓', 'ai2kit' ) }</p> }
					{ preflight && ! preflight.ready && (
						<Card className={ s.mb }>
							<h2 className={ s.cardTitle }>{ __( 'Before you start', 'ai2kit' ) }</h2>
							<PreflightList checks={ preflight.checks.filter( ( c ) => c.status !== 'success' ) } onFix={ fix } fixing={ fixing } />
						</Card>
					) }
					<DropZone file={ file } onFile={ onFile } onPaste={ () => setPasteOpen( true ) } />
					<div className={ s.uploadStatus } aria-live="polite">
						{ uploading && (
							<span className={ s.detecting }>
								<Spinner /> { __( 'Uploading and checking your files…', 'ai2kit' ) }
							</span>
						) }
						{ source && ! uploading && <SourceBadge source={ source } /> }
						{ job && ! uploading && job.fileCount > 1 && (
							<span className={ s.muted }>
								{ sprintf(
									/* translators: %d: number of files. */
									_n( '%d file', '%d files', job.fileCount, 'ai2kit' ),
									job.fileCount
								) }
							</span>
						) }
					</div>
					{ uploadError && <ErrorNotice title={ uploadError.message } next={ uploadError.data?.hint } details={ JSON.stringify( uploadError ) } /> }
					{ isSourceZip && (
						<ErrorNotice
							title={ __( 'This ZIP is the project source, not the built site.', 'ai2kit' ) }
							why={ __( 'Ai2Kit converts the built output that a browser can render.', 'ai2kit' ) }
							next={ __( 'Run "npm run build -- --base=./" and upload the dist folder as a ZIP.', 'ai2kit' ) }
						/>
					) }
				</>
			);
		}

		if ( step === 'check' && job ) {
			return (
				<>
					<PageTitle title={ __( 'Check', 'ai2kit' ) } lead={ job.title } aside={ source && <SourceBadge source={ source } /> } />
					<div className={ s.checkGrid }>
						<Card>
							<h2 className={ s.cardTitle }>{ __( 'Output', 'ai2kit' ) }</h2>
							<div className={ s.stack }>
								<Segmented
									label={ __( 'Create', 'ai2kit' ) }
									value={ output }
									onChange={ setOutput }
									options={ [
										{ value: 'page', label: __( 'New page', 'ai2kit' ) },
										{ value: 'template', label: __( 'Template', 'ai2kit' ) },
									] }
								/>
								<Field label={ __( 'Title', 'ai2kit' ) }>{ ( id ) => <input id={ id } className={ inputClass } value={ title } onChange={ ( e ) => setTitle( e.target.value ) } /> }</Field>
								<Field
									label={ __( 'Elementor format', 'ai2kit' ) }
									help={
										resolvedFormat === 'v4'
											? __( 'Atomic elements (v4) with classes and responsive styles. Widgets without an atomic version stay classic.', 'ai2kit' )
											: __( 'Containers and classic widgets (v3). They also work alongside the Atomic editor.', 'ai2kit' )
									}
								>
									{ ( id ) => (
										<select id={ id } className={ inputClass } value={ format } onChange={ ( e ) => setFormat( e.target.value as 'auto' | 'v3' | 'v4' ) }>
											<option value="auto">
												{ cfg.elementor.atomic ? __( 'Auto (v4)', 'ai2kit' ) : __( 'Auto (v3)', 'ai2kit' ) }
											</option>
											<option value="v4" disabled={ ! cfg.elementor.atomic }>
												{ __( 'Atomic elements (v4)', 'ai2kit' ) }
											</option>
											<option value="v3">{ __( 'Classic widgets (v3)', 'ai2kit' ) }</option>
										</select>
									) }
								</Field>
								<div className={ s.routeRow }>
									<span>
										<strong>{ __( 'Pages', 'ai2kit' ) }</strong>
										<span className={ s.muted }>{ __( 'The page at "/" is converted.', 'ai2kit' ) }</span>
									</span>
									<UpsellChip detail={ __( 'Ai2Kit Pro discovers every route of your site and converts them in one job, with header, footer and menus.', 'ai2kit' ) }>
										{ __( 'Convert all routes', 'ai2kit' ) }
									</UpsellChip>
								</div>
							</div>
						</Card>
						<Card>
							<h2 className={ s.cardTitle }>{ __( 'Checks', 'ai2kit' ) }</h2>
							{ preflight ? <PreflightList checks={ preflight.checks } onFix={ fix } fixing={ fixing } /> : <Spinner label={ __( 'Checking…', 'ai2kit' ) } /> }
							{ job.rewrite.fixed > 0 && (
								<p className={ s.note }>
									<Icon name="check" size={ 14 } />
									{ sprintf(
										/* translators: %d: number of asset paths. */
										_n( 'We fixed %d absolute asset path automatically.', 'We fixed %d absolute asset paths automatically.', job.rewrite.fixed, 'ai2kit' ),
										job.rewrite.fixed
									) }
								</p>
							) }
							{ job.rewrite.missing.length > 0 && (
								<ErrorNotice
									title={ sprintf(
										/* translators: %d: number of files. */
										_n( '%d referenced file couldn\'t be found.', '%d referenced files couldn\'t be found.', job.rewrite.missing.length, 'ai2kit' ),
										job.rewrite.missing.length
									) }
									why={ job.rewrite.missing.slice( 0, 5 ).join( ', ' ) }
									next={ __( 'Tip: build with "npm run build -- --base=./" and include the whole dist folder.', 'ai2kit' ) }
								/>
							) }
							{ job.skipped.length > 0 && (
								<p className={ s.note }>
									<Icon name="shield" size={ 14 } />
									{ sprintf(
										/* translators: %d: number of files. */
										_n( '%d server-side file was left out for safety.', '%d server-side files were left out for safety.', job.skipped.length, 'ai2kit' ),
										job.skipped.length
									) }
								</p>
							) }
						</Card>
					</div>
				</>
			);
		}

		if ( step === 'convert' ) {
			return (
				<>
					<PageTitle title={ __( 'Converting', 'ai2kit' ) } lead={ __( 'This runs in your browser. Nothing is uploaded anywhere else.', 'ai2kit' ) } />
					{ runError && (
						<div className={ s.mb }>
							<ErrorNotice title={ __( 'The conversion stopped.', 'ai2kit' ) } why={ runError } next={ __( 'Check the technical log, then try again. React builds must be the built dist folder.', 'ai2kit' ) } details={ log.join( '\n' ) } />
						</div>
					) }
					<ProgressPanel stages={ stages } log={ log } frameRef={ frameRef } onCancel={ cancelRun } />
				</>
			);
		}

		if ( ( step === 'review' || step === 'importing' ) && conv && job ) {
			const res = conv.result;
			return (
				<>
					<PageTitle
						title={ __( 'Review', 'ai2kit' ) }
						lead={ sprintf(
							/* translators: 1: number of sections, 2: overall score. */
							__( '%1$d sections · %2$d%% overall match', 'ai2kit' ),
							res.sections.length,
							res.overall
						) }
						aside={
							<Segmented
								label={ __( 'Review view', 'ai2kit' ) }
								value={ tab }
								onChange={ setTab }
								options={ [
									{ value: 'sections', label: __( 'Sections', 'ai2kit' ) },
									{ value: 'tokens', label: __( 'Tokens', 'ai2kit' ) },
								] }
							/>
						}
					/>
					{ importError && (
						<div className={ s.mb }>
							<ErrorNotice title={ importError.message } next={ importError.data?.hint } details={ JSON.stringify( importError ) } />
						</div>
					) }
					{ tab === 'sections' ? (
						<div className={ r.reviewGrid }>
							<ul className={ r.rows } aria-label={ __( 'Sections', 'ai2kit' ) }>
								{ res.sections.map( ( sec ) => {
									const key = conv.analysis.sections.find( ( x ) => x.id === sec.id )?.key;
									return (
										<SectionRow
											key={ sec.id }
											report={ sec }
											frozen={ key ? conv.frozen[ key ] : undefined }
											expanded={ expanded === sec.id }
											onToggle={ () => setExpanded( expanded === sec.id ? null : sec.id ) }
											onMode={ ( m ) => setMode( sec.id, m ) }
											onHover={ setHovered }
										/>
									);
								} ) }
							</ul>
							<div className={ r.compareCol }>
								<ComparePanel source={ job.entryUrl ?? '' } score={ res.overall } highlight={ highlight } />
							</div>
						</div>
					) : (
						<TokenCard tokens={ conv.analysis.tokens } onRename={ rename } apply={ applyTokens } onApply={ setApplyTokens } kitMode={ kitMode } onKitMode={ setKitMode } />
					) }
				</>
			);
		}

		if ( step === 'done' && imported ) {
			return (
				<ImportSummary
					result={ imported }
					canCompare={ !! job?.entryUrl }
					onCompare={ () => setCompareOpen( ( v ) => ! v ) }
					onAnother={ reset }
					onUndo={ openUndo }
				/>
			);
		}
		return <Spinner label={ __( 'Loading…', 'ai2kit' ) } />;
	} )();

	const actions = ( (): JSX.Element | null => {
		switch ( step ) {
			case 'upload':
				return (
					<ActionBar
						end={
							<Button variant="primary" iconAfter="arrowRight" disabled={ ! job || uploading || isSourceZip } onClick={ () => setStep( 'check' ) }>
								{ __( 'Continue', 'ai2kit' ) }
							</Button>
						}
					/>
				);
			case 'check':
				return (
					<ActionBar
						start={
							<Button variant="ghost" icon="arrowLeft" onClick={ () => setStep( 'upload' ) }>
								{ __( 'Back', 'ai2kit' ) }
							</Button>
						}
						status={ blocking.length ? __( 'Fix the blocking checks to continue.', 'ai2kit' ) : undefined }
						end={
							<Button variant="primary" iconAfter="arrowRight" disabled={ blocking.length > 0 || ! preflight } onClick={ () => setStep( 'convert' ) }>
								{ __( 'Start conversion', 'ai2kit' ) }
							</Button>
						}
					/>
				);
			case 'convert':
				return runError ? (
					<ActionBar
						start={
							<Button variant="ghost" icon="arrowLeft" onClick={ cancelRun }>
								{ __( 'Back', 'ai2kit' ) }
							</Button>
						}
						end={
							<Button variant="primary" icon="refresh" onClick={ startRun }>
								{ __( 'Try again', 'ai2kit' ) }
							</Button>
						}
					/>
				) : null;
			case 'review':
			case 'importing':
				return (
					<ActionBar
						start={
							<Button variant="ghost" icon="arrowLeft" disabled={ step === 'importing' } onClick={ () => setStep( 'check' ) }>
								{ __( 'Back', 'ai2kit' ) }
							</Button>
						}
						status={
							conv
								? sprintf(
										/* translators: 1: native sections, 2: HTML sections. */
										__( '%1$d native · %2$d kept as HTML', 'ai2kit' ),
										conv.result.sections.filter( ( x ) => x.mode === 'native' ).length,
										conv.result.sections.filter( ( x ) => x.mode === 'html' ).length
								  )
								: undefined
						}
						end={
							<Button variant="primary" icon="upload" loading={ step === 'importing' } onClick={ doImport }>
								{ __( 'Import to WordPress', 'ai2kit' ) }
							</Button>
						}
					/>
				);
			default:
				return null;
		}
	} )();

	return (
		<Shell center={ <Stepper current={ STEP_INDEX[ step ] } complete={ step === 'done' } /> }>
			<div key={ step } className={ s.stepEnter }>
				{ body }
			</div>
			{ step === 'done' && compareOpen && job?.entryUrl && imported?.created[ 0 ] && (
				<Card className={ s.mt }>
					<ComparePanel source={ job.entryUrl } converted={ `${ imported.created[ 0 ].viewUrl }${ imported.created[ 0 ].viewUrl.includes( '?' ) ? '&' : '?' }ai2kit_compare=1` } height={ 620 } />
				</Card>
			) }
			{ actions }
			{ pasteOpen && (
				<Modal
					title={ __( 'Paste HTML', 'ai2kit' ) }
					onClose={ () => setPasteOpen( false ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setPasteOpen( false ) }>
								{ __( 'Cancel', 'ai2kit' ) }
							</Button>
							<Button
								variant="primary"
								disabled={ ! pasted.trim() }
								onClick={ () => {
									setPasteOpen( false );
									setFile( new File( [ pasted ], 'pasted.html', { type: 'text/html' } ) );
									upload( pasted );
								} }
							>
								{ __( 'Use this HTML', 'ai2kit' ) }
							</Button>
						</>
					}
				>
					<Field label={ __( 'HTML', 'ai2kit' ) } help={ __( 'A full page from Claude, ChatGPT or Gemini Canvas works best.', 'ai2kit' ) }>
						{ ( id ) => <textarea id={ id } className={ inputClass } value={ pasted } onChange={ ( e ) => setPasted( e.target.value ) } placeholder="<!doctype html>…" /> }
					</Field>
				</Modal>
			) }
			{ undoOpen && (
				<Modal
					title={ __( 'Undo this import?', 'ai2kit' ) }
					onClose={ () => setUndoOpen( false ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setUndoOpen( false ) }>
								{ __( 'Keep it', 'ai2kit' ) }
							</Button>
							<Button variant="danger" loading={ undoing } onClick={ doUndo }>
								{ __( 'Undo import', 'ai2kit' ) }
							</Button>
						</>
					}
				>
					<p>{ __( 'The page moves to the trash, the images this import added are deleted, and your Global Colors & Fonts are restored.', 'ai2kit' ) }</p>
					{ undoEdited && (
						<p className={ s.warnText }>
							<Icon name="alert" size={ 14 } /> { __( 'These pages have been edited since import.', 'ai2kit' ) }
						</p>
					) }
				</Modal>
			) }
		</Shell>
	);
}
