/** Preflight checklist (DESIGN.md §5.5). Icon + text: color is never the only signal. */
import { __ } from '@wordpress/i18n';
import type { PreflightCheck } from '../lib/api';
import { Icon, type IconName } from './Icon';
import { Button } from './ui';
import s from './convert.module.css';

const ICONS: Record< PreflightCheck[ 'status' ], IconName > = { success: 'check', warning: 'alert', blocking: 'x' };

export function PreflightList( { checks, onFix, fixing }: { checks: PreflightCheck[]; onFix: ( id: string ) => void; fixing: string | null } ) {
	const LABELS: Record< PreflightCheck[ 'status' ], string > = { success: __( 'OK', 'ai2kit' ), warning: __( 'Warning', 'ai2kit' ), blocking: __( 'Blocking', 'ai2kit' ) };
	return (
		<ul className={ s.checks }>
			{ checks.map( ( c ) => (
				<li key={ c.id } className={ `${ s.check } ${ s[ `check-${ c.status }` ] }` }>
					<span className={ s.checkIcon }>
						<Icon name={ ICONS[ c.status ] } size={ 14 } label={ LABELS[ c.status ] } />
					</span>
					<span className={ s.checkText }>
						<strong>{ c.title }</strong>
						<span>{ c.detail }</span>
					</span>
					{ c.fix && (
						<Button size="sm" variant="secondary" loading={ fixing === c.id } onClick={ () => onFix( c.id ) }>
							{ c.fix.label || __( 'Fix', 'ai2kit' ) }
						</Button>
					) }
				</li>
			) ) }
		</ul>
	);
}
