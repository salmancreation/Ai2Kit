/**
 * Compare panel (DESIGN.md §5.8): side-by-side, swipe slider, overlay
 * (difference), breakpoint switcher, overall score ring. With only a source
 * URL it shows the source with section highlighting (review step).
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { Rect } from '@ai2kit/engine';
import { ScoreRing, Segmented } from './ui';
import s from './review.module.css';

type Bp = 'desktop' | 'tablet' | 'mobile';
type Mode = 'side' | 'swipe' | 'overlay';
const WIDTHS: Record< Bp, number > = { desktop: 1440, tablet: 1024, mobile: 390 };

export function ComparePanel( { source, converted, score, highlight, height = 560 }: { source: string; converted?: string; score?: number; highlight?: Rect | null; height?: number } ) {
	const [ bp, setBp ] = useState< Bp >( 'desktop' );
	const [ mode, setMode ] = useState< Mode >( converted ? 'swipe' : 'side' );
	const [ split, setSplit ] = useState( 50 );
	const [ width, setWidth ] = useState( 600 );
	const box = useRef< HTMLDivElement >( null );
	const left = useRef< HTMLIFrameElement >( null );
	const right = useRef< HTMLIFrameElement >( null );

	useEffect( () => {
		if ( ! box.current ) return;
		const ro = new ResizeObserver( ( [ e ] ) => setWidth( e!.contentRect.width ) );
		ro.observe( box.current );
		return () => ro.disconnect();
	}, [] );

	const pane = converted && mode === 'side' ? ( width - 12 ) / 2 : width;
	const vw = WIDTHS[ bp ];
	const scale = Math.min( 1, pane / vw );

	// Keep both frames scrolled together.
	const sync = useCallback( () => {
		const a = left.current?.contentWindow;
		const b = right.current?.contentWindow;
		if ( ! a || ! b ) return;
		let lock = false;
		const link = ( from: Window, to: Window ) => () => {
			if ( lock ) return;
			lock = true;
			to.scrollTo( 0, from.scrollY );
			requestAnimationFrame( () => ( lock = false ) );
		};
		try {
			a.addEventListener( 'scroll', link( a, b ) );
			b.addEventListener( 'scroll', link( b, a ) );
		} catch {
			/* cross-origin: no sync */
		}
	}, [] );

	// Bring the highlighted section into view (desktop geometry only).
	useEffect( () => {
		if ( ! highlight || bp !== 'desktop' ) return;
		try {
			left.current?.contentWindow?.scrollTo( { top: Math.max( 0, highlight.y - 16 ), behavior: 'instant' as ScrollBehavior } );
		} catch {
			/* ignore */
		}
	}, [ highlight, bp ] );

	const frame = ( ref: typeof left, src: string, title: string, extra?: React.CSSProperties ) => (
		<iframe
			ref={ ref }
			src={ src }
			title={ title }
			onLoad={ sync }
			className={ s.cFrame }
			style={ { width: vw, height: height / scale, transform: `scale(${ scale })`, ...extra } }
		/>
	);

	const onKey = ( e: React.KeyboardEvent ): void => {
		if ( e.key === 'ArrowLeft' || e.key === 'ArrowDown' ) setSplit( ( v ) => Math.max( 0, v - 5 ) );
		if ( e.key === 'ArrowRight' || e.key === 'ArrowUp' ) setSplit( ( v ) => Math.min( 100, v + 5 ) );
		if ( e.key === 'Home' ) setSplit( 0 );
		if ( e.key === 'End' ) setSplit( 100 );
	};

	const startDrag = ( e: React.PointerEvent ): void => {
		const rect = box.current!.getBoundingClientRect();
		const move = ( ev: PointerEvent ): void => setSplit( Math.max( 0, Math.min( 100, ( ( ev.clientX - rect.left ) / rect.width ) * 100 ) ) );
		const up = (): void => {
			window.removeEventListener( 'pointermove', move );
			window.removeEventListener( 'pointerup', up );
		};
		window.addEventListener( 'pointermove', move );
		window.addEventListener( 'pointerup', up );
		move( e.nativeEvent );
	};

	return (
		<div className={ s.compare }>
			<div className={ s.compareBar }>
				{ converted ? (
					<Segmented
						size="sm"
						label={ __( 'Compare mode', 'ai2kit' ) }
						value={ mode }
						onChange={ setMode }
						options={ [
							{ value: 'side', label: __( 'Side by side', 'ai2kit' ) },
							{ value: 'swipe', label: __( 'Swipe', 'ai2kit' ) },
							{ value: 'overlay', label: __( 'Overlay', 'ai2kit' ) },
						] }
					/>
				) : (
					<span className={ s.compareLabel }>{ __( 'Source', 'ai2kit' ) }</span>
				) }
				<Segmented
					size="sm"
					label={ __( 'Breakpoint', 'ai2kit' ) }
					value={ bp }
					onChange={ setBp }
					options={ [
						{ value: 'desktop', label: __( 'Desktop', 'ai2kit' ), icon: 'desktop' },
						{ value: 'tablet', label: __( 'Tablet', 'ai2kit' ), icon: 'tablet' },
						{ value: 'mobile', label: __( 'Mobile', 'ai2kit' ), icon: 'mobile' },
					] }
				/>
			</div>

			<div ref={ box } className={ `${ s.stage } ${ converted && mode === 'side' ? s.stageSide : '' }` } style={ { height } }>
				{ ( ! converted || mode === 'side' ) && (
					<div className={ s.pane } style={ { width: pane, height } }>
						{ frame( left, source, __( 'Source site preview', 'ai2kit' ) ) }
						{ highlight && bp === 'desktop' && ! converted && <span className={ s.highlight } style={ { top: 16 * scale, height: highlight.h * scale } } aria-hidden="true" /> }
					</div>
				) }
				{ converted && mode === 'side' && (
					<div className={ s.pane } style={ { width: pane, height } }>
						{ frame( right, converted, __( 'Converted Elementor page', 'ai2kit' ) ) }
					</div>
				) }
				{ converted && mode !== 'side' && (
					<div className={ s.pane } style={ { width: pane, height } }>
						{ frame( left, source, __( 'Source site preview', 'ai2kit' ) ) }
						<div
							className={ s.over }
							style={ mode === 'swipe' ? { clipPath: `inset(0 0 0 ${ split }%)` } : { mixBlendMode: 'difference' } }
						>
							{ frame( right, converted, __( 'Converted Elementor page', 'ai2kit' ) ) }
						</div>
						{ mode === 'swipe' && (
							<div
								className={ s.divider }
								style={ { insetInlineStart: `${ split }%` } }
								role="slider"
								tabIndex={ 0 }
								aria-label={ __( 'Compare slider', 'ai2kit' ) }
								aria-valuemin={ 0 }
								aria-valuemax={ 100 }
								aria-valuenow={ Math.round( split ) }
								onKeyDown={ onKey }
								onPointerDown={ startDrag }
							>
								<span className={ s.handle } />
							</div>
						) }
					</div>
				) }
			</div>

			{ score !== undefined && (
				<div className={ s.compareFoot }>
					<ScoreRing score={ score } />
					<div>
						<strong>{ __( 'Overall match', 'ai2kit' ) }</strong>
						<p className={ s.muted }>{ __( 'Weighted by section size: structure, styles and HTML kept.', 'ai2kit' ) }</p>
					</div>
				</div>
			) }
		</div>
	);
}
