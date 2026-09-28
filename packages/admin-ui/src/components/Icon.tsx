/** Inline stroke icons (currentColor). Decorative unless given a label. */
const PATHS: Record< string, string > = {
	check: 'M5 12.5l4.5 4.5L19 7.5',
	x: 'M6 6l12 12M18 6L6 18',
	alert: 'M12 8v5m0 3.5v.01M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
	info: 'M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
	upload: 'M12 16V4m0 0l-4.5 4.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16',
	file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zm0 0v5h5',
	arrowRight: 'M5 12h14m-5-5l5 5-5 5',
	arrowLeft: 'M19 12H5m5 5l-5-5 5-5',
	external: 'M14 4h6v6m0-6L10 14M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5',
	desktop: 'M4 5h16v11H4zM9 20h6m-3-4v4',
	tablet: 'M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm4.5 15h1',
	mobile: 'M8.5 3h7a1 1 0 011 1v16a1 1 0 01-1 1h-7a1 1 0 01-1-1V4a1 1 0 011-1zm3 15h1',
	shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z',
	layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16.5l9 5 9-5',
	sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8l2.8 2.8m0-11.4l-2.8 2.8m-5.8 5.8l-2.8 2.8',
	chevronDown: 'M6 9l6 6 6-6',
	chevronRight: 'M9 6l6 6-6 6',
	copy: 'M8 8h11v11H8zM5 16H4a1 1 0 01-1-1V4a1 1 0 011-1h11a1 1 0 011 1v1',
	undo: 'M4 9h11a5 5 0 010 10H9M4 9l4-4M4 9l4 4',
	code: 'M8 7l-5 5 5 5m8-10l5 5-5 5',
	paste: 'M9 4h6v3H9zM7 5.5H6a2 2 0 00-2 2V19a2 2 0 002 2h12a2 2 0 002-2V7.5a2 2 0 00-2-2h-1',
	palette: 'M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 005-5c0-4.4-4-7.8-9-7.8zM7.5 12h.01M10 7.5h.01M15 7.5h.01',
	history: 'M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8m0-5v5h5m4-1v5l4 2',
	eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
	edit: 'M4 20h4L19 9l-4-4L4 16v4zm9-13l4 4',
	refresh: 'M20 11a8 8 0 00-14.6-4.5L4 8m0-5v5h5M4 13a8 8 0 0014.6 4.5L20 16m0 5v-5h-5',
};

export type IconName = keyof typeof PATHS;

export function Icon( { name, size = 16, label, className }: { name: IconName; size?: number; label?: string; className?: string } ) {
	return (
		<svg
			className={ className }
			width={ size }
			height={ size }
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={ 1.8 }
			strokeLinecap="round"
			strokeLinejoin="round"
			role={ label ? 'img' : undefined }
			aria-label={ label }
			aria-hidden={ label ? undefined : true }
			focusable="false"
		>
			<path d={ PATHS[ name ] } />
		</svg>
	);
}

/** The Ai2Kit mark: two offset rounded squares joined by an arrow notch (DESIGN.md §2). */
export function Logo( { size = 24 }: { size?: number } ) {
	return (
		<svg width={ size } height={ size } viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
			<rect x="1" y="1" width="10" height="10" rx="3" />
			<rect x="9" y="9" width="10" height="10" rx="3" fillOpacity=".55" />
			<path d="M11.5 4.5h3a1 1 0 0 1 1 1v3l-1.6-1.6-2.9 2.9-1.3-1.3 2.9-2.9z" />
		</svg>
	);
}
