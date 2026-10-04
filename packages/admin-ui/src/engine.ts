/**
 * The conversion engine as a shared script (`window.ai2kit.engine`, handle
 * `ai2kit-engine`). The admin app and add-ons import `@ai2kit/engine`, which
 * resolves here at runtime, so extensions register into one instance.
 */
import * as engine from '@ai2kit/engine';

const w = window as unknown as { ai2kit?: Record< string, unknown > };
w.ai2kit = { ...w.ai2kit, engine };
