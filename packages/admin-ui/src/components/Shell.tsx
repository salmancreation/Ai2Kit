/**
 * App shell (DESIGN.md §4.1): 64px header with logo, stepper and links;
 * centered content; sticky action bar; "Site notices" pill.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Icon, Logo } from './Icon';
import s from './Shell.module.css';

export function Shell( { center, children }: { center?: ReactNode; children: ReactNode } ) {
	const admin = window.ai2kitConfig.adminUrl;
	return (
		<div className={ s.shell }>
			<header className={ s.header }>
				<a className={ s.brand } href={ `${ admin }admin.php?page=ai2kit` }>
					<span className={ s.logo }>
						<Logo size={ 22 } />
					</span>
					<span className={ s.name }>Ai2Kit</span>
				</a>
				<div className={ s.center }>{ center }</div>
				<nav className={ s.links } aria-label={ __( 'Ai2Kit', 'ai2kit' ) }>
					<SiteNotices />
					<a href={ `${ admin }admin.php?page=ai2kit-help` }>{ __( 'Docs', 'ai2kit' ) }</a>
					<a href={ `${ admin }admin.php?page=ai2kit-pro` } className={ s.pro }>
						{ __( 'Pro', 'ai2kit' ) }
					</a>
				</nav>
			</header>
			<main className={ s.content }>{ children }</main>
		</div>
	);
}

export function ActionBar( { start, end, status }: { start?: ReactNode; end?: ReactNode; status?: ReactNode } ) {
	return (
		<div className={ s.actionBar }>
			<div className={ s.actionInner }>
				<div className={ s.actionStart }>{ start }</div>
				{ status && <div className={ s.actionStatus }>{ status }</div> }
				<div className={ s.actionEnd }>{ end }</div>
			</div>
		</div>
	);
}

export function PageTitle( { title, lead, aside }: { title: string; lead?: string; aside?: ReactNode } ) {
	return (
		<div className={ s.pageTitle }>
			<div>
				<h1>{ title }</h1>
				{ lead && <p>{ lead }</p> }
			</div>
			{ aside }
		</div>
	);
}

/**
 * Other plugins' admin notices are hidden inside the app (CSS) but stay
 * reachable here, so nothing is lost (DESIGN.md §4.1).
 */
function SiteNotices() {
	const [ notices, setNotices ] = useState< HTMLElement[] >( [] );
	const [ open, setOpen ] = useState( false );
	const panel = useRef< HTMLDivElement >( null );
	useEffect( () => {
		const found = Array.from( document.querySelectorAll< HTMLElement >( '#wpbody-content > .notice, #wpbody-content > .update-nag, #wpbody-content > .error, #wpbody-content > .updated' ) );
		setNotices( found );
	}, [] );
	// Move the real notice nodes (keeping their dismiss handlers) into the panel.
	useEffect( () => {
		if ( open && panel.current ) notices.forEach( ( n ) => panel.current!.appendChild( n ) );
	}, [ open, notices ] );
	if ( ! notices.length ) return null;
	return (
		<span className={ s.noticesWrap }>
			<button type="button" className={ s.noticesPill } aria-expanded={ open } onClick={ () => setOpen( ! open ) }>
				<Icon name="info" size={ 14 } />
				{ sprintf(
					/* translators: %d: number of notices from WordPress and other plugins. */
					_n( 'Site notice (%d)', 'Site notices (%d)', notices.length, 'ai2kit' ),
					notices.length
				) }
			</button>
			<div className={ s.noticesPanel } ref={ panel } hidden={ ! open } />
		</span>
	);
}
