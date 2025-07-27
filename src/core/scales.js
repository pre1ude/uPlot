import {
	assign,
	log10,
	asinh,
	fnOrSelf,
	ifNull,
	isArr,
	isObj,
	nullNullTuple,
	autoRangePart,
	rangeNum,
	rangeLog,
	rangeAsinh,
	rangePad,
	EMPTY_OBJ
} from '../utils.js';

import {
	xScaleOpts,
	yScaleOpts,
	clampScale
} from '../opts.js';

import { FEAT_TIME } from '../feats.js';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	safeExecute,
	errorReporter
} from './errors.js';

// Snap functions for different scale types
function snapNumX(self, dataMin, dataMax) {
	return dataMin == null ? nullNullTuple : [dataMin, dataMax];
}

const snapTimeX = snapNumX;

// this ensures that non-temporal/numeric y-axes get multiple-snapped padding added above/below
// TODO: also account for incrs when snapping to ensure top of axis gets a tick & value
function snapNumY(self, dataMin, dataMax) {
	return dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, rangePad, true);
}

function snapLogY(self, dataMin, dataMax, scale) {
	return dataMin == null ? nullNullTuple : rangeLog(dataMin, dataMax, self.scales[scale].log, true);
}

const snapLogX = snapLogY;

function snapAsinhY(self, dataMin, dataMax, scale) {
	return dataMin == null ? nullNullTuple : rangeAsinh(dataMin, dataMax, self.scales[scale].log, true);
}

const snapAsinhX = snapAsinhY;

/**
 * Scale Manager - handles scale initialization, management, and value-to-pixel conversions
 */
