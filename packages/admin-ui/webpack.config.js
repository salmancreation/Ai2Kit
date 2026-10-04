/**
 * Two bundles into plugin/ai2kit/build:
 * - engine.js: the conversion engine as `window.ai2kit.engine` (script handle `ai2kit-engine`),
 *   so add-ons (Ai2Kit Pro) register extensions into the same instance the app uses;
 * - index.js: the admin app, with `@ai2kit/engine` external (→ `ai2kit-engine`).
 */
const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const DependencyExtractionWebpackPlugin = require(
	require.resolve( '@wordpress/dependency-extraction-webpack-plugin', { paths: [ path.dirname( require.resolve( '@wordpress/scripts/package.json' ) ) ] } )
);

const output = { ...defaultConfig.output, path: path.resolve( __dirname, '../../plugin/ai2kit/build' ), clean: false };
const isDep = ( p ) => p && p.constructor && p.constructor.name === 'DependencyExtractionWebpackPlugin';

module.exports = [
	{
		...defaultConfig,
		entry: { engine: './src/engine.ts' },
		output,
		plugins: [ new DependencyExtractionWebpackPlugin() ],
	},
	{
		...defaultConfig,
		entry: { index: './src/index.tsx' },
		output,
		plugins: [
			...defaultConfig.plugins.filter( ( p ) => ! isDep( p ) ),
			new DependencyExtractionWebpackPlugin( {
				requestToExternal: ( request ) => ( request === '@ai2kit/engine' ? [ 'ai2kit', 'engine' ] : undefined ),
				requestToHandle: ( request ) => ( request === '@ai2kit/engine' ? 'ai2kit-engine' : undefined ),
			} ),
		],
	},
];
