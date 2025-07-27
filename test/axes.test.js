import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxisManager } from '../src/core/axes.js';

// Mock dependencies
vi.mock('../src/utils.js', () => ({
	assign: vi.fn((target, ...sources) => Object.assign(target, ...sources)),
	ceil: vi.fn(Math.ceil),
	round: vi.fn(Math.round),
	roundDec: vi.fn((val, dec) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec)),
	max: vi.fn(Math.max),
	min: vi.fn(Math.min),
	abs: vi.fn(Math.abs),
	PI: Math.PI,
	fnOrSelf: vi.fn(v => typeof v === 'function' ? v : () => v),
	ifNull: vi.fn((a, b) => a != null ? a : b),
	isArr: vi.fn(Array.isArray),
	isStr: vi.fn(v => typeof v === 'string'),
	isFn: vi.fn(v => typeof v === 'function'),
	closestIdx: vi.fn(() => 0),
	numIntDigits: vi.fn(() => 1),
	fixedDec: new Map(),
	guessDec: vi.fn(() => 2),
	incrRound: vi.fn(v => v),
	pxRoundGen: vi.fn(() => v => v)
}));

vi.mock('../src/opts.js', () => ({
	xAxisOpts: {},
	yAxisOpts: {},
	wholeIncrs: [1, 2, 5, 10],
	numIncrs: [1, 2, 5, 10],
	timeIncrsMs: [1000, 2000, 5000],
	timeIncrsS: [1, 2, 5],
	numAxisSplits: vi.fn(() => [0, 1, 2, 3, 4, 5]),
	logAxisSplits: vi.fn(() => [1, 10, 100]),
	asinhAxisSplits: vi.fn(() => [0, 1, 2]),
	timeAxisVals: vi.fn(() => vi.fn()),
	timeAxisVal: vi.fn(() => vi.fn()),
	numAxisVals: vi.fn(() => ['0', '1', '2', '3', '4', '5']),
	log10AxisValsFilt: vi.fn(v => v),
	log2AxisValsFilt: vi.fn(v => v),
	timeAxisStamps: vi.fn(() => vi.fn()),
	retArg1: vi.fn((a, b) => b)
}));

vi.mock('../src/feats.js', () => ({
	FEAT_TIME: true
}));

vi.mock('../src/domClasses.js', () => ({
	TOP: 'u-top',
	BOTTOM: 'u-bottom',
	LEFT: 'u-left',
	RIGHT: 'u-right',
	AXIS: 'u-axis'
}));

vi.mock('../src/dom.js', () => ({
	placeDiv: vi.fn(() => ({ style: {} }))
}));

vi.mock('../src/fmtDate.js', () => ({
	fmtDate: vi.fn()
}));

