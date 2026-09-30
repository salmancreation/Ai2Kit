import { Link, NavLink, Outlet } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

const links = [
	[ '/', 'Home' ],
	[ '/about', 'About' ],
	[ '/pricing', 'Pricing' ],
	[ '/contact', 'Contact' ],
];

export default function Layout() {
	return (
		<>
			<header className="site-header">
				<div className="container flex items-center justify-between h-16">
					<Link to="/" className="brand">Northwind</Link>
					<nav className="flex gap-6 main-nav">
						{ links.map( ( [ to, label ] ) => (
							<NavLink key={ to } to={ to } end className={ ( { isActive } ) => ( isActive ? 'nav-link active' : 'nav-link' ) }>{ label }</NavLink>
						) ) }
					</nav>
					<Dialog.Root>
						<Dialog.Trigger className="btn btn-primary">Book a call</Dialog.Trigger>
						<Dialog.Portal>
							<Dialog.Overlay className="dialog-overlay" />
							<Dialog.Content className="dialog">
								<Dialog.Title className="dialog-title">Book a free strategy call</Dialog.Title>
								<Dialog.Description className="muted">Pick a time that suits you. We'll bring ideas for your site.</Dialog.Description>
								<a className="btn btn-primary" href="/contact">Choose a time</a>
								<Dialog.Close className="dialog-close" aria-label="Close"><X className="icon-sm" /></Dialog.Close>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>
				</div>
			</header>
			<Outlet />
			<footer className="site-footer">
				<div className="container footer-grid">
					<div>
						<div className="brand">Northwind</div>
						<p className="muted">Websites that grow your business.</p>
					</div>
					<div>
						<h4>Company</h4>
						<ul className="footer-links">
							<li><Link to="/about">About</Link></li>
							<li><Link to="/pricing">Pricing</Link></li>
							<li><Link to="/contact">Contact</Link></li>
						</ul>
					</div>
					<div>
						<h4>Resources</h4>
						<ul className="footer-links">
							<li><a href="#blog">Blog</a></li>
							<li><a href="#guides">Guides</a></li>
						</ul>
					</div>
				</div>
				<div className="container copyright muted">© 2026 Northwind Studio. All rights reserved.</div>
			</footer>
		</>
	);
}
