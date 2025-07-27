/**
 * uPlot.js - Refactored main entry point
 * 
 * This file serves as the main entry point and orchestrates the modular components.
 * It maintains the existing constructor signature and API for backward compatibility.
 */

import {
	FEAT_TIME,
	FEAT_LEGEND,
	FEAT_POINTS,
	FEAT_PATHS,
	FEAT_PATHS_LINEAR,
	FEAT_PATHS_SPLINE,
	FEAT_PATHS_SPLINE2,
	FEAT_PATHS_STEPPED,
	FEAT_PATHS_BARS,
	FEAT_JOIN,
} from './feats.js';

import {
	assign,
	fmtNum,
	rangeNum,
	rangeLog,
	rangeAsinh,
	join,
} from './utils.js';

import {
	pxRatio as pxRatioGlobal,
} from './dom.js';

import {
	fmtDate,
	tzDate,
} from './fmtDate.js';

import { _sync } from './sync.js';

import { points   } from './paths/points.js';
import { linear   } from './paths/linear.js';
import { stepped  } from './paths/stepped.js';
import { bars     } from './paths/bars.js';
import { monotoneCubic     as spline  } from './paths/monotoneCubic.js';
import { catmullRomCentrip as spline2 } from './paths/catmullRomCentrip.js';

import { addGap, clipGaps, orient } from './paths/utils.js';

// Import the core uPlot class
import { UPlotCore } from './core/uplot-core.js';

/**
 * Main uPlot constructor function - creates and returns a UPlotCore instance
 * Maintains existing constructor signature and behavior for API compatibility
 * 
 * @param {Object} opts - Configuration options
 * @param {Array} data - Chart data
 * @param {HTMLElement} target - Target DOM element (optional)
 * @returns {UPlotCore} - uPlot instance
 */
export default function uPlot(opts, data, target) {
	// Create and return UPlotCore instance with proper module orchestration
	const instance = new UPlotCore(opts, data, target);
	
	// Ensure all public API methods are properly delegated to modules
	// The UPlotCore class handles the orchestration internally
	return instance;
}

// Static properties and methods for backward compatibility
uPlot.assign = assign;
uPlot.fmtNum = fmtNum;
uPlot.rangeNum = rangeNum;
uPlot.rangeLog = rangeLog;
uPlot.rangeAsinh = rangeAsinh;
uPlot.orient = orient;
uPlot.pxRatio = pxRatioGlobal;

if (FEAT_JOIN) {
	uPlot.join = join;
}

if (FEAT_TIME) {
	uPlot.fmtDate = fmtDate;
	uPlot.tzDate = tzDate;
}

uPlot.sync = _sync;

if (FEAT_PATHS) {
	uPlot.addGap = addGap;
	uPlot.clipGaps = clipGaps;

	let paths = uPlot.paths = {
		points,
	};

	FEAT_PATHS_LINEAR  && (paths.linear  = linear);
	FEAT_PATHS_STEPPED && (paths.stepped = stepped);
	FEAT_PATHS_BARS    && (paths.bars    = bars);
	FEAT_PATHS_SPLINE  && (paths.spline  = spline);
	FEAT_PATHS_SPLINE2 && (paths.spline2 = spline2);
}