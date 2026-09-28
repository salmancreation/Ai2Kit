/** Conversion progress (DESIGN.md §5.6): stages, durations, determinate bar, live preview, log. */
import { useState, type RefObject } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { StageId, StageState } from '../lib/runner';
import { Icon } from './Icon';
import { Button, Card, CodeBlock, Spinner } from './ui';
import s from './convert.module.css';

export function stageLabel( id: StageId, detail?: string ): string {
	switch ( id ) {
		case 'render':
			return __( 'Rendering', 'ai2kit' );
		case 'capture':
			return detail === 'tablet' ? __( 'Capturing tablet', 'ai2kit' ) : detail === 'mobile' ? __( 'Capturing mobile', 'ai2kit' ) : __( 'Capturing desktop / tablet / mobile', 'ai2kit' );
		case 'sections':
			return __( 'Detecting sections', 'ai2kit' );
		case 'tokens':
			return __( 'Extracting design tokens', 'ai2kit' );
		case 'build':
			return __( 'Building Elementor layout', 'ai2kit' );
	}
}

const WEIGHTS: Record< StageId, number > = { render: 35, capture: 35, sections: 10, tokens: 5, build: 15 };

export function progressPct( stages: StageState[] ): number {
	let pct = 0;
	for ( const st of stages ) {
		if ( st.status === 'done' ) pct += WEIGHTS[ st.id ];
		if ( st.status === 'active' ) pct += WEIGHTS[ st.id ] * 0.4;
	}
	return Math.min( 100, Math.round( pct ) );
}

export function ProgressPanel( { stages, log, frameRef, onCancel }: { stages: StageState[]; log: string[]; frameRef: RefObject< HTMLIFrameElement >; onCancel: () => void } ) {
	const [ showLog, setShowLog ] = useState( false );
	const pct = progressPct( stages );
	const active = stages.find( ( x ) => x.status === 'active' );
	return (
		<div className={ s.progressGrid }>
			<Card>
				<div className={ s.progressHead }>
					<h2 className={ s.cardTitle }>{ __( 'Converting your site', 'ai2kit' ) }</h2>
					<span className={ s.pct }>{ pct }%</span>
				</div>
				<div className={ s.bar } role="progressbar" aria-valuemin={ 0 } aria-valuemax={ 100 } aria-valuenow={ pct } aria-label={ __( 'Conversion progress', 'ai2kit' ) }>
					<span className={ s.barFill } style={ { transform: `scaleX(${ pct / 100 })` } } />
				</div>
				<p className="a2k-sr-only" aria-live="polite">
					{ active ? stageLabel( active.id, active.detail ) : '' }
				</p>
				<ol className={ s.stages }>
					{ stages.map( ( st ) => (
						<li key={ st.id } className={ `${ s.stage } ${ s[ `stage-${ st.status }` ] }` }>
							<span className={ s.stageIcon }>
								{ st.status === 'done' && <Icon name="check" size={ 14 } label={ __( 'Done', 'ai2kit' ) } /> }
								{ st.status === 'active' && <Spinner /> }
								{ st.status === 'error' && <Icon name="x" size={ 14 } label={ __( 'Failed', 'ai2kit' ) } /> }
							</span>
							<span className={ s.stageLabel }>{ stageLabel( st.id, st.status === 'active' ? st.detail : undefined ) }</span>
							{ st.ms !== undefined && <span className={ s.stageMs }>{ ( st.ms / 1000 ).toFixed( 1 ) } s</span> }
							{ st.status === 'active' && <span className={ s.shimmer } aria-hidden="true" /> }
						</li>
					) ) }
				</ol>
				<div className={ s.progressFoot }>
					<Button variant="link" size="sm" icon={ showLog ? 'chevronDown' : 'chevronRight' } onClick={ () => setShowLog( ! showLog ) } aria-expanded={ showLog }>
						{ __( 'Show technical log', 'ai2kit' ) }
					</Button>
					<Button variant="secondary" size="sm" onClick={ onCancel }>
						{ __( 'Cancel', 'ai2kit' ) }
					</Button>
				</div>
				{ showLog && <CodeBlock text={ log.join( '\n' ) || '…' } /> }
			</Card>
			<Card className={ s.livePreview }>
				<h3 className={ s.cardSub }>{ __( 'Live capture', 'ai2kit' ) }</h3>
				{ /* The capture runs in this iframe; it is never moved in the DOM (that would reload it). */ }
				<div className={ s.liveFrame }>
					<iframe ref={ frameRef } className={ s.liveIframe } title={ __( 'Source site preview', 'ai2kit' ) } />
				</div>
			</Card>
		</div>
	);
}
