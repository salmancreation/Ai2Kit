/** History (DESIGN.md §6.3). */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { api, asApiError, type Job } from '../lib/api';
import { localDate } from '../lib/format';
import { PageTitle, Shell } from '../components/Shell';
import { Badge, Button, Card, EmptyState, ErrorNotice, Modal, ScoreBadge, Skeleton, useToast, type Tone } from '../components/ui';
import s from './screens.module.css';

const STATUS: Record< Job[ 'status' ], { tone: Tone; label: () => string } > = {
	imported: { tone: 'success', label: () => __( 'Imported', 'ai2kit' ) },
	undone: { tone: 'neutral', label: () => __( 'Undone', 'ai2kit' ) },
	failed: { tone: 'danger', label: () => __( 'Failed', 'ai2kit' ) },
	uploaded: { tone: 'info', label: () => __( 'Not imported', 'ai2kit' ) },
};

export function History() {
	const toast = useToast();
	const [ jobs, setJobs ] = useState< Job[] | null >( null );
	const [ error, setError ] = useState< string | null >( null );
	const [ report, setReport ] = useState< Job | null >( null );
	const [ undo, setUndo ] = useState< { job: Job; edited: boolean } | null >( null );
	const [ busy, setBusy ] = useState( false );
	const convertUrl = `${ window.ai2kitConfig.adminUrl }admin.php?page=ai2kit`;

	const load = (): void => {
		api.jobs()
			.then( setJobs )
			.catch( ( e ) => setError( asApiError( e ).message ) );
	};
	useEffect( load, [] );

	const askUndo = async ( job: Job ): Promise< void > => {
		const check = await api.undoCheck( job.uuid ).catch( () => ( { edited: false } ) );
		setUndo( { job, edited: check.edited } );
	};

	const doUndo = async (): Promise< void > => {
		if ( ! undo ) return;
		setBusy( true );
		try {
			await api.undo( undo.job.uuid );
			toast( 'success', __( 'Import undone.', 'ai2kit' ) );
			setUndo( null );
			load();
		} catch ( e ) {
			toast( 'danger', asApiError( e ).message );
		} finally {
			setBusy( false );
		}
	};

	return (
		<Shell>
			<PageTitle title={ __( 'History', 'ai2kit' ) } lead={ __( 'Every conversion on this site.', 'ai2kit' ) } />
			{ error && <ErrorNotice title={ __( 'We couldn\'t load your history.', 'ai2kit' ) } why={ error } next={ __( 'Reload the page to try again.', 'ai2kit' ) } /> }
			<Card className={ s.tableCard }>
				{ jobs === null && ! error && (
					<div className={ s.skeletons }>
						{ [ 0, 1, 2 ].map( ( i ) => (
							<Skeleton key={ i } height={ 40 } />
						) ) }
					</div>
				) }
				{ jobs && jobs.length === 0 && (
					<EmptyState
						icon="history"
						title={ __( 'No conversions yet', 'ai2kit' ) }
						text={ __( 'Converted pages and templates will appear here.', 'ai2kit' ) }
						action={
							<Button variant="primary" size="lg" href={ convertUrl }>
								{ __( 'Start converting', 'ai2kit' ) }
							</Button>
						}
					/>
				) }
				{ jobs && jobs.length > 0 && (
					<table className={ s.table }>
						<thead>
							<tr>
								<th scope="col">{ __( 'Date', 'ai2kit' ) }</th>
								<th scope="col">{ __( 'Source', 'ai2kit' ) }</th>
								<th scope="col">{ __( 'Pages', 'ai2kit' ) }</th>
								<th scope="col">{ __( 'Score', 'ai2kit' ) }</th>
								<th scope="col">{ __( 'Status', 'ai2kit' ) }</th>
								<th scope="col">
									<span className="a2k-sr-only">{ __( 'Actions', 'ai2kit' ) }</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{ jobs.map( ( j ) => (
								<tr key={ j.uuid }>
									<td>{ localDate( j.importedAt ?? j.createdAt ) }</td>
									<td>
										<strong>{ j.title }</strong>
										{ j.sourceType && <span className={ s.sub }>{ j.sourceType }</span> }
									</td>
									<td>
										{ j.result?.created.map( ( c ) => (
											<a key={ c.id } href={ c.editUrl } className={ s.pageLink }>
												{ c.title }
											</a>
										) ) ?? '—' }
									</td>
									<td>{ j.score !== null ? <ScoreBadge score={ j.score } /> : '—' }</td>
									<td>
										<Badge tone={ STATUS[ j.status ].tone }>{ STATUS[ j.status ].label() }</Badge>
									</td>
									<td className={ s.actions }>
										{ j.result && (
											<Button size="sm" variant="ghost" onClick={ () => setReport( j ) }>
												{ __( 'View report', 'ai2kit' ) }
											</Button>
										) }
										<Button size="sm" variant="ghost" href={ convertUrl }>
											{ __( 'Re-run', 'ai2kit' ) }
										</Button>
										{ j.status === 'imported' && (
											<Button size="sm" variant="ghost" onClick={ () => askUndo( j ) }>
												{ __( 'Undo', 'ai2kit' ) }
											</Button>
										) }
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				) }
			</Card>

			{ report?.result && (
				<Modal title={ report.title } onClose={ () => setReport( null ) }>
					<ul className={ s.report }>
						{ report.result.sections.map( ( sec, i ) => (
							<li key={ i }>
								<span>{ sec.label }</span>
								<Badge tone={ sec.mode === 'html' ? 'warning' : 'neutral' }>{ sec.mode === 'html' ? __( 'HTML', 'ai2kit' ) : __( 'Native', 'ai2kit' ) }</Badge>
								<ScoreBadge score={ sec.score } />
							</li>
						) ) }
					</ul>
					{ report.result.checks.map( ( c ) => (
						<p key={ c.text } className={ s.sub }>
							{ c.text }
						</p>
					) ) }
				</Modal>
			) }

			{ undo && (
				<Modal
					title={ __( 'Undo this import?', 'ai2kit' ) }
					onClose={ () => setUndo( null ) }
					footer={
						<>
							<Button variant="ghost" onClick={ () => setUndo( null ) }>
								{ __( 'Keep it', 'ai2kit' ) }
							</Button>
							<Button variant="danger" loading={ busy } onClick={ doUndo }>
								{ __( 'Undo import', 'ai2kit' ) }
							</Button>
						</>
					}
				>
					<p>{ __( 'The page moves to the trash, the images this import added are deleted, and your Global Colors & Fonts are restored.', 'ai2kit' ) }</p>
					{ undo.edited && <p className={ s.warn }>{ __( 'These pages have been edited since import.', 'ai2kit' ) }</p> }
				</Modal>
			) }
		</Shell>
	);
}
