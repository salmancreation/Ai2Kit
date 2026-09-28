/** Source detection badge with evidence popover (DESIGN.md §5.4). */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { SourceInfo } from '@ai2kit/engine';
import { Icon } from './Icon';
import s from './convert.module.css';

const AI_SOURCES = new Set( [ 'lovable', 'bolt', 'next-export', 'vite-spa', 'ai-html' ] );

export function SourceBadge( { source }: { source: SourceInfo } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef< HTMLSpanElement >( null );
	useEffect( () => {
		if ( ! open ) return;
		const close = ( e: MouseEvent ): void => {
			if ( ! ref.current?.contains( e.target as Node ) ) setOpen( false );
		};
		document.addEventListener( 'mousedown', close );
		return () => document.removeEventListener( 'mousedown', close );
	}, [ open ] );
	return (
		<span className={ s.sourceWrap } ref={ ref }>
			<button type="button" className={ `${ s.source } ${ AI_SOURCES.has( source.type ) ? s.sourceAi : '' }` } aria-expanded={ open } onClick={ () => setOpen( ! open ) }>
				<Icon name="sparkle" size={ 14 } />
				{ `${ source.label } · ${ Math.round( source.confidence * 100 ) }%` }
			</button>
			{ open && (
				<span className={ s.evidence } role="dialog" aria-label={ __( 'Why we think so', 'ai2kit' ) }>
					<strong>{ __( 'Why we think so', 'ai2kit' ) }</strong>
					<ul>
						{ source.evidence.map( ( e ) => (
							<li key={ e }>{ e }</li>
						) ) }
					</ul>
				</span>
			) }
		</span>
	);
}
