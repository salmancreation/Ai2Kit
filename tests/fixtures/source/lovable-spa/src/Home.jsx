import * as Accordion from '@radix-ui/react-accordion';
import { ArrowRight, CalendarCheck, Sparkles, Timer, Check, ChevronDown, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImg from './assets/hero.png';

const features = [
	{ icon: Sparkles, title: 'AI planning', text: 'Tell Brightpath your goals and get a realistic weekly plan in seconds.' },
	{ icon: CalendarCheck, title: 'Calendar sync', text: 'Works with Google and Outlook. Changes flow both ways, instantly.' },
	{ icon: Timer, title: 'Focus timer', text: 'Protect deep work with focus blocks that silence the noise.' },
];

const faqs = [
	[ 'Is there a free plan?', 'Yes. Brightpath is free for personal use with up to 3 calendars.' ],
	[ 'Can my team use it?', 'Team plans add shared goals, workload views and admin controls.' ],
	[ 'Is my data private?', 'Your data is encrypted and never used to train models.' ],
];

export default function Home() {
	return (
		<>
			<header className="border-b">
				<div className="container flex items-center justify-between h-16">
					<Link to="/" className="brand">Brightpath</Link>
					<nav className="flex gap-6 muted">
						<a href="#features">Features</a>
						<a href="#faq">FAQ</a>
					</nav>
					<a className="btn btn-primary" href="#start">Try free</a>
				</div>
			</header>
			<main>
				<section className="hero">
					<div className="container hero-grid">
						<div>
							<span className="pill">
								<Star className="icon-sm" /> Rated 4.9 by 2,000+ teams
							</span>
							<h1>Plan your week in minutes, not hours</h1>
							<p className="lead">Brightpath turns your goals into a calendar you can actually keep.</p>
							<div className="flex gap-3">
								<a className="btn btn-primary" href="#start">
									Get started <ArrowRight className="icon-sm" />
								</a>
								<a className="btn btn-secondary" href="#features">Learn more</a>
							</div>
						</div>
						<img src={ heroImg } alt="Weekly plan preview" className="hero-img" />
					</div>
				</section>
				<section id="features" className="section bg-muted">
					<div className="container">
						<h2 className="center">Why teams switch to Brightpath</h2>
						<div className="grid-3">
							{ features.map( ( { icon: Icon, title, text } ) => (
								<div key={ title } className="card">
									<div className="icon-tile"><Icon className="icon" /></div>
									<h3>{ title }</h3>
									<p className="muted">{ text }</p>
								</div>
							) ) }
						</div>
						<ul className="checks">
							<li><Check className="icon-sm ok" /> No credit card required</li>
							<li><Check className="icon-sm ok" /> Cancel anytime</li>
						</ul>
					</div>
				</section>
				<section id="faq" className="section">
					<div className="container narrow">
						<h2 className="center">Frequently asked questions</h2>
						<Accordion.Root type="single" collapsible className="accordion">
							{ faqs.map( ( [ q, a ], i ) => (
								<Accordion.Item key={ q } value={ `item-${ i }` } className="acc-item">
									<Accordion.Header>
										<Accordion.Trigger className="acc-trigger">
											{ q } <ChevronDown className="icon-sm" />
										</Accordion.Trigger>
									</Accordion.Header>
									<Accordion.Content className="acc-content">{ a }</Accordion.Content>
								</Accordion.Item>
							) ) }
						</Accordion.Root>
					</div>
				</section>
				<section id="start" className="section cta">
					<div className="container center">
						<h2>Start planning smarter today</h2>
						<p className="lead">Join thousands of teams who got their week back.</p>
						<a className="btn btn-light" href="#top">Create free account</a>
					</div>
				</section>
			</main>
			<footer className="border-t">
				<div className="container flex items-center justify-between py-8 muted">
					<span>© 2026 Brightpath Labs</span>
					<span>Made with care</span>
				</div>
			</footer>
		</>
	);
}
