import {
	transparent,
} from '../strings';

import {
	EMPTY_ARR,
	roundDec,
	round,
	incrRound,
} from '../utils.js';

import { pxRoundGen } from '../paths/utils.js';

import {
	TOP,
	BOTTOM,
	LEFT,
	RIGHT,
} from '../strings.js';

import {
	BAND_CLIP_FILL,
	BAND_CLIP_STROKE,
} from '../paths/utils';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	safeExecute,
	errorReporter
} from './errors.js';



/**
 * Renderer class handles all canvas drawing operations and rendering optimization
 */
export class Renderer {
	constructor(uplot, layoutManager) {
		try {
			validateRequired(uplot, 'uplot', 'Renderer', 'constructor');
			validateRequired(layoutManager, 'layoutManager', 'Renderer', 'constructor');
			
			if (!uplot.ctx) {
				throw new UPlotError(
					'uPlot instance missing canvas context',
					'Renderer',
					{ method: 'constructor', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			this.u = uplot;
			this.layoutManager = layoutManager;
			this.ctx = uplot.ctx;
			this.can = uplot.can;
			
			// Canvas context style cache for optimization
			this.ctxStroke = null;
			this.ctxFill = null;
			this.ctxWidth = null;
			this.ctxDash = null;
			this.ctxJoin = null;
			this.ctxCap = null;
			this.ctxFont = null;
			this.ctxAlign = null;
			this.ctxBaseline = null;
			this.ctxAlpha = 1;
			
			// Drawing order configuration
			this.drawOrderMap = {
				axes: () => this.drawAxesGrid(),
				series: () => this.drawSeries(),
			};
			
			const drawOrderOpts = uplot.opts?.drawOrder || ["axes", "series"];
			if (!Array.isArray(drawOrderOpts)) {
				throw new UPlotError(
					'drawOrder option must be an array',
					'Renderer',
					{ method: 'constructor', drawOrderType: typeof drawOrderOpts, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			this.drawOrder = drawOrderOpts.map(key => {
				if (!this.drawOrderMap[key]) {
					throw new UPlotError(
						`Invalid draw order key: ${key}. Valid keys are: ${Object.keys(this.drawOrderMap).join(', ')}`,
						'Renderer',
						{ method: 'constructor', invalidKey: key, type: ERROR_TYPES.VALIDATION }
					);
				}
				return this.drawOrderMap[key];
			});
			
			// Constants for band clipping
			this.CLIP_FILL_STROKE = BAND_CLIP_FILL | BAND_CLIP_STROKE;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize canvas with proper dimensions and pixel ratio
	 */
	initCanvas(opts) {
		return withErrorBoundary('Renderer', 'initCanvas', function(opts) {
			const { pxRatio } = this.u;
			const { fullWidCss, fullHgtCss } = this.layoutManager;
			
			if (typeof pxRatio !== 'number' || pxRatio <= 0) {
				throw new UPlotError(
					`Invalid pixel ratio: ${pxRatio}. Must be a positive number`,
					'Renderer',
					{ method: 'initCanvas', pxRatio, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (typeof fullWidCss !== 'number' || typeof fullHgtCss !== 'number') {
				throw new UPlotError(
					`Invalid canvas dimensions: width=${fullWidCss}, height=${fullHgtCss}. Both must be numbers`,
					'Renderer',
					{ method: 'initCanvas', fullWidCss, fullHgtCss, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			if (fullWidCss <= 0 || fullHgtCss <= 0) {
				throw new UPlotError(
					`Invalid canvas dimensions: width=${fullWidCss}, height=${fullHgtCss}. Both must be positive`,
					'Renderer',
					{ method: 'initCanvas', fullWidCss, fullHgtCss, type: ERROR_TYPES.VALIDATION }
				);
			}
			
			try {
				// Set canvas dimensions
				this.can.width = round(fullWidCss * pxRatio);
				this.can.height = round(fullHgtCss * pxRatio);
				
				// Set CSS dimensions
				this.can.style.width = fullWidCss + 'px';
				this.can.style.height = fullHgtCss + 'px';
				
				// Invalidate context style cache
				this.invalidateStyleCache();
			} catch (error) {
				throw new UPlotError(
					`Error initializing canvas: ${error.message}`,
					'Renderer',
					{ method: 'initCanvas', fullWidCss, fullHgtCss, pxRatio, type: ERROR_TYPES.RENDERING },
					error
				);
			}
		}).call(this, opts);
	}

	/**
	 * Main draw function that orchestrates all rendering
	 */
	draw() {
		return withErrorBoundary('Renderer', 'draw', function() {
			const { fullWidCss, fullHgtCss } = this.layoutManager;
			
			if (fullWidCss > 0 && fullHgtCss > 0) {
				try {
					this.clear();
					
					if (typeof this.u.fire === 'function') {
						this.u.fire("drawClear");
					}
					
					this.drawOrder.forEach((fn, index) => {
						safeExecute('Renderer', `drawOrder[${index}]`, fn);
					});
					
					if (typeof this.u.fire === 'function') {
						this.u.fire("draw");
					}
				} catch (error) {
					throw new UPlotError(
						`Error during rendering: ${error.message}`,
						'Renderer',
						{ method: 'draw', fullWidCss, fullHgtCss, type: ERROR_TYPES.RENDERING },
						error
					);
				}
			}
		}).call(this);
	}

	/**
	 * Clear the entire canvas
	 */
	clear() {
		return withErrorBoundary('Renderer', 'clear', function() {
			if (!this.ctx) {
				throw new UPlotError(
					'Canvas context not available',
					'Renderer',
					{ method: 'clear', type: ERROR_TYPES.RENDERING }
				);
			}
			
			try {
				this.ctx.clearRect(0, 0, this.can.width, this.can.height);
			} catch (error) {
				throw new UPlotError(
					`Error clearing canvas: ${error.message}`,
					'Renderer',
					{ method: 'clear', canvasWidth: this.can.width, canvasHeight: this.can.height, type: ERROR_TYPES.RENDERING },
					error
				);
			}
		}).call(this);
	}

	/**
	 * Draw all series paths and points
	 */
	drawSeries() {
		const { series, data, focus, mode } = this.u;
		const dataLen = data[0]?.length || 0;
		
		if (dataLen > 0) {
			let shouldAlpha = series.some(s => s._focus) && this.ctxAlpha != focus.alpha;

			if (shouldAlpha) {
				this.ctx.globalAlpha = this.ctxAlpha = focus.alpha;
			}

			// First pass: generate paths
			series.forEach((s, i) => {
				if (i > 0 && s.show) {
					this.cacheStrokeFill(i, false); // cache series stroke/fill
					this.cacheStrokeFill(i, true);  // cache points stroke/fill

					if (s._paths == null) {
						let _ctxAlpha = this.ctxAlpha;

						if (this.ctxAlpha != s.alpha) {
							this.ctx.globalAlpha = this.ctxAlpha = s.alpha;
						}

						let _idxs = mode == 2 ? [0, data[i][0].length - 1] : this.getOuterIdxs(data[i]);
						s._paths = s.paths(this.u, i, _idxs[0], _idxs[1]);

						if (this.ctxAlpha != _ctxAlpha) {
							this.ctx.globalAlpha = this.ctxAlpha = _ctxAlpha;
						}
					}
				}
			});

			// Second pass: draw paths and points
			series.forEach((s, i) => {
				if (i > 0 && s.show) {
					let _ctxAlpha = this.ctxAlpha;

					if (this.ctxAlpha != s.alpha) {
						this.ctx.globalAlpha = this.ctxAlpha = s.alpha;
					}

					// Draw series paths
					if (s._paths != null) {
						this.drawPath(i, false);
					}

					// Draw points
					if (s.points) {
						let _gaps = s._paths != null ? s._paths.gaps : null;
						let show = s.points.show(this.u, i, this.u.i0, this.u.i1, _gaps);
						let idxs = s.points.filter(this.u, i, show, _gaps);

						if (show || idxs) {
							s.points._paths = s.points.paths(this.u, i, this.u.i0, this.u.i1, idxs);
							this.drawPath(i, true);
						}
					}

					if (this.ctxAlpha != _ctxAlpha) {
						this.ctx.globalAlpha = this.ctxAlpha = _ctxAlpha;
					}

					this.u.fire("drawSeries", i);
				}
			});

			if (shouldAlpha) {
				this.ctx.globalAlpha = this.ctxAlpha = 1;
			}
		}
	}

	/**
	 * Draw axes grid, ticks, and labels
	 */
	drawAxesGrid() {
		const { axes, scales, data, plotLft, plotTop, plotWid, plotHgt, pxRatio } = this.u;
		const data0 = data[0];
		
		for (let i = 0; i < axes.length; i++) {
			let axis = axes[i];

			if (!axis.show || !axis._show) {
				continue;
			}

			let side = axis.side;
			let ori = side % 2;
			let x, y;
			let fillStyle = axis.stroke(this.u, i);
			let shiftDir = side == 0 || side == 3 ? -1 : 1;
			let [_incr, _space] = axis._found;

			// Draw axis label
			if (axis.label != null) {
				this.drawAxisLabel(axis, i, ori, side, fillStyle, shiftDir, _incr, _space);
			}

			if (_space == 0) {
				continue;
			}

			let scale = scales[axis.scale];
			let plotDim = ori == 0 ? plotWid : plotHgt;
			let plotOff = ori == 0 ? plotLft : plotTop;
			let _splits = axis._splits;

			// Prepare tick data
			let splits = scale.distr == 2 ? _splits.map(i => data0[i]) : _splits;
			let incr = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;

			let ticks = axis.ticks;
			let border = axis.border;
			let _tickSize = ticks.show ? ticks.size : 0;
			let tickSize = round(_tickSize * pxRatio);
			let axisGap = round((axis.alignTo == 2 ? axis._size - _tickSize - axis.gap : axis.gap) * pxRatio);

			let basePos = this.u.pxRound(axis._pos * pxRatio);
			let canOffs = _splits.map(val => this.u.pxRound(this.u.getPos(val, scale, plotDim, plotOff)));

			// Draw tick labels
			this.drawTickLabels(axis, i, ori, side, basePos, tickSize, axisGap, shiftDir, canOffs, fillStyle);

			// Draw ticks
			if (ticks.show) {
				this.drawOrthoLines(
					canOffs,
					ticks.filter(this.u, splits, i, _space, incr),
					ori,
					side,
					basePos,
					tickSize,
					roundDec(ticks.width * pxRatio, 3),
					ticks.stroke(this.u, i),
					ticks.dash,
					ticks.cap,
				);
			}

			// Draw grid
			let grid = axis.grid;
			if (grid.show) {
				this.drawOrthoLines(
					canOffs,
					grid.filter(this.u, splits, i, _space, incr),
					ori,
					ori == 0 ? 2 : 1,
					ori == 0 ? plotTop : plotLft,
					ori == 0 ? plotHgt : plotWid,
					roundDec(grid.width * pxRatio, 3),
					grid.stroke(this.u, i),
					grid.dash,
					grid.cap,
				);
			}

			// Draw border
			if (border.show) {
				this.drawOrthoLines(
					[basePos],
					[1],
					ori == 0 ? 1 : 0,
					ori == 0 ? 1 : 2,
					ori == 1 ? plotTop : plotLft,
					ori == 1 ? plotHgt : plotWid,
					roundDec(border.width * pxRatio, 3),
					border.stroke(this.u, i),
					border.dash,
					border.cap,
				);
			}
		}

		this.u.fire("drawAxes");
	}

	/**
	 * Draw axis label
	 */
	drawAxisLabel(axis, i, ori, side, fillStyle, shiftDir, _incr, _space) {
		const { plotLft, plotTop, plotWid, plotHgt, pxRatio, isFn, PI } = this.u;
		
		let shiftAmt = axis.labelGap * shiftDir;
		let baseLpos = round((axis._lpos + shiftAmt) * pxRatio);

		this.setFontStyle(axis.labelFont[0], fillStyle, "center", side == 2 ? TOP : BOTTOM);

		this.ctx.save();

		let x, y;
		if (ori == 1) {
			x = y = 0;
			this.ctx.translate(baseLpos, round(plotTop + plotHgt / 2));
			this.ctx.rotate((side == 3 ? -PI : PI) / 2);
		} else {
			x = round(plotLft + plotWid / 2);
			y = baseLpos;
		}

		let _label = isFn(axis.label) ? axis.label(this.u, i, _incr, _space) : axis.label;
		this.ctx.fillText(_label, x, y);
		this.ctx.restore();
	}

	/**
	 * Draw tick labels
	 */
	drawTickLabels(axis, i, ori, side, basePos, tickSize, axisGap, shiftDir, canOffs, fillStyle) {
		const { PI } = this.u;
		
		let angle = axis._rotate * -PI / 180;
		let shiftAmt = (tickSize + axisGap) * shiftDir;
		let finalPos = basePos + shiftAmt;
		let y = ori == 0 ? finalPos : 0;
		let x = ori == 1 ? finalPos : 0;

		let font = axis.font[0];
		let textAlign = axis.align == 1 ? LEFT :
			axis.align == 2 ? RIGHT :
			angle > 0 ? LEFT :
			angle < 0 ? RIGHT :
			ori == 0 ? "center" : side == 3 ? RIGHT : LEFT;
		let textBaseline = angle ||
			ori == 1 ? "middle" : side == 2 ? TOP : BOTTOM;

		this.setFontStyle(font, fillStyle, textAlign, textBaseline);

		let lineHeight = axis.font[1] * axis.lineGap;
		let _values = axis._values;

		for (let i = 0; i < _values.length; i++) {
			let val = _values[i];

			if (val != null) {
				if (ori == 0) {
					x = canOffs[i];
				} else {
					y = canOffs[i];
				}

				val = "" + val;
				let _parts = val.indexOf("\n") == -1 ? [val] : val.split(/\n/gm);

				for (let j = 0; j < _parts.length; j++) {
					let text = _parts[j];

					if (angle) {
						this.ctx.save();
						this.ctx.translate(x, y + j * lineHeight);
						this.ctx.rotate(angle);
						this.ctx.fillText(text, 0, 0);
						this.ctx.restore();
					} else {
						this.ctx.fillText(text, x, y + j * lineHeight);
					}
				}
			}
		}
	}

	/**
	 * Cache stroke and fill styles for series or points
	 */
	cacheStrokeFill(si, _points) {
		const { series } = this.u;
		let s = _points ? series[si].points : series[si];

		s._stroke = s.stroke(this.u, si);
		s._fill = s.fill(this.u, si);
	}

	/**
	 * Draw a path for series or points
	 */
	drawPath(si, _points) {
		const { series, bands, plotLft, plotTop, plotWid, plotHgt, pxRatio } = this.u;
		let s = _points ? series[si].points : series[si];

		let {
			stroke,
			fill,
			clip: gapsClip,
			flags,
			_stroke: strokeStyle = s._stroke,
			_fill: fillStyle = s._fill,
			_width: width = s.width,
		} = s._paths;

		width = roundDec(width * pxRatio, 3);

		let boundsClip = null;
		let offset = (width % 2) / 2;

		if (_points && fillStyle == null) {
			fillStyle = width > 0 ? "#fff" : strokeStyle;
		}

		let _pxAlign = s.pxAlign == 1 && offset > 0;

		if (_pxAlign) {
			this.ctx.translate(offset, offset);
		}

		if (!_points) {
			let lft = plotLft - width / 2,
				top = plotTop - width / 2,
				wid = plotWid + width,
				hgt = plotHgt + width;

			boundsClip = new Path2D();
			boundsClip.rect(lft, top, wid, hgt);
		}

		// Draw points or series with bands
		if (_points) {
			this.strokeFill(strokeStyle, width, s.dash, s.cap, fillStyle, stroke, fill, flags, gapsClip);
		} else {
			this.fillStroke(si, strokeStyle, width, s.dash, s.cap, fillStyle, stroke, fill, flags, boundsClip, gapsClip);
		}

		if (_pxAlign) {
			this.ctx.translate(-offset, -offset);
		}
	}

	/**
	 * Handle fill and stroke operations with band support
	 */
	fillStroke(si, strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip) {
		const { bands, series, data, hasData, i0, i1, isArr, EMPTY_OBJ } = this.u;
		let didStrokeFill = false;

		// Handle bands
		if (flags != 0) {
			bands.forEach((b, bi) => {
				if (b.series[0] == si) {
					let lowerEdge = series[b.series[1]];
					let lowerData = data[b.series[1]];
					let bandClip = (lowerEdge._paths || EMPTY_OBJ).band;

					if (isArr(bandClip)) {
						bandClip = b.dir == 1 ? bandClip[0] : bandClip[1];
					}

					let gapsClip2;
					let _fillStyle = null;

					if (lowerEdge.show && bandClip && hasData(lowerData, i0, i1)) {
						_fillStyle = b.fill(this.u, bi) || fillStyle;
						gapsClip2 = lowerEdge._paths.clip;
					} else {
						bandClip = null;
					}

					this.strokeFill(strokeStyle, lineWidth, lineDash, lineCap, _fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip);
					didStrokeFill = true;
				}
			});
		}

		if (!didStrokeFill) {
			this.strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip);
		}
	}

	/**
	 * Core stroke and fill operation with clipping support
	 */
	strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip) {
		this.setCtxStyle(strokeStyle, lineWidth, lineDash, lineCap, fillStyle);

		if (boundsClip || gapsClip || bandClip) {
			this.ctx.save();
			if (boundsClip) this.ctx.clip(boundsClip);
			if (gapsClip) this.ctx.clip(gapsClip);
		}

		if (bandClip) {
			if ((flags & this.CLIP_FILL_STROKE) == this.CLIP_FILL_STROKE) {
				this.ctx.clip(bandClip);
				if (gapsClip2) this.ctx.clip(gapsClip2);
				this.doFill(fillStyle, fillPath);
				this.doStroke(strokeStyle, strokePath, lineWidth);
			} else if (flags & BAND_CLIP_STROKE) {
				this.doFill(fillStyle, fillPath);
				this.ctx.clip(bandClip);
				this.doStroke(strokeStyle, strokePath, lineWidth);
			} else if (flags & BAND_CLIP_FILL) {
				this.ctx.save();
				this.ctx.clip(bandClip);
				if (gapsClip2) this.ctx.clip(gapsClip2);
				this.doFill(fillStyle, fillPath);
				this.ctx.restore();
				this.doStroke(strokeStyle, strokePath, lineWidth);
			}
		} else {
			this.doFill(fillStyle, fillPath);
			this.doStroke(strokeStyle, strokePath, lineWidth);
		}

		if (boundsClip || gapsClip || bandClip) {
			this.ctx.restore();
		}
	}

	/**
	 * Perform stroke operation
	 */
	doStroke(strokeStyle, strokePath, lineWidth) {
		if (lineWidth > 0) {
			if (strokePath instanceof Map) {
				strokePath.forEach((strokePath, strokeStyle) => {
					this.ctx.strokeStyle = this.ctxStroke = strokeStyle;
					this.ctx.stroke(strokePath);
				});
			} else if (strokePath != null && strokeStyle) {
				this.ctx.stroke(strokePath);
			}
		}
	}

	/**
	 * Perform fill operation
	 */
	doFill(fillStyle, fillPath) {
		if (fillPath instanceof Map) {
			fillPath.forEach((fillPath, fillStyle) => {
				this.ctx.fillStyle = this.ctxFill = fillStyle;
				this.ctx.fill(fillPath);
			});
		} else if (fillPath != null && fillStyle) {
			this.ctx.fill(fillPath);
		}
	}

	/**
	 * Draw orthogonal lines (ticks, grid, borders)
	 */
	drawOrthoLines(offs, filts, ori, side, pos0, len, width, stroke, dash, cap) {
		const { pxAlign } = this.u;
		let offset = (width % 2) / 2;

		if (pxAlign == 1) {
			this.ctx.translate(offset, offset);
		}

		this.setCtxStyle(stroke, width, dash, cap, stroke);
		this.ctx.beginPath();

		let x0, y0, x1, y1, pos1 = pos0 + (side == 0 || side == 3 ? -len : len);

		if (ori == 0) {
			y0 = pos0;
			y1 = pos1;
		} else {
			x0 = pos0;
			x1 = pos1;
		}

		for (let i = 0; i < offs.length; i++) {
			if (filts[i] != null) {
				if (ori == 0) {
					x0 = x1 = offs[i];
				} else {
					y0 = y1 = offs[i];
				}

				this.ctx.moveTo(x0, y0);
				this.ctx.lineTo(x1, y1);
			}
		}

		this.ctx.stroke();

		if (pxAlign == 1) {
			this.ctx.translate(-offset, -offset);
		}
	}

	/**
	 * Set canvas context style with caching for performance
	 */
	setCtxStyle(stroke, width, dash, cap, fill, join) {
		stroke ??= transparent;
		dash ??= EMPTY_ARR;
		cap ??= "butt";
		join ??= "round";

		if (stroke != this.ctxStroke) {
			this.ctx.strokeStyle = this.ctxStroke = stroke;
		}
		if (fill != this.ctxFill) {
			this.ctx.fillStyle = this.ctxFill = fill;
		}
		if (width != this.ctxWidth) {
			this.ctx.lineWidth = this.ctxWidth = width;
		}
		if (dash != this.ctxDash) {
			this.ctx.setLineDash(this.ctxDash = dash);
		}
		if (cap != this.ctxCap) {
			this.ctx.lineCap = this.ctxCap = cap;
		}
		if (join != this.ctxJoin) {
			this.ctx.lineJoin = this.ctxJoin = join;
		}
	}

	/**
	 * Set font style with caching
	 */
	setFontStyle(font, fill, align, baseline) {
		if (fill != this.ctxFill) {
			this.ctx.fillStyle = this.ctxFill = fill;
		}
		if (font != this.ctxFont) {
			this.ctx.font = this.ctxFont = font;
		}
		if (align != this.ctxAlign) {
			this.ctx.textAlign = this.ctxAlign = align;
		}
		if (baseline != this.ctxBaseline) {
			this.ctx.textBaseline = this.ctxBaseline = baseline;
		}
	}

	/**
	 * Get outer indices for data range
	 */
	getOuterIdxs(data) {
		let i0 = 0;
		let i1 = data.length - 1;
		
		// Find first non-null value
		while (i0 <= i1 && data[i0] == null) {
			i0++;
		}
		
		// Find last non-null value
		while (i1 >= i0 && data[i1] == null) {
			i1--;
		}
		
		return [i0, i1];
	}

	/**
	 * Invalidate style cache (called when canvas is resized)
	 */
	invalidateStyleCache() {
		this.ctxStroke = this.ctxFill = this.ctxWidth = this.ctxJoin = this.ctxCap = this.ctxFont = this.ctxAlign = this.ctxBaseline = this.ctxDash = null;
		this.ctxAlpha = 1;
	}
}