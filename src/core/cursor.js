/**
 * Cursor Manager - handles cursor positioning, mouse interactions, and data point highlighting
 */

import {
	CURSOR_X,
	CURSOR_Y,
	CURSOR_PT,
} from '../domClasses';
import {
	addClass,
	elTrans,
	elSize,
	placeDiv,
} from '../dom';
import {
	assign,
	fnOrSelf,
	abs,
	inf,
	ceil,
	round,
	isUndef
} from '../utils';
import {
	WIDTH,
	HEIGHT,
	mousemove,
	mousedown,
	mouseup,
	mouseleave,
	mouseenter,
	dblclick,
} from '../strings';
import { setStylePx } from '../dom';
import { cursorOpts } from '../opts';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	safeExecute,
	errorReporter
} from './errors.js';

export class CursorManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'CursorManager', 'constructor');
			
			this.uplot = uplot;
			
			// Cursor configuration
			this.cursor = null;
			this.showCursor = false;
			this.cursorFocus = false;
			this.cursorOnePt = false;
			
			// Cursor DOM elements
			this.vCursor = null;
			this.hCursor = null;
			this.cursorPts = [];
			this.cursorPtsLft = [];
			this.cursorPtsTop = [];
			
			// Mouse state
			this.mouseLeft1 = -10;
			this.mouseTop1 = -10;
			this.rawMouseLeft1 = -10;
			this.rawMouseTop1 = -10;
			
			// Rect cache
			this.rect = null;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	initCursor(opts, series, activeIdxs, mode, over, focus) {
		this.cursor = assign({}, cursorOpts, {drag: {y: mode == 2}}, opts.cursor);
		this.showCursor = this.cursor.show;
		
		// Initialize cursor properties
		this.cursor.idxs = activeIdxs;
		this.cursor._lock = false;
		
		// Initialize points configuration
		let points = this.cursor.points;
		points.show = fnOrSelf(points.show);
		points.size = fnOrSelf(points.size);
		points.stroke = fnOrSelf(points.stroke);
		points.fill = fnOrSelf(points.fill);
		
		// Initialize focus
		this.cursorFocus = focus.prox >= 0;
		this.cursorOnePt = this.cursorFocus && points.one;
		
		// Initialize cursor DOM elements
		if (this.showCursor) {
			if (this.cursor.x) {
				this.vCursor = placeDiv(CURSOR_X, over);
			}
			
			if (this.cursor.y) {
				this.hCursor = placeDiv(CURSOR_Y, over);
			}
		}
		
		// Initialize data index function if not provided
		if (this.cursor.dataIdx == null) {
			this.cursor.dataIdx = this.createDataIdxFunction();
		}
		
		return this.cursor;
	}

	createDataIdxFunction() {
		return (self, seriesIdx, cursorIdx, valAtPosX) => {
			if (seriesIdx == 0) {
				return cursorIdx;
			}

			let idx2 = cursorIdx;
			let series = self.series;
			let data = self.data;
			let scaleX = self.scales[series[0].scale];
			let plotWidCss = self.plotWidCss;
			let plotHgtCss = self.plotHgtCss;

			let prox = self.series[seriesIdx].prox || (() => 1);
			let _prox = prox(self, seriesIdx, cursorIdx, valAtPosX) ?? inf;
			let withProx = _prox >= 0 && _prox < inf;
			let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss;
			let cursorLft = this.cursor.left;

			let xValues = data[0];
			let yValues = data[seriesIdx];
			let hov = this.cursor.hover;
			let skip = hov.skip = new Set(hov.skip ?? []);

			if (skip.has(yValues[cursorIdx])) {
				idx2 = null;

				let nonNullLft = null;
				let nonNullRgt = null;
				let bias = hov.bias;

				if (bias == 0 || bias == -1) {
					let j = cursorIdx;
					while (nonNullLft == null && j-- > 0) {
						if (!skip.has(yValues[j])) {
							nonNullLft = j;
						}
					}
				}

				if (bias == 0 || bias == 1) {
					let j = cursorIdx;
					while (nonNullRgt == null && j++ < yValues.length) {
						if (!skip.has(yValues[j])) {
							nonNullRgt = j;
						}
					}
				}

				if (nonNullLft != null || nonNullRgt != null) {
					let valToPosX = self.valToPosX;
					let lftPos = nonNullLft == null ? -Infinity : valToPosX(xValues[nonNullLft], scaleX, xDim, 0);
					let rgtPos = nonNullRgt == null ? Infinity : valToPosX(xValues[nonNullRgt], scaleX, xDim, 0);

					let lftDelta = cursorLft - lftPos;
					let rgtDelta = rgtPos - cursorLft;

					if (lftDelta <= rgtDelta) {
						if (nonNullLft != null) {
							idx2 = nonNullLft;
						}
					} else {
						if (nonNullRgt != null) {
							idx2 = nonNullRgt;
						}
					}

					if (idx2 == null) {
						idx2 = nonNullRgt == null ? nonNullLft :
							nonNullLft == null ? nonNullRgt :
							cursorIdx - nonNullLft <= nonNullRgt - cursorIdx ? nonNullLft : nonNullRgt;
					}
				}
			} else if (withProx) {
				let valToPosX = self.valToPosX;
				let dist = abs(cursorLft - valToPosX(xValues[cursorIdx], scaleX, xDim, 0));

				if (dist > _prox) {
					idx2 = null;
				}
			}

			return idx2;
		};
	}

	initCursorPt(s, si, over, plotWidCss, plotHgtCss) {
		let pt = this.cursor.points.show(this.uplot, si);

		if (pt) {
			addClass(pt, CURSOR_PT);
			addClass(pt, s.class);
			elTrans(pt, -10, -10, plotWidCss, plotHgtCss);
			over.insertBefore(pt, this.cursorPts[si]);
		}

		return pt;
	}

	addCursorPt(s, i, over, plotWidCss, plotHgtCss) {
		if (!this.showCursor || !this.cursor || !this.cursor.points) return;
		
		let pt = null;

		if (this.cursor.points.show(this.uplot, i)) {
			pt = this.initCursorPt(s, i, over, plotWidCss, plotHgtCss);
		}

		this.cursorPts.splice(i, 0, pt);
		this.cursorPtsLft.splice(i, 0, 0);
		this.cursorPtsTop.splice(i, 0, 0);
	}

	removeCursorPt(i) {
		if (!this.showCursor) return;
		
		let pt = this.cursorPts.splice(i, 1)[0];
		if (pt) {
			pt.remove();
		}
		this.cursorPtsLft.splice(i, 1);
		this.cursorPtsTop.splice(i, 1);
	}

	setCursor(opts, _fire, _pub) {
		return withErrorBoundary('CursorManager', 'setCursor', function(opts, _fire, _pub) {
			validateRequired(opts, 'opts', 'CursorManager', 'setCursor');
			
			if (typeof opts.left !== 'number' || typeof opts.top !== 'number') {
				throw new UPlotError(
					'setCursor requires opts.left and opts.top to be numbers',
					'CursorManager',
					{ method: 'setCursor', opts, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			this.mouseLeft1 = opts.left;
			this.mouseTop1 = opts.top;
			this.updateCursor(null, _fire, _pub);
		}).call(this, opts, _fire, _pub);
	}

	setCursorEvent(e) {
		this.cursor.event = e;
	}

	updateCursor(src, _fire, _pub) {
		return withErrorBoundary('CursorManager', 'updateCursor', function(src, _fire, _pub) {
			if (!this.cursor) {
				throw new UPlotError(
					'Cursor not initialized - call initCursor first',
					'CursorManager',
					{ method: 'updateCursor', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			this.rawMouseLeft1 = this.mouseLeft1;
			this.rawMouseTop1 = this.mouseTop1;

			if (typeof this.cursor.move === 'function') {
				try {
					[this.mouseLeft1, this.mouseTop1] = this.cursor.move(this.uplot, this.mouseLeft1, this.mouseTop1);
				} catch (error) {
					throw new UPlotError(
						`Error in cursor move function: ${error.message}`,
						'CursorManager',
						{ method: 'updateCursor', type: ERROR_TYPES.EVENT_HANDLING },
						error
					);
				}
			}

			this.cursor.left = this.mouseLeft1;
			this.cursor.top = this.mouseTop1;

			if (this.showCursor) {
				// Update cursor lines
				if (this.vCursor) {
					safeExecute('CursorManager', 'updateCursor.vCursor', () => {
						elTrans(this.vCursor, round(this.cursor.left), 0, this.uplot.plotWidCss, this.uplot.plotHgtCss);
					});
				}
				if (this.hCursor) {
					safeExecute('CursorManager', 'updateCursor.hCursor', () => {
						elTrans(this.hCursor, 0, round(this.cursor.top), this.uplot.plotWidCss, this.uplot.plotHgtCss);
					});
				}

				// Hide all cursor points initially
				if (this.uplot.series && Array.isArray(this.uplot.series)) {
					for (let i = 0; i < this.uplot.series.length; i++) {
						let pt = this.cursorPts[i];
						if (pt != null) {
							safeExecute('CursorManager', 'updateCursor.hidePt', () => {
								elTrans(pt, -10, -10, this.uplot.plotWidCss, this.uplot.plotHgtCss);
							});
						}
					}
				}
			}

			// Update cursor data indices and positions
			safeExecute('CursorManager', 'updateCursor.updatePoints', () => {
				this.updateCursorPoints();
			});

			if (_fire !== false && typeof this.uplot.fire === 'function') {
				safeExecute('CursorManager', 'updateCursor.fire', () => {
					this.uplot.fire("setCursor");
				});
			}
		}).call(this, src, _fire, _pub);
	}

	updateCursorPoints() {
		if (!this.showCursor) return;

		let series = this.uplot.series;
		let data = this.uplot.data;
		let activeIdxs = this.uplot.activeIdxs;

		// Find closest data point for each series
		for (let i = 0; i < series.length; i++) {
			let s = series[i];
			
			if (i == 0 || !s.show) continue;

			let idx = activeIdxs[i];
			if (idx == null) continue;

			let src = data[i];
			if (!src || idx >= src.length) continue;

			// Calculate point position
			let scaleX = this.uplot.scales[series[0].scale];
			let scaleY = this.uplot.scales[s.scale];
			
			if (!scaleX || !scaleY) continue;

			let xVal = data[0][idx];
			let yVal = src[idx];

			if (xVal == null || yVal == null) continue;

			let ptLft = this.uplot.valToPosX(xVal, scaleX, this.uplot.plotWidCss, 0);
			let ptTop = this.uplot.valToPosY(yVal, scaleY, this.uplot.plotHgtCss, 0);

			let pt = this.cursorOnePt ? this.cursorPts[0] : this.cursorPts[i];

			if (pt != null) {
				this.cursorPtsLft[i] = ptLft;
				this.cursorPtsTop[i] = ptTop;

				let ptWid = this.cursor.points.size(this.uplot, i);
				let ptHgt = ptWid;
				let centered = true;

				elSize(pt, ptWid, ptHgt, centered);
				elTrans(pt, ceil(ptLft), ceil(ptTop), this.uplot.plotWidCss, this.uplot.plotHgtCss);

				// Update point styling
				pt.style.borderColor = this.cursor.points.stroke(this.uplot, i);
				pt.style.backgroundColor = this.cursor.points.fill(this.uplot, i);
			}
		}
	}

	syncRect(defer = false) {
		if (defer) {
			this.rect = null;
		} else {
			this.rect = this.uplot.over.getBoundingClientRect();
			this.uplot.fire("syncRect", this.rect);
		}
	}

	getRect() {
		if (this.rect == null) {
			this.syncRect(false);
		}
		return this.rect;
	}

	cacheMouse(e, src, _l, _t, _w, _h, _i, initial, snap) {
		if (this.rect == null) {
			this.syncRect(false);
		}

		this.setCursorEvent(e);

		if (e != null) {
			this.updateCursor(null, true, true);
		} else {
			this.updateCursor(src, true, false);
		}
	}

	setSeriesOpacity(i, value) {
		if (this.showCursor && this.cursorPts[i] != null) {
			this.cursorPts[i].style.opacity = value;
		}
	}

	scaleCursor(pctWid, pctHgt) {
		if (this.showCursor && !this.uplot.shouldSetCursor && this.cursor.left >= 0) {
			this.cursor.left *= pctWid;
			this.cursor.top *= pctHgt;

			this.vCursor && elTrans(this.vCursor, round(this.cursor.left), 0, this.uplot.plotWidCss, this.uplot.plotHgtCss);
			this.hCursor && elTrans(this.hCursor, 0, round(this.cursor.top), this.uplot.plotWidCss, this.uplot.plotHgtCss);

			for (let i = 0; i < this.cursorPts.length; i++) {
				let pt = this.cursorPts[i];

				if (pt != null) {
					this.cursorPtsLft[i] *= pctWid;
					this.cursorPtsTop[i] *= pctHgt;
					elTrans(pt, ceil(this.cursorPtsLft[i]), ceil(this.cursorPtsTop[i]), this.uplot.plotWidCss, this.uplot.plotHgtCss);
				}
			}
		}
	}

	destroy() {
		// Clean up DOM elements
		if (this.vCursor) {
			this.vCursor.remove();
		}
		if (this.hCursor) {
			this.hCursor.remove();
		}
		
		for (let pt of this.cursorPts) {
			if (pt) {
				pt.remove();
			}
		}
		
		// Reset state
		this.cursorPts = [];
		this.cursorPtsLft = [];
		this.cursorPtsTop = [];
		this.cursor = null;
		this.rect = null;
	}

	/**
	 * Move cursor to specified position
	 */
	move(uplot, left, top) {
		// Default implementation - just return the coordinates
		// This can be overridden by cursor configuration
		return [left, top];
	}
}