describe('AxisManager', () => {
	let axisManager;
	let mockUplot;
	let mockScaleManager;

	beforeEach(() => {
		mockUplot = {
			mode: 1,
			pxRatio: 1,
			wrap: { appendChild: vi.fn() },
			ms: 1,
			_timeAxisSplits: vi.fn(),
			_timeAxisVals: vi.fn(),
			_fmtDate: vi.fn(),
			_tzDate: vi.fn(),
			axes: [
				{
					show: true,
					side: 0,
					scale: 'x',
					size: vi.fn(() => 20),
					space: vi.fn(() => 40),
					rotate: vi.fn(() => 0),
					incrs: vi.fn(() => [1, 2, 5, 10]),
					splits: vi.fn(() => [0, 1, 2, 3, 4, 5]),
					stroke: vi.fn(() => '#000'),
					grid: { stroke: vi.fn(() => '#ccc') },
					ticks: { stroke: vi.fn(() => '#000') },
					border: { stroke: vi.fn(() => '#000') },
					values: vi.fn(() => ['0', '1', '2', '3', '4', '5']),
					filter: vi.fn((uplot, splits) => splits),
					font: '12px Arial',
					labelFont: '12px Arial',
					label: 'X Axis',
					labelGap: 5,
					labelSize: 20,
					gap: 5,
					alignTo: 1,
					align: 0,
					lineGap: 1.2
				}
			],
			scales: {
				x: {
					time: false,
					distr: 1,
					log: 10,
					min: 0,
					max: 10
				}
			},
			series: [
				{ scale: 'x' }
			]
		};

		mockScaleManager = {
			// Mock scale manager methods if needed
		};

		axisManager = new AxisManager(mockUplot, mockScaleManager);
	});

	describe('constructor', () => {
		it('should initialize with uplot and scaleManager references', () => {
			expect(axisManager.uplot).toBe(mockUplot);
			expect(axisManager.scaleManager).toBe(mockScaleManager);
			expect(axisManager.axes).toBe(mockUplot.axes);
			expect(axisManager.scales).toBe(mockUplot.scales);
			expect(axisManager.series).toBe(mockUplot.series);
			expect(axisManager.sidesWithAxes).toEqual([false, false, false, false]);
		});
	});

	describe('initAxes', () => {
		it('should initialize all axes', () => {
			const initAxisSpy = vi.spyOn(axisManager, 'initAxis');
			
			axisManager.initAxes({});
			
			expect(initAxisSpy).toHaveBeenCalledWith(
				mockUplot.axes[0],
				0,
				'x',
				1,
				mockUplot.wrap
			);
		});
	});

	describe('initAxis', () => {
		it('should initialize axis when show is true', () => {
			const axis = mockUplot.axes[0];
			
			axisManager.initAxis(axis, 0, 'x', 1, mockUplot.wrap);
			
			expect(axis._show).toBe(true);
			expect(axis._size).toBe(20);
			expect(axisManager.sidesWithAxes[0]).toBe(true);
		});

		it('should not initialize axis when show is false', () => {
			const axis = { ...mockUplot.axes[0], show: false };
			
			axisManager.initAxis(axis, 0, 'x', 1, mockUplot.wrap);
			
			expect(axis._show).toBe(false);
			expect(axis._size).toBeUndefined();
		});

		it('should handle time-based axes', () => {
			const axis = mockUplot.axes[0];
			mockUplot.scales.x.time = true;
			
			axisManager.initAxis(axis, 0, 'x', 1, mockUplot.wrap);
			
			expect(axis._show).toBe(true);
			// Time-specific initialization should occur
		});
	});

	describe('getIncrSpace', () => {
		it('should return [0, 0] when fullDim is 0 or negative', () => {
			const result = axisManager.getIncrSpace(0, 0, 10, 0);
			expect(result).toEqual([0, 0]);
		});

		it('should calculate increment space for positive dimensions', () => {
			const axis = mockUplot.axes[0];
			axis.space = vi.fn(() => 40);
			axis.incrs = vi.fn(() => [1, 2, 5, 10]);
			
			const result = axisManager.getIncrSpace(0, 0, 10, 100);
			
			expect(axis.space).toHaveBeenCalledWith(mockUplot, 0, 0, 10, 100);
			expect(axis.incrs).toHaveBeenCalledWith(mockUplot, 0, 0, 10, 100, 40);
			expect(result).toBeDefined();
			expect(axis._found).toBe(result);
		});
	});

	describe('axesCalc', () => {
		it('should return true when all axes converge', () => {
			const axis = mockUplot.axes[0];
			axis._size = 20;
			axis._show = true; // Set initial show state
			// Mock size function to return the same value to ensure convergence
			axis.size = vi.fn(() => 20);
			
			const result = axisManager.axesCalc(1, 400, 300, [0, 1, 2, 3, 4, 5], vi.fn());
			
			expect(result).toBe(true);
		});

		it('should handle axes with null scale min/max', () => {
			const originalMin = mockUplot.scales.x.min;
			const axis = mockUplot.axes[0];
			axis._show = true; // Set initial state
			mockUplot.scales.x.min = null;
			const resetYSeries = vi.fn();
			
			const result = axisManager.axesCalc(1, 400, 300, [0, 1, 2, 3, 4, 5], resetYSeries);
			
			// Should return false when axis show state changes
			expect(resetYSeries).toHaveBeenCalledWith(false);
			expect(axis._show).toBe(false);
			
			// Restore original value
			mockUplot.scales.x.min = originalMin;
		});

		it('should calculate axis values and splits', () => {
			const axis = mockUplot.axes[0];
			axis.values = vi.fn(() => ['0', '2', '4', '6', '8', '10']);
			axis.filter = vi.fn((uplot, splits) => splits);
			
			axisManager.axesCalc(1, 400, 300, [0, 1, 2, 3, 4, 5], vi.fn());
			
			expect(axis.splits).toHaveBeenCalled();
			expect(axis.values).toHaveBeenCalled();
			expect(axis._values).toBeDefined();
		});
	});

	describe('calcAxesRects', () => {
		it('should calculate axis positions', () => {
			const axis = mockUplot.axes[0];
			axis._show = true;
			axis._size = 20;
			axis.labelSize = 15;
			
			axisManager.calcAxesRects(50, 30, 400, 300);
			
			expect(axis._pos).toBeDefined();
			expect(axis._lpos).toBeDefined();
		});

		it('should skip hidden axes', () => {
			const axis = mockUplot.axes[0];
			axis.show = false;
			
			axisManager.calcAxesRects(50, 30, 400, 300);
			
			expect(axis._pos).toBeUndefined();
		});
	});

	describe('drawOrthoLines', () => {
		it('should draw orthogonal lines on canvas', () => {
			const mockCtx = {
				translate: vi.fn(),
				beginPath: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				stroke: vi.fn()
			};
			const mockSetCtxStyle = vi.fn();
			
			axisManager.drawOrthoLines(
				mockCtx,
				[10, 20, 30],
				[1, 1, 1],
				0, // ori
				0, // side
				100, // pos0
				50, // len
				1, // width
				'#000', // stroke
				[], // dash
				'butt', // cap
				1, // pxAlign
				mockSetCtxStyle
			);
			
			expect(mockCtx.beginPath).toHaveBeenCalled();
			expect(mockCtx.moveTo).toHaveBeenCalledTimes(3);
			expect(mockCtx.lineTo).toHaveBeenCalledTimes(3);
			expect(mockCtx.stroke).toHaveBeenCalled();
			expect(mockSetCtxStyle).toHaveBeenCalled();
		});
	});

	describe('drawAxesGrid', () => {
		it('should draw axes and grid lines', () => {
			const mockCtx = {
				save: vi.fn(),
				restore: vi.fn(),
				translate: vi.fn(),
				rotate: vi.fn(),
				fillText: vi.fn(),
				beginPath: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				stroke: vi.fn()
			};
			const mockSetFontStyle = vi.fn();
			const mockSetCtxStyle = vi.fn();
			const mockGetPos = vi.fn((val) => val * 10);
			const mockFire = vi.fn();
			const mockPxRound = vi.fn(v => v);
			
			// Setup axis with required properties
			const axis = mockUplot.axes[0];
			axis._show = true;
			axis._found = [1, 40];
			axis._splits = [0, 1, 2, 3, 4, 5];
			axis._values = ['0', '1', '2', '3', '4', '5'];
			axis._pos = 350;
			axis._lpos = 370;
			axis.ticks = {
				show: true,
				size: 5,
				width: 1,
				filter: vi.fn(() => [1, 1, 1, 1, 1, 1]),
				stroke: vi.fn(() => '#000'),
				dash: [],
				cap: 'butt'
			};
			axis.grid = {
				show: true,
				width: 1,
				filter: vi.fn(() => [1, 1, 1, 1, 1, 1]),
				stroke: vi.fn(() => '#ccc'),
				dash: [],
				cap: 'butt'
			};
			axis.border = {
				show: true,
				width: 1,
				stroke: vi.fn(() => '#000'),
				dash: [],
				cap: 'butt'
			};
			
			axisManager.drawAxesGrid(
				mockCtx,
				[0, 1, 2, 3, 4, 5], // data0
				50, 30, 400, 300, // plot dimensions
				1, // pxRatio
				1, // pxAlign
				mockPxRound,
				mockGetPos,
				mockSetFontStyle,
				mockSetCtxStyle,
				mockFire
			);
			
			expect(mockCtx.fillText).toHaveBeenCalled(); // axis label
			expect(mockFire).toHaveBeenCalledWith("drawAxes");
		});

		it('should skip hidden axes', () => {
			const mockCtx = { fillText: vi.fn() };
			const mockFire = vi.fn();
			
			mockUplot.axes[0].show = false;
			
			axisManager.drawAxesGrid(
				mockCtx,
				[0, 1, 2, 3, 4, 5],
				50, 30, 400, 300,
				1, 1,
				vi.fn(),
				vi.fn(),
				vi.fn(),
				vi.fn(),
				mockFire
			);
			
			expect(mockCtx.fillText).not.toHaveBeenCalled();
			expect(mockFire).toHaveBeenCalledWith("drawAxes");
		});
	});

	describe('syncFontSizes', () => {
		it('should sync font sizes for all axes', () => {
			const axis = mockUplot.axes[0];
			axis.font = ['12px Arial', 12, 12];
			axis.labelFont = ['12px Arial', 12, 12];
			
			axisManager.syncFontSizes(2);
			
			// Font sizes should be updated based on pxRatio
			expect(axis.font[1]).toBeGreaterThan(12);
			expect(axis.labelFont[1]).toBeGreaterThan(12);
		});
	});
});