/** Import summary (DESIGN.md §5.10, §9 "Import success"). */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { ImportResult } from '../lib/api';
import { Icon } from './Icon';
import { Button, Card } from './ui';
import s from './convert.module.css';

function confettiOnce(): boolean {
	try {
		if ( window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches ) return false;
		if ( sessionStorage.getItem( 'a2k-confetti' ) ) return false;
		sessionStorage.setItem( 'a2k-confetti', '1' );
		return true;
	} catch {
		return false;
	}
}

const proKey = (): string => `a2k-pro-card-dismissed-${ window.ai2kitConfig.userId }`;

export function ImportSummary( { result, onAnother, onUndo, onCompare, canCompare }: { result: ImportResult; onAnother: () => void; onUndo: () => void; onCompare: () => void; canCompare: boolean } ) {
	const [ confetti ] = useState( confettiOnce );
	const [ proHidden, setProHidden ] = useState( () => {
		try {
			return !! localStorage.getItem( proKey() );
		} catch {
			return false;
		}
	} );
	useEffect( () => {
		document.getElementById( 'a2k-done-title' )?.focus();
	}, [] );

	const page = result.created[ 0 ];
	const images = result.media.created.length + result.media.reused;
	const summary = [
		sprintf(
			/* translators: %d: number of pages or templates. */
			_n( '%d page', '%d pages', result.created.length, 'ai2kit' ),
			result.created.length
		),
		sprintf(
			/* translators: %d: number of images. */
			_n( '%d image', '%d images', images, 'ai2kit' ),
			images
		),
		sprintf(
			/* translators: %d: number of colors. */
			_n( '%d color', '%d colors', result.kit.colors, 'ai2kit' ),
			result.kit.colors
		),
		sprintf(
			/* translators: %d: number of fonts. */
			_n( '%d font', '%d fonts', result.kit.fonts, 'ai2kit' ),
			result.kit.fonts
		),
	].join( ', ' );

	return (
		<div className={ s.done }>
			<div className={ s.hero }>
				<span className={ s.checkWrap } aria-hidden="true">
					<svg viewBox="0 0 52 52" className={ s.checkSvg }>
						<circle cx="26" cy="26" r="24" />
						<path d="M15 27l7 7 15-16" />
					</svg>
					{ confetti && Array.from( { length: 6 } ).map( ( _, i ) => <span key={ i } className={ s.confetti } style={ { '--i': i } as React.CSSProperties } /> ) }
				</span>
				<h1 id="a2k-done-title" tabIndex={ -1 }>
					{ __( 'Your site is in Elementor.', 'ai2kit' ) }
				</h1>
				<p className={ s.heroSub }>
					{ sprintf(
						/* translators: %s: list like "1 page, 12 images, 6 colors, 2 fonts". */
						__( 'Done — %s added.', 'ai2kit' ),
						summary
					) }
				</p>
			</div>

			<div className={ s.doneGrid }>
				<Card>
					<h2 className={ s.cardTitle }>{ __( 'Created', 'ai2kit' ) }</h2>
					<ul className={ s.created }>
						{ result.created.map( ( c ) => (
							<li key={ c.id }>
								<Icon name={ c.type === 'page' ? 'file' : 'layers' } />
								<span className={ s.createdTitle }>
									<strong>{ c.title }</strong>
									<span className={ s.muted }>{ c.type === 'page' ? __( 'Draft page', 'ai2kit' ) : __( 'Elementor template', 'ai2kit' ) }</span>
								</span>
								<Button size="sm" variant="primary" href={ c.editUrl } icon="edit">
									{ __( 'Edit with Elementor', 'ai2kit' ) }
								</Button>
								<Button size="sm" variant="secondary" href={ c.viewUrl } target="_blank" iconAfter="external">
									{ __( 'View', 'ai2kit' ) }
								</Button>
							</li>
						) ) }
						{ result.kit.colors + result.kit.fonts > 0 && (
							<li>
								<Icon name="palette" />
								<span className={ s.createdTitle }>
									<strong>{ __( 'Global Colors & Fonts', 'ai2kit' ) }</strong>
									<span className={ s.muted }>{ result.kit.mode === 'replace' ? __( 'System globals replaced (backed up)', 'ai2kit' ) : __( 'Added as custom globals', 'ai2kit' ) }</span>
								</span>
							</li>
						) }
					</ul>
				</Card>

				<Card>
					<h2 className={ s.cardTitle }>{ __( 'Things to check', 'ai2kit' ) }</h2>
					{ result.checks.length ? (
						<ul className={ s.todo }>
							{ result.checks.map( ( c ) => (
								<li key={ c.text }>
									<Icon name="alert" size={ 14 } /> { c.text }
								</li>
							) ) }
						</ul>
					) : (
						<p className={ s.muted }>{ __( 'Nothing — every section mapped to native Elementor widgets.', 'ai2kit' ) }</p>
					) }
				</Card>
			</div>

			<div className={ s.doneActions }>
				<Button variant="primary" size="lg" href={ page?.editUrl } icon="edit">
					{ __( 'Edit with Elementor', 'ai2kit' ) }
				</Button>
				{ canCompare && (
					<Button variant="secondary" icon="eye" onClick={ onCompare }>
						{ __( 'Compare with the source', 'ai2kit' ) }
					</Button>
				) }
				<Button variant="secondary" icon="refresh" onClick={ onAnother }>
					{ __( 'Convert another', 'ai2kit' ) }
				</Button>
				<Button variant="ghost" icon="undo" onClick={ onUndo }>
					{ __( 'Undo this import', 'ai2kit' ) }
				</Button>
			</div>

			{ ! proHidden && (
				<Card className={ s.proCard }>
					<div>
						<strong>{ __( 'Convert all pages at once with Pro.', 'ai2kit' ) }</strong>
						<p className={ s.muted }>{ __( 'Multi-route conversion, header and footer templates, menus, and native tabs and carousels.', 'ai2kit' ) }</p>
					</div>
					<Button variant="link" href={ `${ window.ai2kitConfig.adminUrl }admin.php?page=ai2kit-pro` }>
						{ __( 'See what\'s in Pro', 'ai2kit' ) }
					</Button>
					<Button
						variant="ghost"
						size="sm"
						icon="x"
						aria-label={ __( 'Dismiss', 'ai2kit' ) }
						onClick={ () => {
							setProHidden( true );
							try {
								localStorage.setItem( proKey(), '1' );
							} catch {
								/* ignore */
							}
						} }
					/>
				</Card>
			) }
		</div>
	);
}
