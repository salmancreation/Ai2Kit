import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Pricing from './pages/Pricing.jsx';
import Contact from './pages/Contact.jsx';

createRoot( document.getElementById( 'root' ) ).render(
	<BrowserRouter>
		<Routes>
			<Route element={ <Layout /> }>
				<Route path="/" element={ <Home /> } />
				<Route path="/about" element={ <About /> } />
				<Route path="/pricing" element={ <Pricing /> } />
				<Route path="/contact" element={ <Contact /> } />
				<Route path="*" element={ <main className="container section"><h1>Page not found</h1></main> } />
			</Route>
		</Routes>
	</BrowserRouter>
);
