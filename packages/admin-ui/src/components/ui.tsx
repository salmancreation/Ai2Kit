/**
 * UI primitives (DESIGN.md §5.1, §5.11). Semantic tokens only.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from '@wordpress/element';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { __ } from '@wordpress/i18n';
import { Icon, type IconName } from './Icon';
import { band } from '../lib/format';
import s from './ui.module.css';

const cx = ( ...c: Array< string | false | null | undefined > ): string => c.filter( Boolean ).join( ' ' );

/* ---------------- Button ---------------- */

type ButtonProps = ButtonHTMLAttributes< HTMLButtonElement > & {
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
	size?: 'sm' | 'md' | 'lg';
	icon?: IconName;
	iconAfter?: IconName;
	loading?: boolean;
	href?: string;
	target?: string;
};

export function Button( { variant = 'secondary', size = 'md', icon, iconAfter, loading, children, className, href, target, disabled, ...rest }: ButtonProps ) {
	const cls = cx( s.btn, s[ `btn-${ variant }` ], s[ `btn-${ size }` ], className );
	const inner = (
		<>
			{ loading ? <Spinner /> : icon && <Icon name={ icon } /> }
			{ children && <span>{ children }</span> }
			{ iconAfter && ! loading && <Icon name={ iconAfter } /> }
		</>
	);
	if ( href ) {
		return (
			<a className={ cls } href={ href } target={ target } rel={ target === '_blank' ? 'noopener noreferrer' : undefined } aria-disabled={ disabled || undefined }>
				{ inner }
			</a>
		);
	}
	return (
		<button type="button" className={ cls } disabled={ disabled || loading } aria-busy={ loading || undefined } { ...rest }>
			{ inner }
		</button>
	);
}

export function Spinner( { label }: { label?: string } ) {
	return <span className={ s.spinner } role={ label ? 'status' : undefined } aria-label={ label } />;
}

/* ---------------- Card / Badge ---------------- */

export function Card( { children, className, interactive, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; interactive?: boolean; as?: 'section' | 'div' | 'article' } & Record< string, unknown > ) {
	return (
		<Tag className={ cx( s.card, interactive && s.cardInteractive, className ) } { ...rest }>
			{ children }
		</Tag>
	);
}

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export function Badge( { tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: IconName } ) {
	return (
		<span className={ cx( s.badge, s[ `tone-${ tone }` ] ) }>
			{ icon && <Icon name={ icon } size={ 12 } /> }
			{ children }
		</span>
	);
}

/** Score badge: color is never the only signal — the number is always shown (§8). */
export function ScoreBadge( { score, title }: { score: number; title?: string } ) {
	return (
		<span className={ cx( s.score, s[ `score-${ band( score ) }` ] ) } title={ title }>
			<span className={ s.scoreDot } aria-hidden="true" />
			{ `${ score }%` }
		</span>
	);
}

/** Overall score ring: counts up over 800ms, color settles at the end (§5.8, §9). `compact` is the table-row size. */
export function ScoreRing( { score, size = 64, compact }: { score: number; size?: number; compact?: boolean } ) {
	const [ shown, setShown ] = useState( 0 );
	useEffect( () => {
		const reduce = window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches;
		if ( reduce ) {
			setShown( score );
			return;
		}
		let raf = 0;
		const start = performance.now();
		const tick = ( t: number ): void => {
			const p = Math.min( 1, ( t - start ) / 800 );
			const eased = 1 - Math.pow( 1 - p, 3 );
			setShown( Math.round( eased * score ) );
			if ( p < 1 ) raf = requestAnimationFrame( tick );
		};
		raf = requestAnimationFrame( tick );
		return () => cancelAnimationFrame( raf );
	}, [ score ] );
	const stroke = compact ? 4 : 6;
	const r = ( size - stroke - 2 ) / 2;
	const c = 2 * Math.PI * r;
	const done = shown === score;
	return (
		<div className={ cx( s.ring, compact && s.ringCompact ) } style={ { width: size, height: size } } role="img" aria-label={ `${ score }%` }>
			<svg width={ size } height={ size } aria-hidden="true">
				<circle cx={ size / 2 } cy={ size / 2 } r={ r } className={ s.ringTrack } />
				<circle
					cx={ size / 2 }
					cy={ size / 2 }
					r={ r }
					className={ cx( s.ringValue, done && s[ `ring-${ band( score ) }` ] ) }
					strokeDasharray={ c }
					strokeDashoffset={ c * ( 1 - shown / 100 ) }
				/>
			</svg>
			<span className={ s.ringLabel }>{ shown }%</span>
		</div>
	);
}

