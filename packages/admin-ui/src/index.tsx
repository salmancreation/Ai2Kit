/** Ai2Kit admin app entry. Mounts into #ai2kit-root (.ai2kit-app). */
import { createRoot, useEffect, useState } from '@wordpress/element';
import './styles/tokens.css';
import './styles/base.css';
import { ToastProvider } from './components/ui';
import { resolveTheme } from './lib/format';
import { Convert } from './screens/Convert';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { Help, Pro } from './screens/Info';

function App( { root }: { root: HTMLElement } ) {
	const cfg = window.ai2kitConfig;
	const [ theme, setTheme ] = useState( cfg.settings.theme );

	// Dark mode: explicit choice, or System + OS preference (DESIGN.md §3.3).
	useEffect( () => {
		const mq = window.matchMedia( '(prefers-color-scheme: dark)' );
		const apply = (): void => root.setAttribute( 'data-theme', resolveTheme( theme, mq.matches ) );
		apply();
		mq.addEventListener( 'change', apply );
		return () => mq.removeEventListener( 'change', apply );
	}, [ theme, root ] );

	return (
		<ToastProvider>
			{ cfg.screen === 'history' && <History /> }
			{ cfg.screen === 'settings' && <Settings onTheme={ setTheme } /> }
			{ cfg.screen === 'help' && <Help /> }
			{ cfg.screen === 'pro' && <Pro /> }
			{ cfg.screen === 'convert' && <Convert /> }
		</ToastProvider>
	);
}

const mount = document.getElementById( 'ai2kit-root' );
if ( mount && window.ai2kitConfig ) {
	document.body.classList.add( 'ai2kit-has-app' );
	createRoot( mount ).render( <App root={ mount } /> );
}
