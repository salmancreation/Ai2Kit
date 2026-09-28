/** Wizard stepper (DESIGN.md §5.2): Upload → Check → Review → Import. */
import { __ } from '@wordpress/i18n';
import { Icon } from './Icon';
import s from './Stepper.module.css';

export type StepIndex = 0 | 1 | 2 | 3;

export function Stepper( { current, complete = false }: { current: StepIndex; complete?: boolean } ) {
	const steps = [ __( 'Upload', 'ai2kit' ), __( 'Check', 'ai2kit' ), __( 'Review', 'ai2kit' ), __( 'Import', 'ai2kit' ) ];
	return (
		<ol className={ s.stepper } aria-label={ __( 'Conversion steps', 'ai2kit' ) }>
			{ steps.map( ( label, i ) => {
				const done = i < current || ( complete && i === current );
				const isCurrent = i === current && ! complete;
				return (
					<li key={ label } className={ `${ s.step } ${ done ? s.done : '' } ${ isCurrent ? s.current : '' }` } aria-current={ isCurrent ? 'step' : undefined }>
						{ i > 0 && <span className={ s.connector } aria-hidden="true"><span className={ s.fill } /></span> }
						<span className={ s.dot } aria-hidden="true">
							{ done ? <Icon name="check" size={ 14 } /> : i + 1 }
						</span>
						<span className={ s.label }>{ label }</span>
					</li>
				);
			} ) }
		</ol>
	);
}