/* ---------------- Segmented / Toggle ---------------- */

export function Segmented< T extends string >( { value, options, onChange, label, size = 'md' }: { value: T; options: Array< { value: T; label: string; icon?: IconName } >; onChange: ( v: T ) => void; label: string; size?: 'sm' | 'md' } ) {
	const refs = useRef< Array< HTMLButtonElement | null > >( [] );
	const idx = options.findIndex( ( o ) => o.value === value );
	const move = ( delta: number ): void => {
		const next = ( idx + delta + options.length ) % options.length;
		onChange( options[ next ]!.value );
		refs.current[ next ]?.focus();
	};
	return (
		<div
			className={ cx( s.seg, size === 'sm' && s.segSm ) }
			role="radiogroup"
			aria-label={ label }
			onKeyDown={ ( e ) => {
				if ( e.key === 'ArrowRight' || e.key === 'ArrowDown' ) {
					e.preventDefault();
					move( window.ai2kitConfig?.isRtl && e.key === 'ArrowRight' ? -1 : 1 );
				} else if ( e.key === 'ArrowLeft' || e.key === 'ArrowUp' ) {
					e.preventDefault();
					move( window.ai2kitConfig?.isRtl && e.key === 'ArrowLeft' ? 1 : -1 );
				}
			} }
		>
			{ options.map( ( o, i ) => (
				<button
					key={ o.value }
					ref={ ( el ) => {
						refs.current[ i ] = el;
					} }
					type="button"
					role="radio"
					aria-checked={ o.value === value }
					tabIndex={ o.value === value ? 0 : -1 }
					className={ cx( s.segItem, o.value === value && s.segActive ) }
					onClick={ () => onChange( o.value ) }
					aria-label={ o.icon ? o.label : undefined }
					title={ o.icon ? o.label : undefined }
				>
					{ o.icon ? <Icon name={ o.icon } /> : o.label }
				</button>
			) ) }
		</div>
	);
}

export function Toggle( { checked, onChange, label, help }: { checked: boolean; onChange: ( v: boolean ) => void; label: string; help?: string } ) {
	const id = useId();
	return (
		<div className={ s.toggleRow }>
			<button id={ id } type="button" role="switch" aria-checked={ checked } className={ cx( s.toggle, checked && s.toggleOn ) } onClick={ () => onChange( ! checked ) }>
				<span className={ s.toggleThumb } />
			</button>
			<label htmlFor={ id } className={ s.toggleLabel }>
				<span>{ label }</span>
				{ help && <span className={ s.help }>{ help }</span> }
			</label>
		</div>
	);
}

export function Checkbox( { checked, onChange, label, help }: { checked: boolean; onChange: ( v: boolean ) => void; label: string; help?: string } ) {
	const id = useId();
	return (
		<div className={ s.checkRow }>
			<input id={ id } type="checkbox" checked={ checked } onChange={ ( e ) => onChange( e.target.checked ) } className={ s.checkbox } />
			<label htmlFor={ id } className={ s.toggleLabel }>
				<span>{ label }</span>
				{ help && <span className={ s.help }>{ help }</span> }
			</label>
		</div>
	);
}

