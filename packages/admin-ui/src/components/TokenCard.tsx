/** Token review card (DESIGN.md §5.9). */
import { __, sprintf } from '@wordpress/i18n';
import type { TokenTable } from '@ai2kit/engine';
import { Badge, Card, Toggle, Segmented } from './ui';
import { Icon } from './Icon';
import s from './review.module.css';

export function TokenCard( {
	tokens,
	onRename,
	apply,
	onApply,
	kitMode,
	onKitMode,
}: {
	tokens: TokenTable;
	onRename: ( kind: 'colors' | 'fonts', id: string, title: string ) => void;
	apply: boolean;
	onApply: ( v: boolean ) => void;
	kitMode: 'merge' | 'replace';
	onKitMode: ( m: 'merge' | 'replace' ) => void;
} ) {
	return (
		<Card>
			<div className={ s.tokHead }>
				<div>
					<h3 className={ s.cardTitle }>{ __( 'Design tokens', 'ai2kit' ) }</h3>
					<p className={ s.muted }>
						{ tokens.source === 'shadcn' ? __( 'Read from the site\'s shadcn/ui theme variables.', 'ai2kit' ) : __( 'Clustered from the colors and fonts the page uses most.', 'ai2kit' ) }
					</p>
				</div>
				<Toggle checked={ apply } onChange={ onApply } label={ __( 'Add to Elementor Global Colors & Fonts', 'ai2kit' ) } />
			</div>

			<h4 className={ s.tokSub }>{ __( 'Colors', 'ai2kit' ) }</h4>
			<ul className={ s.swatches }>
				{ tokens.colors.map( ( c ) => (
					<li key={ c.id } className={ s.swatch }>
						<span className={ s.chip } style={ { background: c.hex } } aria-hidden="true" />
						<span className={ s.swatchText }>
							<input
								className={ s.nameInput }
								value={ c.title }
								aria-label={ sprintf(
									/* translators: %s: hex color. */
									__( 'Name for %s', 'ai2kit' ),
									c.hex
								) }
								onChange={ ( e ) => onRename( 'colors', c.id, e.target.value ) }
							/>
							<code>{ c.hex }</code>
						</span>
						{ c.system && <Badge tone="neutral">{ __( 'System', 'ai2kit' ) }</Badge> }
					</li>
				) ) }
			</ul>

			<h4 className={ s.tokSub }>{ __( 'Typography', 'ai2kit' ) }</h4>
			<ul className={ s.fonts }>
				{ tokens.fonts.map( ( f ) => (
					<li key={ f.id } className={ s.fontRow }>
						<input className={ s.nameInput } value={ f.title } aria-label={ __( 'Font name', 'ai2kit' ) } onChange={ ( e ) => onRename( 'fonts', f.id, e.target.value ) } />
						<span className={ s.sample } style={ { fontFamily: `"${ f.family }", var(--a2k-font-sans)`, fontWeight: Number( f.weight ) || 400 } }>
							{ `The quick brown fox — ${ f.title } ${ f.size ? `${ f.size }${ f.lineHeight ? `/${ Math.round( f.size * f.lineHeight ) }` : '' }` : '' } ${ f.family } ${ f.weight ?? '' }`.replace( /\s+/g, ' ' ).trim() }
						</span>
					</li>
				) ) }
				{ ! tokens.fonts.length && <li className={ s.muted }>{ __( 'No custom fonts detected; the theme fonts will be used.', 'ai2kit' ) }</li> }
			</ul>

			{ apply && (
				<div className={ s.kitMode }>
					<Segmented
						label={ __( 'How to add tokens', 'ai2kit' ) }
						value={ kitMode }
						onChange={ onKitMode }
						options={ [
							{ value: 'merge', label: __( 'Merge into existing Global Colors', 'ai2kit' ) },
							{ value: 'replace', label: __( 'Replace', 'ai2kit' ) },
						] }
					/>
					{ kitMode === 'replace' && (
						<p className={ s.replaceWarn } role="note">
							<Icon name="alert" size={ 14 } />
							{ __( 'Replacing changes the Primary, Secondary, Text and Accent globals for the whole site. The old kit is backed up, and Undo restores it.', 'ai2kit' ) }
						</p>
					) }
				</div>
			) }
		</Card>
	);
}