export class ScaleManager {
	constructor(uplot, opts) {
		try {
			validateRequired(uplot, 'uplot', 'ScaleManager', 'constructor');
			validateRequired(opts, 'opts', 'ScaleManager', 'constructor');
			
			this.uplot = uplot;
			this.opts = opts;
			this.scales = {};
			this.pendScales = {};
			this.viaAutoScaleX = false;
			
			// Mode and scale key references
			this.mode = uplot.mode || 1;
			this.xScaleKey = this.mode == 2 ? 
				(opts.series && opts.series[1] && opts.series[1].facets ? opts.series[1].facets[0].scale || 'x' : 'x') : 
				(opts.series && opts.series[0] && opts.series[0].scale ? opts.series[0].scale : 'x');
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize value-to-percentage conversion function for a scale
	 */
	initValToPct(sc) {
		try {
			validateRequired(sc, 'sc', 'ScaleManager', 'initValToPct');
			
			const getVal = (
				sc.distr == 3   ? val => {
					if (val <= 0 && !sc.clamp) {
						throw new UPlotError(
							`Invalid value ${val} for log scale - must be positive`,
							'ScaleManager',
							{ method: 'initValToPct', scaleKey: sc.key, type: ERROR_TYPES.SCALE_CALCULATION }
						);
					}
					return log10(val > 0 ? val : sc.clamp(this.uplot, val, sc.min, sc.max, sc.key));
				} :
				sc.distr == 4   ? val => asinh(val, sc.asinh) :
				sc.distr == 100 ? val => {
					if (typeof sc.fwd !== 'function') {
						throw new UPlotError(
							'Custom scale missing forward transform function',
							'ScaleManager',
							{ method: 'initValToPct', scaleKey: sc.key, type: ERROR_TYPES.VALIDATION }
						);
					}
					return sc.fwd(val);
				} :
				val => val
			);

			return val => {
				try {
					let _val = getVal(val);
					let { _min, _max } = sc;
					
					if (_min == null || _max == null) {
						throw new UPlotError(
							'Scale not properly initialized - missing min/max values',
							'ScaleManager',
							{ method: 'valToPct', scaleKey: sc.key, type: ERROR_TYPES.SCALE_CALCULATION }
						);
					}
					
					let delta = _max - _min;
					if (delta === 0) {
						return 0.5; // Return middle position for zero range
					}
					
					return (_val - _min) / delta;
				} catch (error) {
					if (error instanceof UPlotError) {
						throw error;
					}
					throw new UPlotError(
						`Error converting value to percentage: ${error.message}`,
						'ScaleManager',
						{ method: 'valToPct', scaleKey: sc.key, value: val, type: ERROR_TYPES.SCALE_CALCULATION },
						error
					);
				}
			};
		} catch (error) {
			errorReporter.reportError(error);
			throw error;
		}
	}

	/**
	 * Initialize a scale with the given key
	 */
	initScale(scaleKey) {
		try {
			validateRequired(scaleKey, 'scaleKey', 'ScaleManager', 'initScale');
			validateType(scaleKey, 'string', 'scaleKey', 'ScaleManager', 'initScale');
			
			let sc = this.scales[scaleKey];

			if (sc == null) {
				let scaleOpts = (this.opts.scales || EMPTY_OBJ)[scaleKey] || EMPTY_OBJ;

				if (scaleOpts.from != null) {
					// Validate parent scale exists or can be created
					if (scaleOpts.from === scaleKey) {
						throw new UPlotError(
							`Scale '${scaleKey}' cannot reference itself as parent`,
							'ScaleManager',
							{ method: 'initScale', scaleKey, type: ERROR_TYPES.VALIDATION }
						);
					}
					
					// ensure parent is initialized
					this.initScale(scaleOpts.from);
					
					if (!this.scales[scaleOpts.from]) {
						throw new UPlotError(
							`Parent scale '${scaleOpts.from}' could not be initialized`,
							'ScaleManager',
							{ method: 'initScale', scaleKey, parentScale: scaleOpts.from, type: ERROR_TYPES.INITIALIZATION }
						);
					}
					
					// dependent scales inherit
					let sc = assign({}, this.scales[scaleOpts.from], scaleOpts, {key: scaleKey});
					sc.valToPct = this.initValToPct(sc);
					this.scales[scaleKey] = sc;
				}
				else {
					sc = this.scales[scaleKey] = assign({}, (scaleKey == this.xScaleKey ? xScaleOpts : yScaleOpts), scaleOpts);

					sc.key = scaleKey;

					let isTime = FEAT_TIME && sc.time;

					let rn = sc.range;

					let rangeIsArr = isArr(rn);

					if (scaleKey != this.xScaleKey || (this.mode == 2 && !isTime)) {
						// if range array has null limits, it should be auto
						if (rangeIsArr && (rn[0] == null || rn[1] == null)) {
							rn = {
								min: rn[0] == null ? autoRangePart : {
									mode: 1,
									hard: rn[0],
									soft: rn[0],
								},
								max: rn[1] == null ? autoRangePart : {
									mode: 1,
									hard: rn[1],
									soft: rn[1],
								},
							};
							rangeIsArr = false;
						}

						if (!rangeIsArr && isObj(rn)) {
							let cfg = rn;
							// this is similar to snapNumY
							rn = (self, dataMin, dataMax) => dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, cfg);
						}
					}

					sc.range = fnOrSelf(rn || (isTime ? snapTimeX : scaleKey == this.xScaleKey ?
						(sc.distr == 3 ? snapLogX : sc.distr == 4 ? snapAsinhX : snapNumX) :
						(sc.distr == 3 ? snapLogY : sc.distr == 4 ? snapAsinhY : snapNumY)
					));

					sc.auto = fnOrSelf(rangeIsArr ? false : sc.auto);

					sc.clamp = fnOrSelf(sc.clamp || clampScale);

					// caches for expensive ops like asinh() & log()
					sc._min = sc._max = null;

					sc.valToPct = this.initValToPct(sc);
				}
			}
		} catch (error) {
			errorReporter.reportError(error);
			throw error;
		}
	}

	/**
	 * Initialize all required scales
	 */
	initScales() {
		// Initialize base scales
		this.initScale("x");
		this.initScale("y");

		// Initialize series scales in mode 1
		if (this.mode == 1 && this.uplot.series && Array.isArray(this.uplot.series)) {
			this.uplot.series.forEach(s => {
				if (s && s.scale) {
					this.initScale(s.scale);
				}
			});
		}

		// Initialize axis scales
		if (this.uplot.axes?.axes && Array.isArray(this.uplot.axes.axes)) {
			this.uplot.axes.axes.forEach(a => {
				if (a && a.scale) {
					this.initScale(a.scale);
				}
			});
		}

		// Initialize any additional scales from options
		for (let k in (this.opts.scales || {})) {
			this.initScale(k);
		}

		// Set up explicitly-set initial scales
		for (let k in this.scales) {
			let sc = this.scales[k];

			if (sc.min != null || sc.max != null) {
				this.pendScales[k] = {min: sc.min, max: sc.max};
				sc.min = sc.max = null;
			}
		}
	}

	/**
	 * Get horizontal position from value
	 */
	getHPos(val, scale, dim, off) {
		let pct = scale.valToPct(val);
		return off + dim * (scale.dir == -1 ? (1 - pct) : pct);
	}

	/**
	 * Get vertical position from value
	 */
	getVPos(val, scale, dim, off) {
		let pct = scale.valToPct(val);
		return off + dim * (scale.dir == -1 ? pct : (1 - pct));
	}

	/**
	 * Get position from value (orientation-aware)
	 */
	getPos(val, scale, dim, off) {
		return scale.ori == 0 ? this.getHPos(val, scale, dim, off) : this.getVPos(val, scale, dim, off);
	}

	/**
	 * Convert value to X position
	 */
	valToPosX(val, scale, dim, off) {
		const scaleX = this.scales[this.xScaleKey];
		return scaleX.ori == 0 ? this.getHPos(val, scale, dim, off) : this.getVPos(val, scale, dim, off);
	}

	/**
	 * Convert value to Y position
	 */
	valToPosY(val, scale, dim, off) {
		const scaleX = this.scales[this.xScaleKey];
		return scaleX.ori == 0 ? this.getVPos(val, scale, dim, off) : this.getHPos(val, scale, dim, off);
	}

	/**
	 * Convert position to value
	 */
	posToVal(pos, scaleKey, can) {
		return withErrorBoundary('ScaleManager', 'posToVal', function(pos, scaleKey, can) {
			validateRequired(pos, 'pos', 'ScaleManager', 'posToVal');
			validateRequired(scaleKey, 'scaleKey', 'ScaleManager', 'posToVal');
			validateType(pos, 'number', 'pos', 'ScaleManager', 'posToVal');
			validateType(scaleKey, 'string', 'scaleKey', 'ScaleManager', 'posToVal');
			
			let sc = this.scales[scaleKey];
			
			if (!sc) {
				throw new UPlotError(
					`Scale '${scaleKey}' not found`,
					'ScaleManager',
					{ method: 'posToVal', scaleKey, type: ERROR_TYPES.VALIDATION }
				);
			}

			let dim, off;

			if (can) {
				let bbox = this.uplot.bbox || {};
				dim = sc.ori == 0 ? bbox.width : bbox.height;
				off = sc.ori == 0 ? bbox.left : bbox.top;
			}
			else {
				let layout = this.uplot.layout || this.uplot;
				dim = sc.ori == 0 ? layout.plotWidCss : layout.plotHgtCss;
				off = sc.ori == 0 ? layout.plotLftCss : layout.plotTopCss;
			}

			if (dim === 0) {
				throw new UPlotError(
					'Cannot convert position to value - plot dimension is zero',
					'ScaleManager',
					{ method: 'posToVal', scaleKey, dimension: dim, type: ERROR_TYPES.SCALE_CALCULATION }
				);
			}

			let pct = (pos - off) / dim;

			if (sc.dir == -1)
				pct = 1 - pct;

			if (sc.ori == 1)
				pct = 1 - pct;

			let { _min, _max } = sc;
			
			if (_min == null || _max == null) {
				throw new UPlotError(
					'Scale not properly initialized - missing min/max values',
					'ScaleManager',
					{ method: 'posToVal', scaleKey, type: ERROR_TYPES.SCALE_CALCULATION }
				);
			}

			let val = _min + (_max - _min) * pct;

			return (
				sc.distr == 3 ? Math.pow(10, val) :
				sc.distr == 4 ? Math.sinh(val) :
				sc.distr == 100 ? (
					typeof sc.inv === 'function' ? sc.inv(val) : 
					(() => {
						throw new UPlotError(
							'Custom scale missing inverse transform function',
							'ScaleManager',
							{ method: 'posToVal', scaleKey, type: ERROR_TYPES.VALIDATION }
						);
					})()
				) :
				val
			);
		}).call(this, pos, scaleKey, can);
	}

	/**
	 * Convert X position to value
	 */
	posToValX(pos, can) {
		return this.posToVal(pos, this.xScaleKey, can);
	}

	/**
	 * Convert Y position to value
	 */
	posToValY(pos, scaleKey, can) {
		return this.posToVal(pos, scaleKey, can);
	}

	/**
	 * Auto-scale X axis
	 */
	autoScaleX() {
		this.viaAutoScaleX = true;

		let _min, _max;

		const data = this.uplot.data || [];
		const scaleX = this.scales[this.xScaleKey];

		if (data.length > 0 && data[0] && data[0].length > 0) {
			// Get data range
			let xData = data[0];
			_min = xData[0];
			_max = xData[xData.length - 1];

			// Apply scale range function
			if (scaleX.range) {
				let range = scaleX.range(this.uplot, _min, _max, scaleX.key);
				if (range) {
					_min = range[0];
					_max = range[1];
				}
			}
		}
		else {
			_min = _max = null;
		}

		this._setScale(this.xScaleKey, _min, _max);
	}

	/**
	 * Set scale with min/max values
	 */
	_setScale(key, min, max) {
		this.setScale(key, {min, max});
	}

	/**
	 * Set scale with options
	 */
	setScale(key, opts) {
		let sc = this.scales[key];

		if (sc != null) {
			// Validate and process options
			if (opts.min != null || opts.max != null) {
				if (opts.min != null && opts.max != null && opts.min > opts.max) {
					// Swap if min > max
					let tmp = opts.min;
					opts.min = opts.max;
					opts.max = tmp;
				}
			}

			// Queue the scale change
			this.pendScales[key] = opts;
			
			// Mark that scales need to be set
			this.uplot.shouldSetScales = true;
		}
	}

	/**
	 * Process pending scale changes
	 */
	setScales() {
		const AUTOSCALE = {min: null, max: null};

		// Add auto scales and unranged scales
		for (let k in this.scales) {
			let sc = this.scales[k];

			if (
				this.pendScales[k] == null && (
					sc.min == null ||
					// or auto scales when the x scale was explicitly set
					this.pendScales[this.xScaleKey] != null && sc.auto(this.uplot, this.viaAutoScaleX)
				)
			) {
				this.pendScales[k] = AUTOSCALE;
			}
		}

		// Handle dependent scales
		for (let k in this.pendScales) {
			let sc = this.scales[k];

			if (this.pendScales[k] == null && sc.from != null && this.pendScales[sc.from] != null) {
				this.pendScales[k] = AUTOSCALE;
			}
		}

		// Process scale changes
		let changed = {};

		for (let k in this.pendScales) {
			let sc = this.scales[k];
			let opts = this.pendScales[k];

			if (opts.min != null || opts.max != null) {
				// Apply the scale change
				if (opts.min != null) {
					sc.min = opts.min;
					sc._min = sc.distr == 3 ? log10(sc.min) : sc.distr == 4 ? asinh(sc.min, sc.asinh) : sc.min;
				}

				if (opts.max != null) {
					sc.max = opts.max;
					sc._max = sc.distr == 3 ? log10(sc.max) : sc.distr == 4 ? asinh(sc.max, sc.asinh) : sc.max;
				}

				changed[k] = true;
			}
		}

		// Clear pending scales
		this.pendScales = {};
		this.viaAutoScaleX = false;

		return changed;
	}

	/**
	 * Get scale by key
	 */
	getScale(key) {
		return this.scales[key];
	}

	/**
	 * Get X scale
	 */
	getXScale() {
		const scale = this.scales[this.xScaleKey];
		if (!scale) {
			console.warn(`X scale not found for key: ${this.xScaleKey}`, this.scales);
		}
		return scale;
	}

	/**
	 * Get all scales
	 */
	getAllScales() {
		return this.scales;
	}

	/**
	 * Check if scale exists
	 */
	hasScale(key) {
		return this.scales[key] != null;
	}

	/**
	 * Update scale options
	 */
	updateScale(key, opts) {
		let sc = this.scales[key];
		if (sc != null) {
			assign(sc, opts);
			// Reinitialize valToPct if needed
			if (opts.distr != null || opts.asinh != null) {
				sc.valToPct = this.initValToPct(sc);
			}
		}
	}
}