export function Field( { label, help, error, children }: { label: string; help?: string; error?: string; children: ( id: string ) => ReactNode } ) {
	const id = useId();
	return (
		<div className={ s.field }>
			<label htmlFor={ id } className={ s.fieldLabel }>
				{ label }
			</label>
			{ children( id ) }
			{ error ? (
				<span className={ s.fieldError } role="alert">
					<Icon name="alert" size={ 14 } /> { error }
				</span>
			) : (
				help && <span className={ s.help }>{ help }</span>
			) }
		</div>
	);
}

export const inputClass = s.input;

/* ---------------- Tooltip ---------------- */

export function Tooltip( { content, children }: { content: ReactNode; children: ReactNode } ) {
	const [ open, setOpen ] = useState( false );
	const timer = useRef< ReturnType< typeof setTimeout > >();
	const id = useId();
	const show = (): void => {
		clearTimeout( timer.current );
		timer.current = setTimeout( () => setOpen( true ), 400 );
	};
	const hide = (): void => {
		clearTimeout( timer.current );
		setOpen( false );
	};
	return (
		<span className={ s.tipWrap } onMouseEnter={ show } onMouseLeave={ hide } onFocus={ show } onBlur={ hide } aria-describedby={ open ? id : undefined }>
			{ children }
			{ open && (
				<span role="tooltip" id={ id } className={ s.tip }>
					{ content }
				</span>
			) }
		</span>
	);
}

/* ---------------- Upsell chip (never auto-opens a modal) ---------------- */

export function UpsellChip( { children, detail }: { children: ReactNode; detail: string } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef< HTMLSpanElement >( null );
	const hasPro = !! window.ai2kitConfig.pro;
	useEffect( () => {
		if ( ! open ) return;
		const close = ( e: MouseEvent | KeyboardEvent ): void => {
			if ( e instanceof KeyboardEvent ? e.key === 'Escape' : ! ref.current?.contains( e.target as Node ) ) setOpen( false );
		};
		document.addEventListener( 'mousedown', close );
		document.addEventListener( 'keydown', close );
		return () => {
			document.removeEventListener( 'mousedown', close );
			document.removeEventListener( 'keydown', close );
		};
	}, [ open ] );
	// With Pro active there's nothing to upsell.
	if ( hasPro ) return null;
	return (
		<span className={ s.upsellWrap } ref={ ref }>
			<button type="button" className={ s.upsell } onClick={ () => setOpen( ! open ) } aria-expanded={ open }>
				<span className={ s.proTag }>PRO</span>
				{ children }
			</button>
			{ open && (
				<span className={ s.popover } role="dialog" aria-label={ __( 'About Ai2Kit Pro', 'ai2kit' ) }>
					{ detail }
				</span>
			) }
		</span>
	);
}

/* ---------------- Modal ---------------- */

