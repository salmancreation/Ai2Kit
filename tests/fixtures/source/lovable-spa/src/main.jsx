import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Home from './Home.jsx';

function NotFound() {
	return <main className="container"><h1>404 — page not found</h1></main>;
}

createRoot( document.getElementById( 'root' ) ).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={ <Home /> } />
			<Route path="*" element={ <NotFound /> } />
		</Routes>
	</BrowserRouter>
);
