import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		globals: true,
		environmentOptions: {
			happyDOM: { settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true, handleDisabledFileLoadingAsSuccess: true } },
		},
		include: [ 'test/**/*.test.ts' ],
		coverage: {
			provider: 'v8',
			include: [ 'src/**/*.ts' ],
			exclude: [ 'src/index.ts', 'src/ir/types.ts' ],
			thresholds: { lines: 90 },
		},
	},
} );
