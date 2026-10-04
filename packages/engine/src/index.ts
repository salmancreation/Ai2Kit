export * from './ir/types';
export { captureAll, captureTree, captureStyles, captureMeta, applyBreakpoint, DEFAULT_VIEWPORT, KEY_ATTR } from './capture/capture';
export { freezeElement, responsiveDiffs, sanitizeInline, serializeSvg } from './capture/freeze';
export type { ResponsiveDiffs } from './capture/freeze';
export { waitForStable, scrollThrough, injectSettleStyles } from './capture/wait';
export { analyze, emit, convert, suggestedModes } from './pipeline';
export type { Analysis, ElementorDocument, EmitOptions, ConversionResult } from './pipeline';
export type { V3Element } from './emit/v3';
export type { V4Element, V4Css } from './emit/v4';
export { detectSource } from './detect/source';
export type { SourceInfo, SourceType } from './detect/source';
export { scoreBand } from './score/fidelity';
export { createIdGenerator } from './util/ids';

/*
 * Extension API (Ai2Kit Pro and other add-ons): the registry and the building
 * blocks extensions use to capture, recognize and emit like the core rules do.
 */
export { registerExtension, unregisterExtension, extensions } from './extend';
export type { EngineExtension, CaptureHookContext, DetectHelpers } from './extend';
export { captureSubtree, stampSubtree, readStyles, measureRect } from './capture/capture';
export type { CaptureEnv } from './capture/capture';
export { buildIR, collapseWrappers } from './normalize/build';
export { liftBackgroundLayers } from './normalize/layers';
export { textOf, lucideName } from './recognize/leaf';
export {
	emitNode,
	emptyStats,
	widget,
	containerSettings,
	commonWidget,
	colorSetting,
	typography,
	boxSetting,
	borderSettings,
	backgroundSettings,
	hoverSettings,
	iconSetting,
	iconValue,
} from './emit/v3';
export type { EmitContext, NodeStats, IconSetting } from './emit/v3';
export { emitV4Node } from './emit/v4';
export { slider, dims, gaps, responsive, effective, link } from './emit/settings';
export type { Settings } from './emit/settings';
export { px, round, parseBox, parseShadow } from './util/units';
export { parseColor, normalizeColor, isTransparent, toHex } from './util/color';
