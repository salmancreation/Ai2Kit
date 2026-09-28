import type { CapturedNode } from '../../src/ir/types';
import { cn, text, resetKeys } from '../helpers';

const BTN = { 'padding-top': '12px', 'padding-bottom': '12px', 'padding-left': '24px', 'padding-right': '24px', 'background-color': 'rgb(124, 58, 237)', color: 'rgb(255, 255, 255)', 'border-top-left-radius': '8px', 'border-top-right-radius': '8px', 'border-bottom-right-radius': '8px', 'border-bottom-left-radius': '8px' };
const R = ( x: number, y: number, w: number, h: number ) => ( { rect: { x, y, w, h } } );

/** A realistic Lovable-style landing page, as capture would produce it. */
export function landing(): CapturedNode {
	resetKeys();
	const card = ( i: number ) =>
		cn( 'div', { 'background-color': 'rgb(255, 255, 255)', 'padding-top': '24px', 'padding-right': '24px', 'padding-bottom': '24px', 'padding-left': '24px', 'border-top-width': '1px', 'border-right-width': '1px', 'border-bottom-width': '1px', 'border-left-width': '1px', 'border-top-style': 'solid', 'border-top-color': 'rgb(226, 232, 240)', 'border-top-left-radius': '12px', 'box-shadow': 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px', display: 'flex', 'flex-direction': 'column', 'row-gap': '12px' }, [
			cn( 'svg', { color: 'rgb(124, 58, 237)' }, [], { svg: '<svg stroke="rgb(124, 58, 237)"><path d="M1"/></svg>', attrs: { class: `lucide lucide-${ [ 'zap', 'shield', 'not-a-real-icon' ][ i ] }` }, ...R( 0, 0, 24, 24 ) } ),
			text( 'h3', `Feature ${ i }`, { 'font-size': '20px', 'font-weight': '600', 'line-height': '28px' } ),
			text( 'p', 'Description of the feature that explains the value.', { color: 'rgb(100, 116, 139)' } ),
		], R( 100 + i * 400, 900, 380, 220 ) );

	return cn( 'body', { 'background-color': 'rgb(255, 255, 255)' }, [
		cn( 'div', {}, [
			cn( 'header', { display: 'flex', 'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'center', 'padding-top': '16px', 'padding-bottom': '16px', 'padding-left': '32px', 'padding-right': '32px' }, [
				text( 'a', 'Acme', { 'font-size': '20px', 'font-weight': '700' }, { attrs: { href: 'http://site.test/' } } ),
				cn( 'nav', { display: 'flex', 'column-gap': '24px' }, [ text( 'a', 'Features', {}, { attrs: { href: 'http://site.test/#features' } } ), text( 'a', 'Pricing', {}, { attrs: { href: 'http://site.test/#pricing' } } ) ], R( 600, 16, 300, 24 ) ),
				text( 'a', 'Sign up', BTN, { attrs: { href: 'http://site.test/signup' } } ),
			], { ...R( 0, 0, 1440, 72 ), mobile: { 'padding-left': '16px', 'padding-right': '16px' } } ),
			cn( 'main', {}, [
				cn( 'section', { 'padding-top': '96px', 'padding-bottom': '96px', 'background-image': 'linear-gradient(135deg, rgb(124, 58, 237) 0%, rgb(46, 144, 250) 100%)', 'text-align': 'center' }, [
					cn( 'div', { 'max-width': '1200px', 'margin-left': '120px', 'margin-right': '120px', 'padding-left': '16px', 'padding-right': '16px' }, [
						cn( 'div', { display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'row-gap': '24px' }, [
							text( 'span', 'New · v2', { display: 'inline-block', 'background-color': 'rgb(237, 233, 254)', 'padding-top': '4px', 'padding-bottom': '4px', 'padding-left': '12px', 'padding-right': '12px', 'border-top-left-radius': '9999px', 'font-size': '12px' }, R( 680, 120, 80, 24 ) ),
							text( 'h1', 'Build <strong>faster</strong> with AI', { 'font-size': '56px', 'font-weight': '800', 'line-height': '64px', color: 'rgb(255, 255, 255)', 'letter-spacing': '-1.2px', 'text-align': 'center' }, { html: 'Build <strong>faster</strong> with AI', mobile: { 'font-size': '36px', 'line-height': '40px' } } ),
							text( 'p', 'Ship a site today.', { color: 'rgb(237, 233, 254)', 'font-size': '18px', 'text-align': 'center' } ),
							cn( 'div', { display: 'flex', 'column-gap': '16px' }, [
								text( 'a', 'Get started', BTN, { attrs: { href: 'http://site.test/start', 'data-a2k-icon': 'lucide lucide-arrow-right', 'data-a2k-icon-pos': 'after' }, svg: '<svg/>' } ),
								text( 'a', 'Docs', { ...BTN, 'background-color': 'rgba(0, 0, 0, 0)', 'border-top-width': '1px', 'border-right-width': '1px', 'border-bottom-width': '1px', 'border-left-width': '1px', 'border-top-style': 'solid', 'border-top-color': 'rgb(255, 255, 255)' }, { attrs: { href: 'http://site.test/docs', target: '_blank' } } ),
							], { ...R( 520, 400, 400, 48 ), mobile: { 'flex-direction': 'column' } } ),
							cn( 'img', { 'border-top-left-radius': '16px', 'object-fit': 'cover' }, [], { attrs: { src: 'http://site.test/assets/hero.png', alt: 'App screenshot' }, ...R( 220, 480, 1000, 500 ) } ),
						], R( 136, 96, 1168, 900 ) ),
					], R( 120, 96, 1200, 900 ) ),
				], { ...R( 0, 72, 1440, 1092 ), mobile: { 'padding-top': '56px', 'padding-bottom': '56px' } } ),
				cn( 'section', { 'padding-top': '80px', 'padding-bottom': '80px', 'background-color': 'rgb(248, 250, 252)' }, [
					text( 'h2', 'Why teams choose Acme', { 'font-size': '36px', 'font-weight': '700', 'text-align': 'center' } ),
					cn( 'div', { display: 'grid', 'grid-template-columns': '380px 380px 380px', 'row-gap': '32px', 'column-gap': '32px' }, [ card( 0 ), card( 1 ), card( 2 ) ], { ...R( 100, 900, 1240, 220 ), tablet: { 'grid-template-columns': '380px 380px' }, mobile: { 'grid-template-columns': '358px' } } ),
					cn( 'ul', {}, [
						cn( 'li', { display: 'flex' }, [ cn( 'svg', {}, [], { svg: '<svg stroke="rgb(18, 183, 106)"/>', attrs: { class: 'lucide-check' } } ), text( 'span', 'Unlimited pages' ) ] ),
						cn( 'li', { display: 'flex' }, [ cn( 'svg', {}, [], { svg: '<svg stroke="rgb(18, 183, 106)"/>', attrs: { class: 'lucide-check' } } ), text( 'span', 'Local-first' ) ] ),
					] ),
					cn( 'hr', { 'border-top-width': '1px', 'border-top-color': 'rgb(226, 232, 240)' } ),
					cn( 'iframe', {}, [], { attrs: { src: 'https://www.youtube.com/embed/abcdefghijk' } } ),
					cn( 'form', {}, [ cn( 'input' ) ], { frozen: '<form><input name="email"></form>' } ),
				], { ...R( 0, 1164, 1440, 900 ), attrs: { id: 'features' } } ),
			], R( 0, 72, 1440, 1992 ) ),
			cn( 'footer', { 'padding-top': '32px', 'padding-bottom': '32px', 'background-color': 'rgb(17, 21, 28)' }, [ text( 'p', '© 2026 Acme Inc.', { color: 'rgb(169, 176, 188)' } ), text( 'p', 'All rights reserved', { color: 'rgb(169, 176, 188)' } ) ], R( 0, 2064, 1440, 100 ) ),
		], { ...R( 0, 0, 1440, 2164 ), attrs: { id: 'root' } } ),
	], R( 0, 0, 1440, 2164 ) );
}