export function Modal( { title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode } ) {
	const ref = useRef< HTMLDivElement >( null );
	const titleId = useId();
	useEffect( () => {
		const prev = document.activeElement as HTMLElement | null;
		const focusables = (): HTMLElement[] => Array.from( ref.current?.querySelectorAll< HTMLElement >( 'button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])' ) ?? [] );
		focusables()[ 0 ]?.focus();
		const onKey = ( e: KeyboardEvent ): void => {
			if ( e.key === 'Escape' ) onClose();
			if ( e.key === 'Tab' ) {
				const f = focusables();
				if ( ! f.length ) return;
				const first = f[ 0 ]!;
				const last = f[ f.length - 1 ]!;
				if ( e.shiftKey && document.activeElement === first ) {
					e.preventDefault();
					last.focus();
				} else if ( ! e.shiftKey && document.activeElement === last ) {
					e.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'keydown', onKey );
			prev?.focus();
		};
	}, [ onClose ] );
	return (
		<div className={ s.overlay } onMouseDown={ ( e ) => e.target === e.currentTarget && onClose() }>
			<div className={ s.modal } role="dialog" aria-modal="true" aria-labelledby={ titleId } ref={ ref }>
				<h2 id={ titleId } className={ s.modalTitle }>
					{ title }
				</h2>
				<div className={ s.modalBody }>{ children }</div>
				{ footer && <div className={ s.modalFooter }>{ footer }</div> }
			</div>
		</div>
	);
}

/* ---------------- Toasts ---------------- */

type Toast = { id: number; tone: Exclude< Tone, 'neutral' | 'brand' >; text: string };
const ToastCtx = createContext< ( tone: Toast[ 'tone' ], text: string ) => void >( () => undefined );
export const useToast = (): ( ( tone: Toast[ 'tone' ], text: string ) => void ) => useContext( ToastCtx );

export function ToastProvider( { children }: { children: ReactNode } ) {
	const [ toasts, setToasts ] = useState< Toast[] >( [] );
	const push = useCallback( ( tone: Toast[ 'tone' ], text: string ) => {
		setToasts( ( t ) => [ ...t, { id: Date.now() + Math.random(), tone, text } ] );
	}, [] );
	const remove = useCallback( ( id: number ) => setToasts( ( t ) => t.filter( ( x ) => x.id !== id ) ), [] );
	return (
		<ToastCtx.Provider value={ push }>
			{ children }
			<div className={ s.toasts }>
				{ toasts.map( ( t ) => (
					<ToastItem key={ t.id } toast={ t } onDone={ () => remove( t.id ) } />
				) ) }
			</div>
		</ToastCtx.Provider>
	);
}

function ToastItem( { toast, onDone }: { toast: Toast; onDone: () => void } ) {
	const [ paused, setPaused ] = useState( false );
	useEffect( () => {
		if ( paused ) return;
		const t = setTimeout( onDone, 5000 );
		return () => clearTimeout( t );
	}, [ paused, onDone ] );
	return (
		<div className={ cx( s.toast, s[ `toast-${ toast.tone }` ] ) } role="status" onMouseEnter={ () => setPaused( true ) } onMouseLeave={ () => setPaused( false ) }>
			<span>{ toast.text }</span>
			<button type="button" className={ s.toastClose } onClick={ onDone } aria-label={ __( 'Dismiss', 'ai2kit' ) }>
				<Icon name="x" size={ 14 } />
			</button>
		</div>
	);
}

/* ---------------- Misc ---------------- */

export function Skeleton( { height = 16, width = '100%' }: { height?: number; width?: number | string } ) {
	return <span className={ s.skeleton } style={ { height, width } } aria-hidden="true" />;
}

export function EmptyState( { icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode } ) {
	return (
		<div className={ s.empty }>
			<span className={ s.emptyIcon }>
				<Icon name={ icon } size={ 24 } />
			</span>
			<h3 className={ s.emptyTitle }>{ title }</h3>
			<p className={ s.help }>{ text }</p>
			{ action }
		</div>
	);
}

export function CodeBlock( { text }: { text: string } ) {
	const [ copied, setCopied ] = useState( false );
	return (
		<div className={ s.code }>
			<button
				type="button"
				className={ s.codeCopy }
				onClick={ () => {
					navigator.clipboard?.writeText( text ).then( () => {
						setCopied( true );
						setTimeout( () => setCopied( false ), 1500 );
					} );
				} }
			>
				<Icon name={ copied ? 'check' : 'copy' } size={ 14 } /> { copied ? __( 'Copied', 'ai2kit' ) : __( 'Copy', 'ai2kit' ) }
			</button>
			<pre>{ text }</pre>
		</div>
	);
}

/** Error block: what happened, why, what to do next, copy details (§6.4). */
export function ErrorNotice( { title, why, next, details }: { title: string; why?: string; next?: string; details?: string } ) {
	return (
		<div className={ s.error } role="alert">
			<Icon name="alert" size={ 18 } />
			<div>
				<strong>{ title }</strong>
				{ why && <p>{ why }</p> }
				{ next && <p className={ s.errorNext }>{ next }</p> }
				{ details && (
					<Button
						variant="link"
						size="sm"
						onClick={ () => {
							navigator.clipboard?.writeText( details );
						} }
					>
						{ __( 'Copy details', 'ai2kit' ) }
					</Button>
				) }
			</div>
		</div>
	);
}

export { cx };
