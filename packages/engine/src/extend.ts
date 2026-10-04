/**
 * Engine extensions: the documented way add-ons (Ai2Kit Pro) plug extra
 * capture, recognition and emit rules into the pipeline. The engine calls
 * registered extensions in order; with none registered, output is unchanged.
 *
 * The admin app loads the engine as its own script (`window.ai2kit.engine`),
 * so an add-on's script registers into the same instance the app converts with.
 */
import type { Breakpoint, CapturedNode, IRNode, Pattern } from './ir/types';
import type { CaptureEnv } from './capture/capture';
import type { EmitContext, V3Element } from './emit/v3';
import type { V4Element } from './emit/v4';

export type CaptureHookContext = {
	env: CaptureEnv;
	/** The captured tree (desktop styles; smaller breakpoints are merged in as they're captured). */
	root: CapturedNode;
	viewport: Record< Breakpoint, number >;
};

export type DetectHelpers = {
	/** Build IR for a captured subtree (e.g. a tab panel read at capture), with this job's id generator. */
	toIR: ( captured: CapturedNode ) => IRNode;
};

export type EngineExtension = {
	/** Unique name, e.g. "pro/tabs". Registering the same name again replaces it. */
	name: string;
	/** As soon as the page is loaded, before it settles: observe what happens while it renders (numbers counting up). */
	watch?: ( env: CaptureEnv ) => void;
	/** After the desktop capture (hover and accordion panels are attached): read what the static DOM doesn't show. */
	captureDesktop?: ( ctx: CaptureHookContext ) => Promise< void > | void;
	/** After a smaller breakpoint was captured and merged, at that width. */
	captureBreakpoint?: ( ctx: CaptureHookContext, bp: Exclude< Breakpoint, 'desktop' > ) => Promise< void > | void;
	/** Recognize a pattern on a captured node (any kind). Runs before the built-in rules; first match wins. */
	detect?: ( node: CapturedNode, helpers: DetectHelpers ) => Pattern | undefined;
	/** Emit a v3 element for a (non-section) node carrying a pattern. Return undefined to leave it to the built-in emitter. */
	emitV3?: ( node: IRNode, ctx: EmitContext, parent?: IRNode ) => V3Element | null | undefined;
	/** Adjust any emitted v3 element (e.g. add an entrance animation). Called for every node, after emitting. */
	afterEmitV3?: ( node: IRNode, el: V3Element, ctx: EmitContext ) => void;
	/** The same for v4 output (the element may be atomic or a classic widget inside the atomic tree). */
	afterEmitV4?: ( node: IRNode, el: V4Element | V3Element, ctx: EmitContext ) => void;
	/** Emit for v4 output. Without it, a node the extension emits in v3 is emitted with `emitV3` (a classic widget inside the atomic tree). */
	emitV4?: ( node: IRNode, ctx: EmitContext, parent?: IRNode ) => V4Element | V3Element | null | undefined;
};

const registry: EngineExtension[] = [];

export function registerExtension( ext: EngineExtension ): void {
	const at = registry.findIndex( ( e ) => e.name === ext.name );
	if ( at >= 0 ) registry[ at ] = ext;
	else registry.push( ext );
}

export function unregisterExtension( name: string ): void {
	const at = registry.findIndex( ( e ) => e.name === name );
	if ( at >= 0 ) registry.splice( at, 1 );
}

export function extensions(): readonly EngineExtension[] {
	return registry;
}
