import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, Gauge, Palette, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroImg from '../assets/hero.png';
import { PricingTabs } from './Pricing.jsx';

const features = [
	{ icon: Palette, title: 'Design that converts', text: 'Pages built around what your visitors need to see first.' },
	{ icon: Gauge, title: 'Fast by default', text: 'Every site scores 95+ on Core Web Vitals at launch.' },
	{ icon: Search, title: 'Found on Google', text: 'Technical SEO and structured data are included.' },
];

const quotes = [
	[ 'Our bookings doubled in three months.', 'Maya Chen, Bloom Yoga' ],
	[ 'The easiest agency we have ever worked with.', 'Tom Reed, Reed & Co' ],
	[ 'Launch took two weeks, not two months.', 'Ana Silva, Cafe Lume' ],
];

/** Counts from 0 to `to` when mounted (the classic "stats" block). */
function Counter( { to, suffix = '' } ) {
	const [ n, setN ] = useState( 0 );
	useEffect( () => {
		let raf;
		const start = performance.now();
		const tick = ( t ) => {
			const p = Math.min( 1, ( t - start ) / 1200 );
			setN( Math.round( to * p ) );
			if ( p < 1 ) raf = requestAnimationFrame( tick );
		};
		raf = requestAnimationFrame( tick );
		return () => cancelAnimationFrame( raf );
	}, [ to ] );
	return <span className="stat-value">{ n }{ suffix }</span>;
}

function Testimonials() {
	const [ ref, api ] = useEmblaCarousel( { loop: true } );
	const prev = useCallback( () => api && api.scrollPrev(), [ api ] );
	const next = useCallback( () => api && api.scrollNext(), [ api ] );
	return (
		<div className="carousel" role="region" aria-roledescription="carousel">
			<div className="embla" ref={ ref }>
				<div className="embla__container">
					{ quotes.map( ( [ q, who ] ) => (
						<div className="embla__slide" role="group" aria-roledescription="slide" key={ who }>
							<blockquote className="quote">“{ q }”</blockquote>
							<p className="muted">{ who }</p>
						</div>
					) ) }
				</div>
			</div>
			<div className="carousel-nav">
				<button className="icon-btn" onClick={ prev } aria-label="Previous slide"><ChevronLeft className="icon-sm" /></button>
				<button className="icon-btn" onClick={ next } aria-label="Next slide"><ChevronRight className="icon-sm" /></button>
			</div>
		</div>
	);
}

export default function Home() {
	const once = useRef( { once: true } );
	return (
		<main>
			<section className="hero">
				<div className="container hero-grid">
					<motion.div initial={ { opacity: 0, y: 24 } } animate={ { opacity: 1, y: 0 } } transition={ { duration: 0.6 } }>
						<h1>Websites that grow your business</h1>
						<p className="lead">Northwind designs, builds and grows websites for small teams with big plans.</p>
						<div className="flex gap-3">
							<Link className="btn btn-primary" to="/contact">Start a project <ArrowRight className="icon-sm" /></Link>
							<Link className="btn btn-secondary" to="/pricing">See pricing</Link>
						</div>
					</motion.div>
					<motion.img src={ heroImg } alt="A website on a laptop" className="hero-img" initial={ { opacity: 0, scale: 0.95 } } animate={ { opacity: 1, scale: 1 } } transition={ { duration: 0.6, delay: 0.2 } } />
				</div>
			</section>
			<section className="section bg-muted">
				<div className="container stats">
					<div className="stat"><Counter to={ 120 } suffix="+" /><span className="muted">Sites launched</span></div>
					<div className="stat"><Counter to={ 98 } suffix="%" /><span className="muted">Happy clients</span></div>
					<div className="stat"><Counter to={ 12 } /><span className="muted">Years in business</span></div>
				</div>
			</section>
			<section className="section">
				<div className="container">
					<h2 className="center">Everything your site needs</h2>
					<div className="grid-3">
						{ features.map( ( { icon: Icon, title, text }, i ) => (
							<motion.div key={ title } className="card" initial={ { opacity: 0, y: 24 } } whileInView={ { opacity: 1, y: 0 } } viewport={ once.current } transition={ { duration: 0.5, delay: i * 0.1 } }>
								<div className="icon-tile"><Icon className="icon" /></div>
								<h3>{ title }</h3>
								<p className="muted">{ text }</p>
							</motion.div>
						) ) }
					</div>
				</div>
			</section>
			<section className="section bg-muted">
				<div className="container narrow center">
					<h2>What clients say</h2>
					<Testimonials />
				</div>
			</section>
			<section className="section" id="pricing">
				<div className="container">
					<h2 className="center">Plans for every stage</h2>
					<PricingTabs />
				</div>
			</section>
			<section className="section cta">
				<div className="container center">
					<h2>Ready for a better website?</h2>
					<Link className="btn btn-light" to="/contact">Talk to us</Link>
				</div>
			</section>
		</main>
	);
}
