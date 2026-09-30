/** Section review row (DESIGN.md §5.7) — the core screen. */
import { useMemo } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { SectionReport } from '@ai2kit/engine';
import { Icon } from './Icon';
import { ScoreBadge, Segmented, Tooltip, UpsellChip, Badge } from './ui';
import { patternLabel, proHintText, sectionLabel, warningText, widgetSummary } from '../lib/engineText';
import s from './review.module.css';

export function SectionRow( {
	report,
	frozen,
	expanded,
	onToggle,
	onMode,
	onHover,
}: {
	report: SectionReport;
	frozen?: string;
	expanded: boolean;
	onToggle: () => void;
	onMode: ( m: 'native' | 'html' ) => void;
	onHover: ( id: string | null ) => void;
} ) {
	const { score } = report;
	const lowScore = score.score < 70;
	const breakdown = sprintf(
		/* translators: 1: structure %, 2: styles %, 3: fallback %. */
		__( 'Structure %1$d%% · Styles %2$d%% · HTML kept %3$d%%', 'ai2kit' ),
		Math.round( score.structure * 100 ),
		Math.round( score.styles * 100 ),
		Math.round( score.fallbackRatio * 100 )
	);
	const warnings = report.warnings.length;
	const detailsId = `a2k-sec-${ report.id }`;

	return (
		<li
			className={ `${ s.row } ${ expanded ? s.rowOpen : '' }` }
			onMouseEnter={ () => onHover( report.id ) }
			onMouseLeave={ () => onHover( null ) }
			onFocus={ () => onHover( report.id ) }
		>
			<div className={ s.rowMain }>
				<Thumb html={ frozen } label={ sectionLabel( report.label ) } />
				<div className={ s.rowBody }>
					<div className={ s.rowTop }>
						<button type="button" className={ s.rowTitle } onClick={ onToggle } aria-expanded={ expanded } aria-controls={ detailsId }>
							{ sectionLabel( report.label ) }
						</button>
						<Tooltip content={ breakdown }>
							<span tabIndex={ 0 }>
								<ScoreBadge score={ score.score } />
							</span>
						</Tooltip>
						{ report.patterns.filter( ( p ) => p !== 'repeat' ).map( ( p ) => (
							<Badge key={ p } tone="brand">
								{ patternLabel( p ) }
							</Badge>
						) ) }
					</div>
					<button type="button" className={ s.rowMeta } onClick={ onToggle } tabIndex={ -1 }>
						{ widgetSummary( report.widgets ) || __( 'Layout only', 'ai2kit' ) }
						{ warnings > 0 && (
							<span className={ s.warn }>
								{ ' · ' }
								{ sprintf(
									/* translators: %d: number of warnings. */
									_n( '%d warning', '%d warnings', warnings, 'ai2kit' ),
									warnings
								) }
								<Icon name={ expanded ? 'chevronDown' : 'chevronRight' } size={ 12 } />
							</span>
						) }
					</button>
				</div>
				<div className={ s.rowMode }>
					<Segmented
						size="sm"
						label={ sprintf(
							/* translators: %s: section name. */
							__( 'Output for %s', 'ai2kit' ),
							sectionLabel( report.label )
						) }
						value={ report.mode }
						onChange={ ( m ) => ( m === 'html' && ! frozen ? undefined : onMode( m ) ) }
						options={ [
							{ value: 'native', label: __( 'Native', 'ai2kit' ) },
							{ value: 'html', label: __( 'HTML', 'ai2kit' ) },
						] }
					/>
					{ lowScore && report.mode === 'html' && <span className={ s.modeNote }>{ __( 'Suggested: HTML', 'ai2kit' ) }</span> }
				</div>
			</div>
			<div id={ detailsId } className={ s.details } hidden={ ! expanded }>
				<div className={ s.detailsGrid }>
					<div>
						<h4>{ __( 'Detected widgets', 'ai2kit' ) }</h4>
						<ul className={ s.widgets }>
							{ Object.entries( report.widgets ).map( ( [ w, n ] ) => (
								<li key={ w }>
									<Badge tone="neutral">{ widgetSummary( { [ w ]: n } ) || `${ w } × ${ n }` }</Badge>
								</li>
							) ) }
						</ul>
					</div>
					<div>
						<h4>{ __( 'Warnings', 'ai2kit' ) }</h4>
						{ report.warnings.length ? (
							<ul className={ s.warnList }>
								{ report.warnings.map( ( w ) => (
									<li key={ w }>
										<Icon name="alert" size={ 14 } /> { warningText( w ) }
									</li>
								) ) }
							</ul>
						) : (
							<p className={ s.muted }>{ __( 'None — every block mapped to an Elementor widget.', 'ai2kit' ) }</p>
						) }
					</div>
				</div>
				{ report.proHints.length > 0 && (
					<div className={ s.hints }>
						{ report.proHints.map( ( h ) => (
							<UpsellChip key={ h } detail={ __( 'Ai2Kit Pro maps tabs, carousels and popups to native Elementor widgets. In Free they are kept as static, editable content.', 'ai2kit' ) }>
								{ proHintText( h ).replace( /^Pro:\s*/, '' ) }
							</UpsellChip>
						) ) }
					</div>
				) }
			</div>
		</li>
	);
}

/** Static thumbnail from the section's frozen HTML (no scripts: sandbox=""). */
function Thumb( { html, label }: { html?: string; label: string } ) {
	const doc = useMemo( () => ( html ? `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden;pointer-events:none}</style></head><body>${ html }</body></html>` : '' ), [ html ] );
	return (
		<div className={ s.thumb } aria-hidden="true">
			{ html ? <iframe srcDoc={ doc } sandbox="" loading="lazy" tabIndex={ -1 } title={ label } /> : <Icon name="layers" size={ 20 } /> }
		</div>
	);
}
