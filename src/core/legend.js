/**
 * Legend Manager - handles legend rendering, management, and interactions
 */

import { FEAT_LEGEND } from '../feats';
import { 
	LEGEND_DISP 
} from '../strings';
import {
	LEGEND,
	LEGEND_SERIES,
	LEGEND_MARKER,
	LEGEND_LABEL,
	LEGEND_VALUE,
	OFF
} from '../domClasses';
import {
	addClass,
	remClass,
	placeTag,
	placeDiv,
	on,
	off
} from '../dom';
import {
	assign,
	fnOrSelf,
	isUndef
} from '../utils';
import { legendOpts } from '../opts';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	safeExecute,
	errorReporter
} from './errors.js';

export class LegendManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'LegendManager', 'constructor');
			
			this.uplot = uplot;
			
			// Legend configuration
			this.legend = null;
			this.showLegend = false;
			this.markers = null;
			
			// Legend DOM elements
			this.legendTable = null;
			this.legendHead = null;
			this.legendBody = null;
			this.legendRows = [];
			this.legendCells = [];
			this.legendCols = null;
			this.multiValLegend = false;
			this.NULL_LEGEND_VALUES = {};
			
			// Mouse event listeners tracking
			this.mouseListeners = new Map();
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	initLegend(opts, series, activeIdxs, mode, root, cursor, syncOpts) {
		return withErrorBoundary('LegendManager', 'initLegend', function(opts, series, activeIdxs, mode, root, cursor, syncOpts) {
			if (!FEAT_LEGEND) return undefined;
			
			validateRequired(opts, 'opts', 'LegendManager', 'initLegend');
			validateRequired(series, 'series', 'LegendManager', 'initLegend');
			validateRequired(activeIdxs, 'activeIdxs', 'LegendManager', 'initLegend');
			validateRequired(root, 'root', 'LegendManager', 'initLegend');
			
			if (!Array.isArray(series)) {
				throw new UPlotError(
					'Series must be an array',
					'LegendManager',
					{ method: 'initLegend', seriesType: typeof series, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (!Array.isArray(activeIdxs)) {
				throw new UPlotError(
					'ActiveIdxs must be an array',
					'LegendManager',
					{ method: 'initLegend', activeIdxsType: typeof activeIdxs, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			try {
				this.legend = assign({}, legendOpts, opts.legend);
				this.showLegend = this.legend.show;
				this.markers = this.legend.markers;
				
				if (this.legend) {
					this.legend.idxs = activeIdxs;
					this.markers.width = fnOrSelf(this.markers.width);
					this.markers.stroke = fnOrSelf(this.markers.stroke);
					this.markers.fill = fnOrSelf(this.markers.fill);
					this.markers.dash = fnOrSelf(this.markers.dash);
				}
				
				// Initialize multi-value legend support
				if (this.legend.live) {
					const getMultiVals = series[1] ? series[1].values : null;
					this.multiValLegend = getMultiVals != null;
					this.legendCols = this.multiValLegend ? getMultiVals(this.uplot, 1, 0) : {_: 0};
					
					for (let k in this.legendCols) {
						this.NULL_LEGEND_VALUES[k] = LEGEND_DISP;
					}
				}
				
				// Create legend DOM structure
				if (this.showLegend) {
					this.legendTable = placeTag("table", LEGEND, root);
					this.legendBody = placeTag("tbody", null, this.legendTable);
					
					// Allow legend to be moved out of root
					if (typeof this.legend.mount === 'function') {
						this.legend.mount(this.uplot, this.legendTable);
					}
					
					if (this.multiValLegend) {
						this.legendHead = placeTag("thead", null, this.legendTable, this.legendBody);
					}
				}
				
				// Initialize legend values array
				this.legend.values = [];
			} catch (error) {
				throw new UPlotError(
					`Error initializing legend: ${error.message}`,
					'LegendManager',
					{ method: 'initLegend', type: ERROR_TYPES.INITIALIZATION },
					error
				);
			}
			
			return this.legend;
		}).call(this, opts, series, activeIdxs, mode, root, cursor, syncOpts);
	}

	initLegendRow(s, i, series, mode, cursor, syncOpts) {
		if (i == 0 && (this.multiValLegend || !this.legend.live || mode == 2)) {
			return [null, null];
		}

		let cells = [];
		let row = placeTag("tr", LEGEND_SERIES, this.legendBody, this.legendBody.childNodes[i]);

		addClass(row, s.class);

		if (!s.show) {
			addClass(row, OFF);
		}

		let label = placeTag("th", null, row);

		// Add marker if enabled
		if (this.markers.show) {
			let indic = placeDiv(LEGEND_MARKER, label);

			if (i > 0) {
				let width = this.markers.width(this.uplot, i);

				if (width) {
					indic.style.border = width + "px " + this.markers.dash(this.uplot, i) + " " + this.markers.stroke(this.uplot, i);
				}

				indic.style.background = this.markers.fill(this.uplot, i);
			}
		}

		// Add label
		let text = placeDiv(LEGEND_LABEL, label);

		if (s.label instanceof HTMLElement) {
			text.appendChild(s.label);
		} else {
			text.textContent = s.label;
		}

		// Add click handler for series toggle
		if (i > 0) {
			if (!this.markers.show) {
				text.style.color = s.width > 0 ? this.markers.stroke(this.uplot, i) : this.markers.fill(this.uplot, i);
			}

			this.onMouse("click", label, e => {
				if (cursor._lock) return;

				this.uplot.setCursorEvent(e);

				let seriesIdx = series.indexOf(s);

				if ((e.ctrlKey || e.metaKey) != this.legend.isolate) {
					// if any other series is shown, isolate this one. else show all
					let isolate = series.some((s, i) => i > 0 && i != seriesIdx && s.show);

					series.forEach((s, i) => {
						i > 0 && this.uplot.setSeries(i, isolate ? (i == seriesIdx ? {show: true} : {show: false}) : {show: true}, true, syncOpts.setSeries);
					});
				} else {
					this.uplot.setSeries(seriesIdx, {show: !s.show}, true, syncOpts.setSeries);
				}
			}, false);

			// Add hover handler for cursor focus
			if (cursor.focus) {
				this.onMouse("mouseenter", label, e => {
					if (cursor._lock) return;

					this.uplot.setCursorEvent(e);
					this.uplot.setSeries(series.indexOf(s), {focus: true}, true, syncOpts.setSeries);
				}, false);
			}
		}

		// Add value cells
		for (var key in this.legendCols) {
			let v = placeTag("td", LEGEND_VALUE, row);
			v.textContent = "--";
			cells.push(v);
		}

		return [row, cells];
	}

	addLegendRow(s, i, series, mode, cursor, syncOpts) {
		if (!this.showLegend) return;
		
		let rowCells = this.initLegendRow(s, i, series, mode, cursor, syncOpts);
		this.legendRows.splice(i, 0, rowCells[0]);
		this.legendCells.splice(i, 0, rowCells[1]);
		this.legend.values.push(null);
	}

	removeLegendRow(i) {
		if (!this.showLegend) return;
		
		this.legend.values.splice(i, 1);
		this.legendCells.splice(i, 1);
		let tr = this.legendRows.splice(i, 1)[0];
		
		if (tr) {
			this.offMouse(null, tr.firstChild);
			tr.remove();
		}
	}

	setLegend(opts, _fire) {
		if (opts != null) {
			if (opts.idxs) {
				opts.idxs.forEach((didx, sidx) => {
					this.uplot.activeIdxs[sidx] = didx;
				});
			} else if (!isUndef(opts.idx)) {
				this.uplot.activeIdxs.fill(opts.idx);
			}

			this.legend.idx = this.uplot.activeIdxs[0];
		}

		if (this.showLegend && this.legend.live) {
			for (let sidx = 0; sidx < this.uplot.series.length; sidx++) {
				if (sidx > 0 || this.uplot.mode == 1 && !this.multiValLegend) {
					this.setLegendValues(sidx, this.uplot.activeIdxs[sidx]);
				}
			}

			this.syncLegend();
		}

		this.uplot.shouldSetLegend = false;

		_fire !== false && this.uplot.fire("setLegend");
	}

	setLegendValues(sidx, idx) {
		let s = this.uplot.series[sidx];
		let src = sidx == 0 && this.uplot.xScaleDistr == 2 ? this.uplot.data0 : this.uplot.data[sidx];
		let val;

		if (this.multiValLegend) {
			val = s.values(this.uplot, sidx, idx) ?? this.NULL_LEGEND_VALUES;
		} else {
			val = s.value(this.uplot, idx == null ? null : src[idx], sidx, idx);
			val = val == null ? this.NULL_LEGEND_VALUES : {_: val};
		}

		this.legend.values[sidx] = val;
	}

	syncLegend() {
		if (this.showLegend && this.legend.live) {
			for (let i = this.uplot.mode == 2 ? 1 : 0; i < this.uplot.series.length; i++) {
				if (i == 0 && this.multiValLegend) continue;

				let vals = this.legend.values[i];

				let j = 0;
				for (let k in vals) {
					if (this.legendCells[i] && this.legendCells[i][j]) {
						this.legendCells[i][j].firstChild.nodeValue = vals[k];
					}
					j++;
				}
			}
		}
	}

	updateSeriesLegend(i, s) {
		if (!this.showLegend || !this.legendRows[i]) return;
		
		if (s.show) {
			remClass(this.legendRows[i], OFF);
		} else {
			addClass(this.legendRows[i], OFF);
		}
	}

	setSeriesOpacity(i, value) {
		if (FEAT_LEGEND && this.showLegend && this.legendRows[i]) {
			this.legendRows[i].style.opacity = value;
		}
	}

	onMouse(ev, targ, fn, onlyTarg = true) {
		const targListeners = this.mouseListeners.get(targ) || {};
		const listener = this.uplot.cursor.bind && this.uplot.cursor.bind[ev] ? 
			this.uplot.cursor.bind[ev](this.uplot, targ, fn, onlyTarg) : null;

		if (listener) {
			on(ev, targ, targListeners[ev] = listener);
			this.mouseListeners.set(targ, targListeners);
		}
	}

	offMouse(ev, targ, fn) {
		const targListeners = this.mouseListeners.get(targ) || {};

		for (let k in targListeners) {
			if (ev == null || k == ev) {
				off(k, targ, targListeners[k]);
				delete targListeners[k];
			}
		}

		if (ev == null) {
			this.mouseListeners.delete(targ);
		}
	}

	destroy() {
		// Clean up event listeners
		for (let [targ, listeners] of this.mouseListeners) {
			this.offMouse(null, targ);
		}
		this.mouseListeners.clear();
		
		// Clean up DOM elements
		if (this.legendTable) {
			this.legendTable.remove();
		}
		
		// Reset state
		this.legendRows = [];
		this.legendCells = [];
		this.legend = null;
	}
}