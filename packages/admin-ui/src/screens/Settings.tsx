/** Settings screen. */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { api, asApiError } from '../lib/api';
import { ActionBar, PageTitle, Shell } from '../components/Shell';
import { Button, Card, Field, Segmented, Toggle, inputClass, useToast } from '../components/ui';
import s from './screens.module.css';

export function Settings( { onTheme }: { onTheme: ( t: Ai2kitSettings[ 'theme' ] ) => void } ) {
	const toast = useToast();
	const [ v, setV ] = useState< Ai2kitSettings >( window.ai2kitConfig.settings );
	const [ saving, setSaving ] = useState( false );
	const set = < K extends keyof Ai2kitSettings >( k: K, val: Ai2kitSettings[ K ] ): void => setV( ( x ) => ( { ...x, [ k ]: val } ) );

	const save = async (): Promise< void > => {
		setSaving( true );
		try {
			const saved = await api.saveSettings( v );
			window.ai2kitConfig.settings = saved;
			onTheme( saved.theme );
			toast( 'success', __( 'Settings saved.', 'ai2kit' ) );
		} catch ( e ) {
			toast( 'danger', asApiError( e ).message );
		} finally {
			setSaving( false );
		}
	};

	return (
		<Shell>
			<PageTitle title={ __( 'Settings', 'ai2kit' ) } />
			<div className={ s.settings }>
				<Card>
					<h2 className={ s.h2 }>{ __( 'Appearance', 'ai2kit' ) }</h2>
					<Segmented
						label={ __( 'Theme', 'ai2kit' ) }
						value={ v.theme }
						onChange={ ( t ) => {
							set( 'theme', t );
							onTheme( t );
						} }
						options={ [
							{ value: 'light', label: __( 'Light', 'ai2kit' ) },
							{ value: 'dark', label: __( 'Dark', 'ai2kit' ) },
							{ value: 'system', label: __( 'System', 'ai2kit' ) },
						] }
					/>
				</Card>
				<Card>
					<h2 className={ s.h2 }>{ __( 'Defaults', 'ai2kit' ) }</h2>
					<div className={ s.fields }>
						<Field label={ __( 'Create', 'ai2kit' ) }>
							{ ( id ) => (
								<select id={ id } className={ inputClass } value={ v.output } onChange={ ( e ) => set( 'output', e.target.value as Ai2kitSettings[ 'output' ] ) }>
									<option value="page">{ __( 'New page (draft)', 'ai2kit' ) }</option>
									<option value="template">{ __( 'Elementor template', 'ai2kit' ) }</option>
								</select>
							) }
						</Field>
						<Field label={ __( 'Global Colors & Fonts', 'ai2kit' ) } help={ __( 'Replace changes the four system globals for the whole site. A backup is always kept.', 'ai2kit' ) }>
							{ ( id ) => (
								<select id={ id } className={ inputClass } value={ v.kitMode } onChange={ ( e ) => set( 'kitMode', e.target.value as Ai2kitSettings[ 'kitMode' ] ) }>
									<option value="merge">{ __( 'Merge (add as custom globals)', 'ai2kit' ) }</option>
									<option value="replace">{ __( 'Replace system globals', 'ai2kit' ) }</option>
								</select>
							) }
						</Field>
						<Toggle checked={ v.importRemote } onChange={ ( x ) => set( 'importRemote', x ) } label={ __( 'Import remote images into the Media Library', 'ai2kit' ) } help={ __( 'When off, images hosted elsewhere keep their original address.', 'ai2kit' ) } />
						<Toggle checked={ v.keepSource } onChange={ ( x ) => set( 'keepSource', x ) } label={ __( 'Keep uploaded files for re-runs', 'ai2kit' ) } help={ __( 'Otherwise they are deleted after import, or after 24 hours.', 'ai2kit' ) } />
					</div>
				</Card>
				<Card>
					<h2 className={ s.h2 }>{ __( 'Privacy', 'ai2kit' ) }</h2>
					<p className={ s.sub }>{ __( 'Ai2Kit converts in your browser and saves on your server. It makes no requests to Ai2Kit or any other service.', 'ai2kit' ) }</p>
					<Toggle checked={ v.diagnosticsOptIn } onChange={ ( x ) => set( 'diagnosticsOptIn', x ) } label={ __( 'Share anonymous diagnostics', 'ai2kit' ) } help={ __( 'Optional and off by default.', 'ai2kit' ) } />
				</Card>
			</div>
			<ActionBar
				end={
					<Button variant="primary" loading={ saving } onClick={ save }>
						{ __( 'Save settings', 'ai2kit' ) }
					</Button>
				}
			/>
		</Shell>
	);
}
