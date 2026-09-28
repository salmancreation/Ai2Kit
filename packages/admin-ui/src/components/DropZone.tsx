/** DropZone (DESIGN.md §5.3). */
import { useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Icon, Logo } from './Icon';
import { Button, Badge } from './ui';
import { bytes, fileKind } from '../lib/format';
import s from './convert.module.css';

export function DropZone( { file, onFile, onPaste, error }: { file: File | null; onFile: ( f: File | null ) => void; onPaste: () => void; error?: string } ) {
	const input = useRef< HTMLInputElement >( null );
	const [ over, setOver ] = useState( false );
	const [ shake, setShake ] = useState( false );
	const maxMb = window.ai2kitConfig.maxUploadMb;

	const accept = ( f: File | undefined ): void => {
		if ( ! f ) return;
		if ( fileKind( f.name ) === 'other' ) {
			setShake( true );
			setTimeout( () => setShake( false ), 260 );
			onFile( null );
			return;
		}
		onFile( f );
	};

	if ( file ) {
		const kind = fileKind( file.name );
		return (
			<div className={ s.fileChip }>
				<span className={ s.fileIcon }>
					<Icon name={ kind === 'zip' ? 'layers' : 'file' } size={ 20 } />
				</span>
				<span className={ s.fileMeta }>
					<strong>{ file.name }</strong>
					<span>{ bytes( file.size ) }</span>
				</span>
				<Badge tone="neutral">{ kind === 'zip' ? __( 'ZIP', 'ai2kit' ) : __( 'HTML', 'ai2kit' ) }</Badge>
				<Button variant="ghost" size="sm" icon="x" aria-label={ __( 'Remove file', 'ai2kit' ) } onClick={ () => onFile( null ) } />
			</div>
		);
	}

	return (
		<div>
			<div
				className={ `${ s.dropzone } ${ over ? s.over : '' } ${ shake ? s.shake : '' } ${ error ? s.dzError : '' }` }
				role="button"
				tabIndex={ 0 }
				aria-describedby="a2k-dz-help"
				onClick={ () => input.current?.click() }
				onKeyDown={ ( e ) => {
					if ( e.key === 'Enter' || e.key === ' ' ) {
						e.preventDefault();
						input.current?.click();
					}
				} }
				onDragOver={ ( e ) => {
					e.preventDefault();
					setOver( true );
				} }
				onDragLeave={ () => setOver( false ) }
				onDrop={ ( e ) => {
					e.preventDefault();
					setOver( false );
					accept( e.dataTransfer.files[ 0 ] );
				} }
			>
				<span className={ s.dzIcon }>
					<Logo size={ 22 } />
				</span>
				<h2 className={ s.dzTitle }>{ __( 'Drop your site here', 'ai2kit' ) }</h2>
				<p id="a2k-dz-help" className={ s.dzSub }>
					{ __( 'HTML file, template ZIP, or built Lovable/Bolt/v0 folder (ZIP)', 'ai2kit' ) }
					<br />
					{ sprintf(
						/* translators: %d: upload limit in megabytes. */
						__( 'Up to %d MB. Your files stay on this site.', 'ai2kit' ),
						maxMb
					) }
				</p>
				<span className={ s.dzActions } onClick={ ( e ) => e.stopPropagation() } role="presentation">
					<Button variant="secondary" icon="upload" onClick={ () => input.current?.click() }>
						{ __( 'Choose file', 'ai2kit' ) }
					</Button>
					<Button variant="link" onClick={ onPaste }>
						{ __( 'Paste HTML instead', 'ai2kit' ) }
					</Button>
				</span>
				<input ref={ input } type="file" accept=".html,.htm,.zip,text/html,application/zip" hidden onChange={ ( e ) => accept( e.target.files?.[ 0 ] ) } />
			</div>
			{ ( error || shake ) && (
				<p className={ s.inlineError } role="alert">
					<Icon name="alert" size={ 14 } /> { error ?? __( 'Upload an .html file or a .zip of your built site.', 'ai2kit' ) }
				</p>
			) }
		</div>
	);
}
