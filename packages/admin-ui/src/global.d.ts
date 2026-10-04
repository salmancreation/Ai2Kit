declare module '*.module.css' {
	const classes: Record< string, string >;
	export default classes;
}

declare module '*.css';

type Ai2kitSettings = {
	theme: 'light' | 'dark' | 'system';
	output: 'page' | 'template';
	format: 'auto' | 'v3' | 'v4';
	kitMode: 'merge' | 'replace';
	importRemote: boolean;
	keepSource: boolean;
	welcomeDone: boolean;
	diagnosticsOptIn: boolean;
};

interface Window {
	ai2kitConfig: {
		screen: 'convert' | 'history' | 'settings' | 'help' | 'pro';
		restUrl: string;
		nonce: string;
		adminUrl: string;
		version: string;
		elementor: { active: boolean; version: string | null; pro: boolean; atomic: boolean };
		maxUploadMb: number;
		canRunScripts: boolean;
		settings: Ai2kitSettings;
		dateFormat: string;
		userId: number;
		isRtl: boolean;
		logo: string;
		/** Set by the Ai2Kit Pro add-on when it's active. */
		pro?: { version: string };
	};
}
