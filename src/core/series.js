/**
 * Series Manager - handles series initialization, configuration, data processing, and rendering coordination
 */

import {
	assign,
	fnOrSelf,
	ifNull,
	isStr,
	max,
	retNull,
	clamp,
	roundDec,
	inf,
	EMPTY_OBJ
} from '../utils.js';

import {
	FEAT_TIME,
	FEAT_PATHS,
	FEAT_POINTS
} from '../feats.js';

import {
	xSeriesOpts,
	ySeriesOpts,
	xySeriesOpts,
	timeSeriesVal,
	numSeriesVal,
	timeSeriesLabel,
	numSeriesLabel,
	timeSeriesStamp,
	ptDia
} from '../opts.js';

import { linear } from '../paths/linear.js';
import { points } from '../paths/points.js';
import { seriesFillTo, pxRoundGen } from '../paths/utils.js';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	validateArray,
	safeExecute,
	errorReporter
} from './errors.js';

export class SeriesManager {
	constructor(uplot, scaleManager) {
		try {
			validateRequired(uplot, 'uplot', 'SeriesManager', 'constructor');
			validateRequired(scaleManager, 'scaleManager', 'SeriesManager', 'constructor');
			
			this.uplot = uplot;
			this.scaleManager = scaleManager;
			this.series = [];
			this.mode = uplot.mode || 1;
			
			// Path generators
			this.linearPath = FEAT_PATHS ? linear() : null;
			this.pointsPath = FEAT_POINTS ? points() : null;
			
			// Time formatting functions (will be set during initialization)
			this._tzDate = null;
			this._fmtDate = null;
			this._timeSeriesVal = null;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize series from options
	 */
	initSeries(opts, data) {
		return withErrorBoundary('SeriesManager', 'initSeries', function(opts, data) {
			validateRequired(opts, 'opts', 'SeriesManager', 'initSeries');
			
			const { series: seriesOpts = [], ms = 1e-3 } = opts;
			
			if (!Array.isArray(seriesOpts)) {
				throw new UPlotError(
					'Series options must be an array',
					'SeriesManager',
					{ method: 'initSeries', seriesOptsType: typeof seriesOpts, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			// Set up time formatting functions
			this._tzDate = FEAT_TIME && (opts.tzDate || (ts => new Date(Math.round(ts / ms))));
			this._fmtDate = FEAT_TIME && (opts.fmtDate || ((ts) => ts ? new Date(ts).toISOString() : ''));
			this._timeSeriesVal = FEAT_TIME && timeSeriesVal(this._tzDate, timeSeriesStamp('', this._fmtDate));
			
			// Initialize series array based on mode
			try {
				if (this.mode == 1) {
					// Ensure we have at least x and y series
					const defaultSeries = seriesOpts.length ? seriesOpts : [{}, {}];
					this.series = this.setDefaults(defaultSeries, xSeriesOpts, ySeriesOpts, false);
				} else {
					this.series = this.setDefaults2(seriesOpts.length ? seriesOpts : [null], xySeriesOpts);
				}
			} catch (error) {
				throw new UPlotError(
					`Error setting series defaults: ${error.message}`,
					'SeriesManager',
					{ method: 'initSeries', mode: this.mode, type: ERROR_TYPES.INITIALIZATION },
					error
				);
			}
			
			// Process each series
			this.series.forEach((s, i) => {
				safeExecute('SeriesManager', `processSeriesConfig[${i}]`, () => {
					this.processSeriesConfig(s, i);
				});
			});
			
			// Set reference on uplot instance
			this.uplot.series = this.series;
			
			return this.series;
		}).call(this, opts, data);
	}

	/**
	 * Set defaults for series configuration (mode 1)
	 */
	setDefaults(seriesArray, xOpts, yOpts, initY) {
		let d2 = initY ? [seriesArray[0], seriesArray[1]].concat(seriesArray.slice(2)) : [seriesArray[0]].concat(seriesArray.slice(1));
		return d2.map((o, i) => this.setDefault(o, i, xOpts, yOpts));
	}

	/**
	 * Set defaults for series configuration (mode 2)
	 */
	setDefaults2(seriesArray, xyOpts) {
		return seriesArray.map((o, i) => i == 0 ? {} : assign({}, xyOpts, o));
	}

	/**
	 * Set default values for a single series
	 */
	setDefault(o, i, xOpts, yOpts) {
		return assign({}, (i == 0 ? xOpts : yOpts), o);
	}

	/**
	 * Process series configuration
	 */
	processSeriesConfig(s, i) {
		const { mode, _tzDate, _fmtDate, _timeSeriesVal } = this;
		const { focus, cursor } = this.uplot;
		const pxAlign = +ifNull(this.uplot.opts?.pxAlign, 1);
		
		// Configure value and label functions for time/numeric series
		if (mode == 1 || i > 0) {
			let isTime = FEAT_TIME && mode == 1 && this.scaleManager.scales[s.scale]?.time;
			
			let sv = s.value;
			s.value = isTime ? 
				(isStr(sv) ? timeSeriesVal(_tzDate, timeSeriesStamp(sv, _fmtDate)) : sv || _timeSeriesVal) : 
				sv || numSeriesVal;
			s.label = s.label || (isTime ? timeSeriesLabel : numSeriesLabel);
		}
		
		// Configure rendering properties for non-x-axis series
		const cursorOnePt = focus?.prox >= 0 && cursor?.points?.one;
		if (cursorOnePt || i > 0) {
			s.width = s.width == null ? 1 : s.width;
			s.paths = s.paths || this.linearPath || retNull;
			s.fillTo = fnOrSelf(s.fillTo || seriesFillTo);
			s.pxAlign = +ifNull(s.pxAlign, pxAlign);
			s.pxRound = pxRoundGen(s.pxAlign);
			
			s.stroke = fnOrSelf(s.stroke || null);
			s.fill = fnOrSelf(s.fill || null);
			s._stroke = s._fill = s._paths = s._focus = null;
			
			// Configure points
			let _ptDia = ptDia(max(1, s.width), 1);
			let points = s.points = assign({}, {
				size: _ptDia,
				width: max(1, _ptDia * 0.2),
				stroke: s.stroke,
				space: _ptDia * 2,
				paths: this.pointsPath,
				_stroke: null,
				_fill: null,
			}, s.points);
			
			points.show = fnOrSelf(points.show);
			points.filter = fnOrSelf(points.filter);
			points.fill = fnOrSelf(points.fill);
			points.stroke = fnOrSelf(points.stroke);
			points.paths = fnOrSelf(points.paths);
			points.pxAlign = s.pxAlign;
		}
	}

	/**
	 * Add a new series
	 */
	addSeries(opts, si) {
		try {
			validateRequired(opts, 'opts', 'SeriesManager', 'addSeries');
			
			si = si == null ? this.series.length : si;
			
			if (typeof si !== 'number' || si < 0) {
				throw new UPlotError(
					`Invalid series index ${si}. Must be a non-negative number`,
					'SeriesManager',
					{ method: 'addSeries', seriesIndex: si, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (si > this.series.length) {
				throw new UPlotError(
					`Series index ${si} is out of bounds. Maximum allowed is ${this.series.length}`,
					'SeriesManager',
					{ method: 'addSeries', seriesIndex: si, maxIndex: this.series.length, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			// Apply defaults based on mode
			opts = this.mode == 1 ? 
				this.setDefault(opts, si, xSeriesOpts, ySeriesOpts) : 
				this.setDefault(opts, si, {}, xySeriesOpts);
			
			// Insert series
			this.series.splice(si, 0, opts);
			
			// Process configuration
			this.processSeriesConfig(this.series[si], si);
			
			// Fire event
			if (typeof this.uplot.fire === 'function') {
				this.uplot.fire("addSeries", si);
			}
			
			return si;
		} catch (error) {
			errorReporter.reportError(new UPlotError(
				`Error adding series at index ${si}: ${error.message}`,
				'SeriesManager',
				{ method: 'addSeries', seriesIndex: si, type: ERROR_TYPES.DATA_PROCESSING },
				error
			));
			throw error;
		}
	}

	/**
	 * Remove a series
	 */
	delSeries(i) {
		return withErrorBoundary('SeriesManager', 'delSeries', function(i) {
			validateRequired(i, 'i', 'SeriesManager', 'delSeries');
			validateType(i, 'number', 'i', 'SeriesManager', 'delSeries');
			
			if (i < 0 || i >= this.series.length) {
				throw new UPlotError(
					`Invalid series index ${i}. Must be between 0 and ${this.series.length - 1}`,
					'SeriesManager',
					{ method: 'delSeries', seriesIndex: i, seriesLength: this.series.length, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (i === 0 && this.mode === 1) {
				throw new UPlotError(
					'Cannot delete the x-axis series (index 0) in mode 1',
					'SeriesManager',
					{ method: 'delSeries', seriesIndex: i, mode: this.mode, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			try {
				this.series.splice(i, 1);
				
				// Fire event
				if (typeof this.uplot.fire === 'function') {
					this.uplot.fire("delSeries", i);
				}
			} catch (error) {
				throw new UPlotError(
					`Error removing series at index ${i}: ${error.message}`,
					'SeriesManager',
					{ method: 'delSeries', seriesIndex: i, type: ERROR_TYPES.DATA_PROCESSING },
					error
				);
			}
			
			return i;
		}).call(this, i);
	}

	/**
	 * Update series configuration
	 */
	setSeries(i, opts, _fire, _pub) {
		if (i == null || !this.series[i]) return;
		
		let s = this.series[i];
		
		// Handle focus changes
		if (opts.focus != null) {
			this.setSeriesFocus(i, opts.focus);
		}
		
		// Handle show/hide changes
		if (opts.show != null) {
			this.setSeriesVisibility(i, opts.show);
		}
		
		// Handle alpha changes
		if (opts.alpha != null) {
			this.setSeriesAlpha(i, opts.alpha);
		}
		
		// Apply other options
		assign(s, opts);
		
		// Fire events
		_fire !== false && this.uplot.fire("setSeries", i, opts);
		_pub && this.uplot.pubSync && this.uplot.pubSync("setSeries", this.uplot, i, opts);
	}

	/**
	 * Set series focus state
	 */
	setSeriesFocus(i, focused) {
		if (i == null) {
			// Clear all focus
			this.series.forEach((s, idx) => {
				if (idx > 0) {
					s._focus = null;
				}
			});
		} else if (this.series[i]) {
			this.series[i]._focus = focused;
		}
	}

	/**
	 * Set series visibility
	 */
	setSeriesVisibility(i, show) {
		if (this.series[i]) {
			this.series[i].show = show;
		}
	}

	/**
	 * Set series alpha
	 */
	setSeriesAlpha(i, alpha) {
		if (this.series[i]) {
			this.series[i].alpha = alpha;
		}
	}

	/**
	 * Reset series paths (called when scales change)
	 */
	resetYSeries(minMax) {
		try {
			this.series.forEach((s, i) => {
				if (i > 0) {
					s._paths = null;
					
					if (minMax || s.min == null) {
						s.min = inf;
						s.max = -inf;
					}
				}
			});
		} catch (error) {
			errorReporter.reportError(new UPlotError(
				`Error resetting Y series: ${error.message}`,
				'SeriesManager',
				{ method: 'resetYSeries', type: ERROR_TYPES.DATA_PROCESSING },
				error
			));
			throw error;
		}
	}

	/**
	 * Get outer indices for data rendering optimization
	 */
	getOuterIdxs(ydata, i0, i1, dataLen) {
		let _i0 = clamp(i0 - 1, 0, dataLen - 1);
		let _i1 = clamp(i1 + 1, 0, dataLen - 1);
		
		// Find first non-null value before i0
		while (ydata[_i0] == null && _i0 > 0) {
			_i0--;
		}
		
		// Find first non-null value after i1
		while (ydata[_i1] == null && _i1 < dataLen - 1) {
			_i1++;
		}
		
		return [_i0, _i1];
	}

	/**
	 * Cache stroke and fill styles for a series
	 */
	cacheStrokeFill(si, _points) {
		let s = _points ? this.series[si].points : this.series[si];
		
		s._stroke = s.stroke(this.uplot, si);
		s._fill = s.fill(this.uplot, si);
	}

	/**
	 * Generate paths for a series
	 */
	generateSeriesPaths(si, data, i0, i1, dataLen) {
		let s = this.series[si];
		
		if (!s || si === 0) return null;
		
		let _idxs = this.mode == 2 ? 
			[0, data[si][0].length - 1] : 
			this.getOuterIdxs(data[si], i0, i1, dataLen);
		
		return s.paths(this.uplot, si, _idxs[0], _idxs[1]);
	}

	/**
	 * Check if any series has focus
	 */
	hasFocusedSeries() {
		return this.series.some(s => s._focus);
	}

	/**
	 * Get series by index
	 */
	getSeries(i) {
		return this.series[i];
	}

	/**
	 * Get all series
	 */
	getAllSeries() {
		return this.series;
	}

	/**
	 * Get series count
	 */
	getSeriesCount() {
		return this.series.length;
	}

	/**
	 * Check if series is visible
	 */
	isSeriesVisible(i) {
		return this.series[i]?.show !== false;
	}

	/**
	 * Get visible series indices
	 */
	getVisibleSeriesIndices() {
		return this.series.map((s, i) => s.show !== false ? i : null).filter(i => i !== null);
	}

	/**
	 * Update series paths when scales change
	 */
	updateSeriesForScaleChange(changedScales) {
		this.series.forEach((s, i) => {
			if (i > 0) {
				if (this.mode == 2) {
					if (changedScales.y) {
						s._paths = null;
					}
				} else {
					if (changedScales[s.scale]) {
						s._paths = null;
					}
				}
			}
		});
	}

	/**
	 * Prepare series for drawing
	 */
	prepareSeriesForDraw(data, i0, i1, dataLen) {
		const results = [];
		
		this.series.forEach((s, i) => {
			if (i > 0 && s.show) {
				// Cache stroke and fill
				FEAT_PATHS && this.cacheStrokeFill(i, false);
				FEAT_POINTS && this.cacheStrokeFill(i, true);
				
				// Generate paths if needed
				if (s._paths == null) {
					s._paths = this.generateSeriesPaths(i, data, i0, i1, dataLen);
				}
				
				results.push({
					index: i,
					series: s,
					paths: s._paths,
					points: s.points
				});
			}
		});
		
		return results;
	}

	/**
	 * Get drawing information for a series
	 */
	getSeriesDrawInfo(si, _points) {
		let s = _points ? this.series[si].points : this.series[si];
		
		if (!s || !s._paths) return null;
		
		const { 
			stroke: strokeStyle = s._stroke,
			fill: fillStyle = s._fill,
			width = s.width,
			flags
		} = s._paths;
		
		return {
			strokeStyle,
			fillStyle,
			width: roundDec(width * (this.uplot.pxRatio || 1), 3),
			flags,
			pxAlign: s.pxAlign,
			paths: s._paths
		};
	}
}