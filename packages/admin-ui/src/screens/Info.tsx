/** Help and Go Pro screens (Go Pro is a plain page; never a flashing badge — DESIGN.md §4.2). */
import { __ } from '@wordpress/i18n';
import { PageTitle, Shell } from '../components/Shell';
import { Button, Card, CodeBlock } from '../components/ui';
import { Icon } from '../components/Icon';
import s from './screens.module.css';

export function Help() {
	const faq: Array< [ string, string ] > = [
		[ __( 'My React/Vite site converts to a blank page', 'ai2kit' ), __( 'Upload the built output (the dist folder as a ZIP), not the project source. Build with a relative base so asset paths work from any folder.', 'ai2kit' ) ],
		[ __( 'Images are missing', 'ai2kit' ), __( 'The build uses absolute paths (/assets/…). Ai2Kit fixes most automatically; building with --base=./ fixes the rest.', 'ai2kit' ) ],
		[ __( 'Imported pages render blank', 'ai2kit' ), __( 'Turn on Flexbox Container in Elementor → Settings → Features. The Check step can do it for you.', 'ai2kit' ) ],
		[ __( 'A section looks different', 'ai2kit' ), __( 'Switch it to HTML in Review to keep it pixel-exact, or keep it Native and adjust it in Elementor.', 'ai2kit' ) ],
		[ __( 'Fonts don\'t match', 'ai2kit' ), __( 'Ai2Kit sets the font family on each widget; Elementor loads Google Fonts automatically. Self-hosted fonts need to be added in Elementor → Custom Fonts.', 'ai2kit' ) ],
	];
	return (
		<Shell>
			<PageTitle title={ __( 'Help', 'ai2kit' ) } lead={ __( 'Quick answers to the most common questions.', 'ai2kit' ) } />
			<div className={ s.settings }>
				<Card>
					<h2 className={ s.h2 }>{ __( 'Build a Lovable, Bolt or Vite project for upload', 'ai2kit' ) }</h2>
					<CodeBlock text={ 'npm install\nnpm run build -- --base=./\n# then ZIP the dist folder and upload it' } />
				</Card>
				<Card>
					<h2 className={ s.h2 }>{ __( 'Troubleshooting', 'ai2kit' ) }</h2>
					<dl className={ s.faq }>
						{ faq.map( ( [ q, a ] ) => (
							<div key={ q }>
								<dt>{ q }</dt>
								<dd>{ a }</dd>
							</div>
						) ) }
					</dl>
				</Card>
				<Card>
					<h2 className={ s.h2 }>{ __( 'Known limits', 'ai2kit' ) }</h2>
					<p className={ s.sub }>{ __( 'Ai2Kit converts presentational pages. App logic and backends (logins, dashboards, databases), canvas/WebGL, and complex absolutely positioned layouts are kept as HTML or not converted.', 'ai2kit' ) }</p>
				</Card>
			</div>
		</Shell>
	);
}

export function Pro() {
	const features = [
		__( 'Convert every route of a site in one job', 'ai2kit' ),
		__( 'Header and footer templates, and real WordPress menus', 'ai2kit' ),
		__( 'Native tabs, carousels, counters and popups', 'ai2kit' ),
		__( 'Forms with email delivery and spam protection', 'ai2kit' ),
		__( 'Repeated cards → custom post types with loop templates', 'ai2kit' ),
		__( 'Entrance animations and Elementor v4 classes & variables', 'ai2kit' ),
		__( 'Kit export, cloud builds and a Chrome companion', 'ai2kit' ),
	];
	return (
		<Shell>
			<PageTitle title={ __( 'Ai2Kit Pro', 'ai2kit' ) } lead={ __( 'Convert whole sites, not just pages.', 'ai2kit' ) } />
			<Card>
				<ul className={ s.proList }>
					{ features.map( ( f ) => (
						<li key={ f }>
							<Icon name="check" /> { f }
						</li>
					) ) }
				</ul>
				<p className={ s.sub }>{ __( 'Everything in Ai2Kit Free stays free and unlimited. Pro is a separate add-on.', 'ai2kit' ) }</p>
				<Button variant="primary" href="https://ai2kit.com/pro" target="_blank" iconAfter="external">
					{ __( 'Learn about Pro', 'ai2kit' ) }
				</Button>
			</Card>
		</Shell>
	);
}
