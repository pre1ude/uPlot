import { incrRound, round, fnOrSelf, ifNull } from '../utils.js';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	safeExecute,
	errorReporter
} from './errors.js';

// Constants from opts.js to avoid complex dependency chain
const AXIS_SIZE_DEFAULT = 50;

/**
 * Layout Manager - handles size calculations, plot area management, and responsive layout
 */
export class LayoutManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'LayoutManager', 'constructor');
			
			this.uplot = uplot;
			
			// Layout dimensions in CSS pixels
			this.fullWidCss = 0;
			this.fullHgtCss = 0;
			this.plotWidCss = 0;
			this.plotHgtCss = 0;
			this.plotLftCss = 0;
			this.plotTopCss = 0;
			
			// Layout dimensions in canvas pixels
			this.plotLft = 0;
			this.plotTop = 0;
			this.plotWid = 0;
			this.plotHgt = 0;
			
			// Previous values for diffing
			this._plotLftCss = 0;
			this._plotTopCss = 0;
			this._plotWidCss = 0;
			this._plotHgtCss = 0;
			
			// Sides with axes tracking
			this.sidesWithAxes = [false, false, false, false];
			
			// Initialize padding
			this.initPadding();
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize padding configuration
	 */
	initPadding() {
		const opts = this.uplot.opts || {};
		this.padding = (opts.padding || [this.autoPadSide, this.autoPadSide, this.autoPadSide, this.autoPadSide])
			.map(p => fnOrSelf(ifNull(p, this.autoPadSide)));
		this._padding = this.padding.map((p, i) => p(this.uplot, i, this.sidesWithAxes, 0));
	}

	/**
	 * Calculate automatic padding for a side based on axis presence
	 */
	autoPadSide = (self, side, sidesWithAxes, cycleNum) => {
		let [hasTopAxis, hasRgtAxis, hasBtmAxis, hasLftAxis] = sidesWithAxes;

		let ori = side % 2;
		let size = 0;

		if (ori == 0 && (hasLftAxis || hasRgtAxis))
			size = (side == 0 && !hasTopAxis || side == 2 && !hasBtmAxis ? round(AXIS_SIZE_DEFAULT / 3) : 0);
		if (ori == 1 && (hasTopAxis || hasBtmAxis))
			size = (side == 1 && !hasRgtAxis || side == 3 && !hasLftAxis ? round(AXIS_SIZE_DEFAULT / 2) : 0);

		return size;
	}

	/**
	 * Main size calculation function
	 */
	calcSize(width, height) {
		return withErrorBoundary('LayoutManager', 'calcSize', function(width, height) {
			validateRequired(width, 'width', 'LayoutManager', 'calcSize');
			validateRequired(height, 'height', 'LayoutManager', 'calcSize');
			validateType(width, 'number', 'width', 'LayoutManager', 'calcSize');
			validateType(height, 'number', 'height', 'LayoutManager', 'calcSize');
			
			if (width <= 0 || height <= 0) {
				throw new UPlotError(
					`Invalid dimensions: width=${width}, height=${height}. Both must be positive numbers.`,
					'LayoutManager',
					{ method: 'calcSize', width, height, type: ERROR_TYPES.VALIDATION }
				);
			}

			// Initialize dimensions
			this.fullWidCss = this.plotWidCss = width;
			this.fullHgtCss = this.plotHgtCss = height;
			this.plotLftCss = this.plotTopCss = 0;

			// Calculate plot area and axis positions
			this.calcPlotRect();
			this.calcAxesRects();

			// Convert to canvas pixels
			const pxRatio = this.uplot.pxRatio || 1;
			const bbox = this.uplot.bbox || {};
			
			this.plotLft = bbox.left = incrRound(this.plotLftCss * pxRatio, 0.5);
			this.plotTop = bbox.top = incrRound(this.plotTopCss * pxRatio, 0.5);
			this.plotWid = bbox.width = incrRound(this.plotWidCss * pxRatio, 0.5);
			this.plotHgt = bbox.height = incrRound(this.plotHgtCss * pxRatio, 0.5);

			// Update uPlot instance dimensions
			this.uplot._width = width;
			this.uplot._height = height;
			
			return {
				fullWidCss: this.fullWidCss,
				fullHgtCss: this.fullHgtCss,
				plotWidCss: this.plotWidCss,
				plotHgtCss: this.plotHgtCss,
				plotLftCss: this.plotLftCss,
				plotTopCss: this.plotTopCss,
				plotLft: this.plotLft,
				plotTop: this.plotTop,
				plotWid: this.plotWid,
				plotHgt: this.plotHgt
			};
		}).call(this, width, height);
	}

	/**
	 * Calculate plot rectangle by accounting for axes and padding
	 */
	calcPlotRect() {
		return withErrorBoundary('LayoutManager', 'calcPlotRect', function() {
			const axes = this.uplot.axes?.axes || [];
			
			// Reset axis presence tracking
			let hasTopAxis = false;
			let hasBtmAxis = false;
			let hasRgtAxis = false;
			let hasLftAxis = false;

		// Process each axis to determine space requirements
		axes.forEach((axis, i) => {
			if (axis.show && axis._show) {
				let { side, _size } = axis;
				let isVt = side % 2;
				let labelSize = axis.label != null ? axis.labelSize : 0;

				let fullSize = _size + labelSize;

				if (fullSize > 0) {
					if (isVt) {
						this.plotWidCss -= fullSize;

						if (side == 3) {
							this.plotLftCss += fullSize;
							hasLftAxis = true;
						}
						else {
							hasRgtAxis = true;
						}
					}
					else {
						this.plotHgtCss -= fullSize;

						if (side == 0) {
							this.plotTopCss += fullSize;
							hasTopAxis = true;
						}
						else {
							hasBtmAxis = true;
						}
					}
				}
			}
		});

		// Update sides with axes tracking
		this.sidesWithAxes[0] = hasTopAxis;
		this.sidesWithAxes[1] = hasRgtAxis;
		this.sidesWithAxes[2] = hasBtmAxis;
		this.sidesWithAxes[3] = hasLftAxis;

		// Apply horizontal padding
		this.plotWidCss -= this._padding[1] + this._padding[3];
		this.plotLftCss += this._padding[3];

			// Apply vertical padding
			this.plotHgtCss -= this._padding[2] + this._padding[0];
			this.plotTopCss += this._padding[0];
		}).call(this);
	}

	/**
	 * Calculate axis rectangles and positions
	 */
	calcAxesRects() {
		const axes = this.uplot.axes?.axes || [];
		
		// Offset accumulators
		let off1 = this.plotLftCss + this.plotWidCss; // right side accumulator
		let off2 = this.plotTopCss + this.plotHgtCss; // bottom side accumulator
		let off3 = this.plotLftCss; // left side accumulator
		let off0 = this.plotTopCss; // top side accumulator

		/**
		 * Increment offset for a given side
		 */
		function incrOffset(side, size) {
			switch (side) {
				case 1: off1 += size; return off1 - size; // right
				case 2: off2 += size; return off2 - size; // bottom
				case 3: off3 -= size; return off3 + size; // left
				case 0: off0 -= size; return off0 + size; // top
			}
		}

		// Calculate positions for each axis
		axes.forEach((axis, i) => {
			if (axis.show && axis._show) {
				let side = axis.side;

				axis._pos = incrOffset(side, axis._size);

				if (axis.label != null) {
					axis._lpos = incrOffset(side, axis.labelSize);
				}
			}
		});
	}

	/**
	 * Update padding calculations (used during size convergence)
	 */
	paddingCalc(cycleNum) {
		let converged = true;

		this.padding.forEach((p, i) => {
			let _p = p(this.uplot, i, this.sidesWithAxes, cycleNum);

			if (_p != this._padding[i]) {
				converged = false;
			}

			this._padding[i] = _p;
		});

		return converged;
	}

	/**
	 * Size convergence logic to handle interdependent calculations
	 */
	convergeSize(width, height) {
		const CYCLE_LIMIT = 3;
		let converged = false;
		let cycleNum = 0;

		while (!converged) {
			cycleNum++;

			// Note: axesCalc would be handled by AxisManager in a full implementation
			let axesConverged = true; // Placeholder - would call axesCalc(cycleNum)
			let paddingConverged = this.paddingCalc(cycleNum);

			converged = cycleNum == CYCLE_LIMIT || (axesConverged && paddingConverged);

			if (!converged) {
				this.calcSize(width, height);
			}
		}

		return converged;
	}

	/**
	 * Update layout with new dimensions
	 */
	updateLayout() {
		// Store previous values for comparison
		this._plotLftCss = this.plotLftCss;
		this._plotTopCss = this.plotTopCss;
		this._plotWidCss = this.plotWidCss;
		this._plotHgtCss = this.plotHgtCss;
	}

	/**
	 * Get current plot rectangle
	 */
	getPlotRect() {
		return {
			left: this.plotLftCss,
			top: this.plotTopCss,
			width: this.plotWidCss,
			height: this.plotHgtCss
		};
	}

	/**
	 * Get current padding values
	 */
	getPadding() {
		return [...this._padding];
	}

	/**
	 * Get plot dimensions in canvas pixels
	 */
	getCanvasRect() {
		return {
			left: this.plotLft,
			top: this.plotTop,
			width: this.plotWid,
			height: this.plotHgt
		};
	}

	/**
	 * Check if layout dimensions have changed
	 */
	hasChanged() {
		return (
			this._plotLftCss !== this.plotLftCss ||
			this._plotTopCss !== this.plotTopCss ||
			this._plotWidCss !== this.plotWidCss ||
			this._plotHgtCss !== this.plotHgtCss
		);
	}
}