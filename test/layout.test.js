import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutManager } from '../src/core/layout.js';

describe('LayoutManager', () => {
	let mockUPlot;
	let layoutManager;

	// Setup mock uPlot instance
	function createMockUPlot(opts = {}) {
		return {
			opts: opts,
			pxRatio: 1,
			width: 800,
			height: 600,
			bbox: {},
			axes: [
				{
					show: true,
					_show: true,
					side: 2, // bottom
					_size: 50,
					labelSize: 30,
					label: 'X Axis'
				},
				{
					show: true,
					_show: true,
					side: 3, // left
					_size: 50,
					labelSize: 30,
					label: 'Y Axis'
				}
			]
		};
	}

	it('constructor initializes layout dimensions', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		expect(layoutManager.fullWidCss).toBe(0);
		expect(layoutManager.fullHgtCss).toBe(0);
		expect(layoutManager.plotWidCss).toBe(0);
		expect(layoutManager.plotHgtCss).toBe(0);
		expect(layoutManager.plotLftCss).toBe(0);
		expect(layoutManager.plotTopCss).toBe(0);
		expect(layoutManager.sidesWithAxes).toEqual([false, false, false, false]);
	});

	it('calcSize calculates basic dimensions correctly', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		const result = layoutManager.calcSize(800, 600);

		expect(result.fullWidCss).toBe(800);
		expect(result.fullHgtCss).toBe(600);
		expect(mockUPlot.width).toBe(800);
		expect(mockUPlot.height).toBe(600);
	});

	it('calcPlotRect accounts for axis dimensions', () => {
		mockUPlot = createMockUPlot();
		// Set up axes properly for the layout manager
		mockUPlot.axes = { axes: mockUPlot.axes };
		layoutManager = new LayoutManager(mockUPlot);

		// Set initial dimensions
		layoutManager.fullWidCss = layoutManager.plotWidCss = 800;
		layoutManager.fullHgtCss = layoutManager.plotHgtCss = 600;
		layoutManager.plotLftCss = layoutManager.plotTopCss = 0;

		layoutManager.calcPlotRect();

		// The actual implementation processes axes differently
		// It should account for axes and padding
		expect(layoutManager.plotHgtCss).toBeLessThan(600); // reduced by axes and padding
		expect(layoutManager.plotWidCss).toBeLessThan(800); // reduced by axes and padding
		expect(layoutManager.plotLftCss).toBeGreaterThan(0); // offset by left axis and padding

		// Check sides with axes tracking
		expect(layoutManager.sidesWithAxes).toEqual([false, false, true, true]); // bottom and left
	});

	it('calcAxesRects sets axis positions correctly', () => {
		mockUPlot = createMockUPlot();
		// Set up axes properly for the layout manager
		mockUPlot.axes = { axes: mockUPlot.axes };
		layoutManager = new LayoutManager(mockUPlot);

		// Set up plot dimensions
		layoutManager.plotLftCss = 80;
		layoutManager.plotTopCss = 0;
		layoutManager.plotWidCss = 720;
		layoutManager.plotHgtCss = 520;

		layoutManager.calcAxesRects();

		// Axes should have _pos set (exact values depend on implementation)
		expect(mockUPlot.axes.axes[0]._pos).toBeDefined();
		expect(mockUPlot.axes.axes[1]._pos).toBeDefined();
		
		// If axes have labels, they should have _lpos set
		if (mockUPlot.axes.axes[0].label) {
			expect(mockUPlot.axes.axes[0]._lpos).toBeDefined();
		}
		if (mockUPlot.axes.axes[1].label) {
			expect(mockUPlot.axes.axes[1]._lpos).toBeDefined();
		}
	});

	it('autoPadSide calculates padding correctly', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Test case 1: Only left and right axes, no top/bottom
		let sidesWithAxes = [false, true, false, true]; // top, right, bottom, left
		
		// Top side (0) with left/right axes should get padding (no top axis)
		let padding = layoutManager.autoPadSide(mockUPlot, 0, sidesWithAxes, 0);
		expect(padding).toBe(Math.round(50 / 3)); // AXIS_SIZE_DEFAULT / 3

		// Bottom side (2) with left/right axes should get padding (no bottom axis)
		padding = layoutManager.autoPadSide(mockUPlot, 2, sidesWithAxes, 0);
		expect(padding).toBe(Math.round(50 / 3)); // AXIS_SIZE_DEFAULT / 3

		// Test case 2: Only top and bottom axes, no left/right
		sidesWithAxes = [true, false, true, false]; // top, right, bottom, left

		// Right side (1) with top/bottom axes should get padding (no right axis)
		padding = layoutManager.autoPadSide(mockUPlot, 1, sidesWithAxes, 0);
		expect(padding).toBe(Math.round(50 / 2)); // AXIS_SIZE_DEFAULT / 2

		// Left side (3) with top/bottom axes should get padding (no left axis)
		padding = layoutManager.autoPadSide(mockUPlot, 3, sidesWithAxes, 0);
		expect(padding).toBe(Math.round(50 / 2)); // AXIS_SIZE_DEFAULT / 2

		// Test case 3: All axes present - no padding needed
		sidesWithAxes = [true, true, true, true]; // all sides have axes

		// No padding should be applied when axes are present on the side
		padding = layoutManager.autoPadSide(mockUPlot, 0, sidesWithAxes, 0);
		expect(padding).toBe(0);

		padding = layoutManager.autoPadSide(mockUPlot, 1, sidesWithAxes, 0);
		expect(padding).toBe(0);

		padding = layoutManager.autoPadSide(mockUPlot, 2, sidesWithAxes, 0);
		expect(padding).toBe(0);

		padding = layoutManager.autoPadSide(mockUPlot, 3, sidesWithAxes, 0);
		expect(padding).toBe(0);
	});

	it('getPlotRect returns current plot rectangle', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.plotLftCss = 80;
		layoutManager.plotTopCss = 20;
		layoutManager.plotWidCss = 720;
		layoutManager.plotHgtCss = 520;

		const rect = layoutManager.getPlotRect();

		expect(rect).toEqual({
			left: 80,
			top: 20,
			width: 720,
			height: 520
		});
	});

	it('getCanvasRect returns canvas pixel dimensions', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.plotLft = 80;
		layoutManager.plotTop = 20;
		layoutManager.plotWid = 720;
		layoutManager.plotHgt = 520;

		const rect = layoutManager.getCanvasRect();

		expect(rect).toEqual({
			left: 80,
			top: 20,
			width: 720,
			height: 520
		});
	});

	it('getPadding returns current padding values', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		const padding = layoutManager.getPadding();

		expect(Array.isArray(padding)).toBe(true);
		expect(padding.length).toBe(4);
	});

	it('hasChanged detects layout changes', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Initially no change
		expect(layoutManager.hasChanged()).toBe(false);

		// Change dimensions
		layoutManager.plotWidCss = 100;
		expect(layoutManager.hasChanged()).toBe(true);

		// Update previous values
		layoutManager.updateLayout();
		expect(layoutManager.hasChanged()).toBe(false);
	});

	it('paddingCalc updates padding and returns convergence status', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Mock padding functions that return different values
		layoutManager.padding = [
			() => 10,
			() => 20,
			() => 30,
			() => 40
		];

		const converged = layoutManager.paddingCalc(1);

		expect(converged).toBe(false); // Should not converge on first call with different values
		expect(layoutManager._padding).toEqual([10, 20, 30, 40]);

		// Second call with same values should converge
		const converged2 = layoutManager.paddingCalc(2);
		expect(converged2).toBe(true);
	});

	it('calcSize with pixel ratio scaling', () => {
		mockUPlot = createMockUPlot();
		mockUPlot.pxRatio = 2;
		layoutManager = new LayoutManager(mockUPlot);

		const result = layoutManager.calcSize(800, 600);

		// Canvas dimensions should be scaled by pxRatio
		expect(result.plotLft).toBe(Math.round(result.plotLftCss * 2));
		expect(result.plotTop).toBe(Math.round(result.plotTopCss * 2));
		expect(result.plotWid).toBe(Math.round(result.plotWidCss * 2));
		expect(result.plotHgt).toBe(Math.round(result.plotHgtCss * 2));
	});

	it('handles axes with no labels', () => {
		mockUPlot = createMockUPlot();
		mockUPlot.axes[0].label = null;
		mockUPlot.axes[1].label = null;
		// Set up axes properly for the layout manager
		mockUPlot.axes = { axes: mockUPlot.axes };
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.fullWidCss = layoutManager.plotWidCss = 800;
		layoutManager.fullHgtCss = layoutManager.plotHgtCss = 600;
		layoutManager.plotLftCss = layoutManager.plotTopCss = 0;

		layoutManager.calcPlotRect();

		// Should account for axes without labels plus padding
		expect(layoutManager.plotHgtCss).toBeLessThan(600); // reduced by axes and padding
		expect(layoutManager.plotWidCss).toBeLessThan(800); // reduced by axes and padding
		expect(layoutManager.plotLftCss).toBeGreaterThan(0); // offset by left axis and padding
	});

	it('handles hidden axes', () => {
		mockUPlot = createMockUPlot();
		mockUPlot.axes[0].show = false;
		mockUPlot.axes[1]._show = false;
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.fullWidCss = layoutManager.plotWidCss = 800;
		layoutManager.fullHgtCss = layoutManager.plotHgtCss = 600;
		layoutManager.plotLftCss = layoutManager.plotTopCss = 0;

		layoutManager.calcPlotRect();

		// Should not account for hidden axes
		expect(layoutManager.plotHgtCss).toBe(600);
		expect(layoutManager.plotWidCss).toBe(800);
		expect(layoutManager.plotLftCss).toBe(0);
		expect(layoutManager.sidesWithAxes).toEqual([false, false, false, false]);
	});
});