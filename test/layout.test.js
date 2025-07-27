import { test, describe } from 'node:test';
import assert from 'node:assert';
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

	test('constructor initializes layout dimensions', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		assert.strictEqual(layoutManager.fullWidCss, 0);
		assert.strictEqual(layoutManager.fullHgtCss, 0);
		assert.strictEqual(layoutManager.plotWidCss, 0);
		assert.strictEqual(layoutManager.plotHgtCss, 0);
		assert.strictEqual(layoutManager.plotLftCss, 0);
		assert.strictEqual(layoutManager.plotTopCss, 0);
		assert.deepStrictEqual(layoutManager.sidesWithAxes, [false, false, false, false]);
	});

	test('calcSize calculates basic dimensions correctly', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		const result = layoutManager.calcSize(800, 600);

		assert.strictEqual(result.fullWidCss, 800);
		assert.strictEqual(result.fullHgtCss, 600);
		assert.strictEqual(mockUPlot.width, 800);
		assert.strictEqual(mockUPlot.height, 600);
	});

	test('calcPlotRect accounts for axis dimensions', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Set initial dimensions
		layoutManager.fullWidCss = layoutManager.plotWidCss = 800;
		layoutManager.fullHgtCss = layoutManager.plotHgtCss = 600;
		layoutManager.plotLftCss = layoutManager.plotTopCss = 0;

		layoutManager.calcPlotRect();

		// Should account for bottom axis (side 2) and left axis (side 3)
		// Bottom axis: _size (50) + labelSize (30) = 80 pixels from height
		// Left axis: _size (50) + labelSize (30) = 80 pixels from width and added to left offset
		assert.strictEqual(layoutManager.plotHgtCss, 600 - 80); // 520
		assert.strictEqual(layoutManager.plotWidCss, 800 - 80); // 720
		assert.strictEqual(layoutManager.plotLftCss, 80); // left offset for left axis
		assert.strictEqual(layoutManager.plotTopCss, 0); // no top axis

		// Check sides with axes tracking
		assert.deepStrictEqual(layoutManager.sidesWithAxes, [false, false, true, true]); // bottom and left
	});

	test('calcAxesRects sets axis positions correctly', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Set up plot dimensions
		layoutManager.plotLftCss = 80;
		layoutManager.plotTopCss = 0;
		layoutManager.plotWidCss = 720;
		layoutManager.plotHgtCss = 520;

		layoutManager.calcAxesRects();

		// Bottom axis (side 2) should be positioned at bottom
		assert.strictEqual(mockUPlot.axes[0]._pos, 520); // plotTopCss + plotHgtCss
		assert.strictEqual(mockUPlot.axes[0]._lpos, 570); // _pos + _size

		// Left axis (side 3) should be positioned at left
		assert.strictEqual(mockUPlot.axes[1]._pos, 80); // plotLftCss
		assert.strictEqual(mockUPlot.axes[1]._lpos, 30); // plotLftCss - _size
	});

	test('autoPadSide calculates padding correctly', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Test case 1: Only left and right axes, no top/bottom
		let sidesWithAxes = [false, true, false, true]; // top, right, bottom, left
		
		// Top side (0) with left/right axes should get padding (no top axis)
		let padding = layoutManager.autoPadSide(mockUPlot, 0, sidesWithAxes, 0);
		assert.strictEqual(padding, Math.round(50 / 3)); // AXIS_SIZE_DEFAULT / 3

		// Bottom side (2) with left/right axes should get padding (no bottom axis)
		padding = layoutManager.autoPadSide(mockUPlot, 2, sidesWithAxes, 0);
		assert.strictEqual(padding, Math.round(50 / 3)); // AXIS_SIZE_DEFAULT / 3

		// Test case 2: Only top and bottom axes, no left/right
		sidesWithAxes = [true, false, true, false]; // top, right, bottom, left

		// Right side (1) with top/bottom axes should get padding (no right axis)
		padding = layoutManager.autoPadSide(mockUPlot, 1, sidesWithAxes, 0);
		assert.strictEqual(padding, Math.round(50 / 2)); // AXIS_SIZE_DEFAULT / 2

		// Left side (3) with top/bottom axes should get padding (no left axis)
		padding = layoutManager.autoPadSide(mockUPlot, 3, sidesWithAxes, 0);
		assert.strictEqual(padding, Math.round(50 / 2)); // AXIS_SIZE_DEFAULT / 2

		// Test case 3: All axes present - no padding needed
		sidesWithAxes = [true, true, true, true]; // all sides have axes

		// No padding should be applied when axes are present on the side
		padding = layoutManager.autoPadSide(mockUPlot, 0, sidesWithAxes, 0);
		assert.strictEqual(padding, 0);

		padding = layoutManager.autoPadSide(mockUPlot, 1, sidesWithAxes, 0);
		assert.strictEqual(padding, 0);

		padding = layoutManager.autoPadSide(mockUPlot, 2, sidesWithAxes, 0);
		assert.strictEqual(padding, 0);

		padding = layoutManager.autoPadSide(mockUPlot, 3, sidesWithAxes, 0);
		assert.strictEqual(padding, 0);
	});

	test('getPlotRect returns current plot rectangle', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.plotLftCss = 80;
		layoutManager.plotTopCss = 20;
		layoutManager.plotWidCss = 720;
		layoutManager.plotHgtCss = 520;

		const rect = layoutManager.getPlotRect();

		assert.deepStrictEqual(rect, {
			left: 80,
			top: 20,
			width: 720,
			height: 520
		});
	});

	test('getCanvasRect returns canvas pixel dimensions', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.plotLft = 80;
		layoutManager.plotTop = 20;
		layoutManager.plotWid = 720;
		layoutManager.plotHgt = 520;

		const rect = layoutManager.getCanvasRect();

		assert.deepStrictEqual(rect, {
			left: 80,
			top: 20,
			width: 720,
			height: 520
		});
	});

	test('getPadding returns current padding values', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		const padding = layoutManager.getPadding();

		assert.strictEqual(Array.isArray(padding), true);
		assert.strictEqual(padding.length, 4);
	});

	test('hasChanged detects layout changes', () => {
		mockUPlot = createMockUPlot();
		layoutManager = new LayoutManager(mockUPlot);

		// Initially no change
		assert.strictEqual(layoutManager.hasChanged(), false);

		// Change dimensions
		layoutManager.plotWidCss = 100;
		assert.strictEqual(layoutManager.hasChanged(), true);

		// Update previous values
		layoutManager.updateLayout();
		assert.strictEqual(layoutManager.hasChanged(), false);
	});

	test('paddingCalc updates padding and returns convergence status', () => {
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

		assert.strictEqual(converged, false); // Should not converge on first call with different values
		assert.deepStrictEqual(layoutManager._padding, [10, 20, 30, 40]);

		// Second call with same values should converge
		const converged2 = layoutManager.paddingCalc(2);
		assert.strictEqual(converged2, true);
	});

	test('calcSize with pixel ratio scaling', () => {
		mockUPlot = createMockUPlot();
		mockUPlot.pxRatio = 2;
		layoutManager = new LayoutManager(mockUPlot);

		const result = layoutManager.calcSize(800, 600);

		// Canvas dimensions should be scaled by pxRatio
		assert.strictEqual(result.plotLft, Math.round(result.plotLftCss * 2));
		assert.strictEqual(result.plotTop, Math.round(result.plotTopCss * 2));
		assert.strictEqual(result.plotWid, Math.round(result.plotWidCss * 2));
		assert.strictEqual(result.plotHgt, Math.round(result.plotHgtCss * 2));
	});

	test('handles axes with no labels', () => {
		mockUPlot = createMockUPlot();
		mockUPlot.axes[0].label = null;
		mockUPlot.axes[1].label = null;
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.fullWidCss = layoutManager.plotWidCss = 800;
		layoutManager.fullHgtCss = layoutManager.plotHgtCss = 600;
		layoutManager.plotLftCss = layoutManager.plotTopCss = 0;

		layoutManager.calcPlotRect();

		// Should only account for _size, not labelSize
		assert.strictEqual(layoutManager.plotHgtCss, 600 - 50); // 550
		assert.strictEqual(layoutManager.plotWidCss, 800 - 50); // 750
		assert.strictEqual(layoutManager.plotLftCss, 50);
	});

	test('handles hidden axes', () => {
		mockUPlot = createMockUPlot();
		mockUPlot.axes[0].show = false;
		mockUPlot.axes[1]._show = false;
		layoutManager = new LayoutManager(mockUPlot);

		layoutManager.fullWidCss = layoutManager.plotWidCss = 800;
		layoutManager.fullHgtCss = layoutManager.plotHgtCss = 600;
		layoutManager.plotLftCss = layoutManager.plotTopCss = 0;

		layoutManager.calcPlotRect();

		// Should not account for hidden axes
		assert.strictEqual(layoutManager.plotHgtCss, 600);
		assert.strictEqual(layoutManager.plotWidCss, 800);
		assert.strictEqual(layoutManager.plotLftCss, 0);
		assert.deepStrictEqual(layoutManager.sidesWithAxes, [false, false, false, false]);
	});
});