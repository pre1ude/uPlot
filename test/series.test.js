/**
 * Unit tests for SeriesManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SeriesManager } from '../src/core/series.js';

// Mock dependencies
vi.mock('../src/utils', () => ({
	assign: Object.assign,
	fnOrSelf: (fn) => typeof fn === 'function' ? fn : () => fn,
	ifNull: (val, def) => val != null ? val : def,
	isStr: (val) => typeof val === 'string',
	max: Math.max,
	retNull: () => null,
	clamp: (val, min, max) => Math.min(Math.max(val, min), max),
	roundDec: (val, dec) => Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec),
	EMPTY_OBJ: {}
}));

vi.mock('../src/feats', () => ({
	FEAT_TIME: true,
	FEAT_PATHS: true,
	FEAT_POINTS: true
}));

vi.mock('../src/opts', () => ({
	xSeriesOpts: { scale: 'x' },
	ySeriesOpts: { scale: 'y' },
	xySeriesOpts: { scale: 'x' },
	timeSeriesVal: vi.fn(() => vi.fn()),
	numSeriesVal: vi.fn(),
	timeSeriesLabel: 'Time Label',
	numSeriesLabel: 'Numeric Label',
	timeSeriesStamp: vi.fn(() => ''),
	ptDia: vi.fn(() => 6)
}));

vi.mock('../src/paths/linear', () => ({
	linear: () => vi.fn()
}));

vi.mock('../src/paths/points', () => ({
	points: () => vi.fn()
}));

vi.mock('../src/paths/utils', () => ({
	seriesFillTo: vi.fn(),
	pxRoundGen: vi.fn(() => vi.fn())
}));

describe('SeriesManager', () => {
	let uplot;
	let scaleManager;
	let seriesManager;

	beforeEach(() => {
		// Mock uplot instance
		uplot = {
			mode: 1,
			fire: vi.fn(),
			pubSync: vi.fn(),
			opts: { pxAlign: 1 },
			pxRatio: 1
		};

		// Mock scale manager
		scaleManager = {
			scales: {
				x: { time: false },
				y: { time: false }
			}
		};

		seriesManager = new SeriesManager(uplot, scaleManager);
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			expect(seriesManager.uplot).toBe(uplot);
			expect(seriesManager.scaleManager).toBe(scaleManager);
			expect(seriesManager.series).toEqual([]);
			expect(seriesManager.mode).toBe(1);
		});

		it('should set up path generators', () => {
			expect(seriesManager.linearPath).toBeDefined();
			expect(seriesManager.pointsPath).toBeDefined();
		});
	});

	describe('initSeries', () => {
		it('should initialize series in mode 1', () => {
			const opts = {
				series: [
					{ scale: 'x' },
					{ scale: 'y', stroke: 'red' }
				]
			};

			const result = seriesManager.initSeries(opts, []);

			expect(result).toHaveLength(2);
			expect(result[0].scale).toBe('x');
			expect(result[1].scale).toBe('y');
			expect(result[1].stroke).toBeDefined();
			expect(uplot.series).toBe(result);
		});

		it('should initialize series in mode 2', () => {
			seriesManager.mode = 2;
			const opts = {
				series: [null, { scale: 'x' }]
			};

			const result = seriesManager.initSeries(opts, []);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({});
		});

		it('should handle empty series options', () => {
			const opts = {};
			const result = seriesManager.initSeries(opts, []);

			expect(result).toHaveLength(2); // Default x and y series
		});
	});

	describe('processSeriesConfig', () => {
		beforeEach(() => {
			uplot.focus = { prox: -1 };
			uplot.cursor = { points: { one: false } };
		});

		it('should configure time series correctly', () => {
			scaleManager.scales.y.time = true;
			const series = { scale: 'y', value: null };

			seriesManager.processSeriesConfig(series, 1);

			expect(series.value).toBeDefined();
			expect(series.label).toBe('Time Label');
		});

		it('should configure numeric series correctly', () => {
			const series = { scale: 'y', value: null };

			seriesManager.processSeriesConfig(series, 1);

			expect(series.value).toBeDefined();
			expect(series.label).toBe('Numeric Label');
		});

		it('should configure rendering properties for non-x-axis series', () => {
			const series = { scale: 'y' };

			seriesManager.processSeriesConfig(series, 1);

			expect(series.width).toBe(1);
			expect(series.paths).toBeDefined();
			expect(series.fillTo).toBeDefined();
			expect(series.pxAlign).toBe(1);
			expect(series.stroke).toBeDefined();
			expect(series.fill).toBeDefined();
			expect(series.points).toBeDefined();
		});

		it('should not configure rendering for x-axis series', () => {
			const series = { scale: 'x' };

			seriesManager.processSeriesConfig(series, 0);

			expect(series.width).toBeUndefined();
			expect(series.paths).toBeUndefined();
		});
	});

	describe('addSeries', () => {
		beforeEach(() => {
			seriesManager.series = [{ scale: 'x' }];
		});

		it('should add series at the end by default', () => {
			const opts = { scale: 'y', stroke: 'blue' };
			const index = seriesManager.addSeries(opts);

			expect(index).toBe(1);
			expect(seriesManager.series).toHaveLength(2);
			expect(seriesManager.series[1].scale).toBe('y');
			expect(uplot.fire).toHaveBeenCalledWith('addSeries', 1);
		});

		it('should add series at specified index', () => {
			seriesManager.series.push({ scale: 'y' });
			const opts = { scale: 'y2', stroke: 'green' };
			const index = seriesManager.addSeries(opts, 1);

			expect(index).toBe(1);
			expect(seriesManager.series).toHaveLength(3);
			expect(seriesManager.series[1].scale).toBe('y2');
		});
	});

	describe('delSeries', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ scale: 'y' },
				{ scale: 'y2' }
			];
		});

		it('should remove series at specified index', () => {
			const index = seriesManager.delSeries(1);

			expect(index).toBe(1);
			expect(seriesManager.series).toHaveLength(2);
			expect(seriesManager.series[1].scale).toBe('y2');
			expect(uplot.fire).toHaveBeenCalledWith('delSeries', 1);
		});
	});

	describe('setSeries', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ scale: 'y', show: true, alpha: 1 }
			];
		});

		it('should update series options', () => {
			seriesManager.setSeries(1, { show: false, alpha: 0.5 });

			expect(seriesManager.series[1].show).toBe(false);
			expect(seriesManager.series[1].alpha).toBe(0.5);
			expect(uplot.fire).toHaveBeenCalledWith('setSeries', 1, { show: false, alpha: 0.5 });
		});

		it('should handle focus changes', () => {
			seriesManager.setSeries(1, { focus: true });

			expect(seriesManager.series[1]._focus).toBe(true);
		});

		it('should handle null index for clearing focus', () => {
			seriesManager.series[1]._focus = true;
			seriesManager.setSeriesFocus(null, null);

			expect(seriesManager.series[1]._focus).toBeNull();
		});

		it('should not fire events when _fire is false', () => {
			uplot.fire.mockClear();
			seriesManager.setSeries(1, { show: false }, false);

			expect(uplot.fire).not.toHaveBeenCalled();
		});
	});

	describe('resetYSeries', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ scale: 'y', _paths: {} },
				{ scale: 'y2', _paths: {} }
			];
		});

		it('should reset paths for non-x-axis series', () => {
			seriesManager.resetYSeries(false);

			expect(seriesManager.series[0]._paths).toBeUndefined(); // x-axis unchanged (no _paths property)
			expect(seriesManager.series[1]._paths).toBeNull();
			expect(seriesManager.series[2]._paths).toBeNull();
		});
	});

	describe('getOuterIdxs', () => {
		it('should return clamped indices', () => {
			const ydata = [1, 2, null, 4, 5];
			const result = seriesManager.getOuterIdxs(ydata, 1, 3, 5);

			expect(result[0]).toBe(0); // clamped i0 - 1
			expect(result[1]).toBe(4); // clamped i1 + 1
		});

		it('should handle null values at boundaries', () => {
			const ydata = [null, null, 3, 4, null];
			const result = seriesManager.getOuterIdxs(ydata, 2, 3, 5);

			expect(result[0]).toBe(0); // clamped to boundary when all values before are null
			expect(result[1]).toBe(4); // clamped to boundary when all values after are null
		});
	});

	describe('cacheStrokeFill', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ 
					scale: 'y', 
					stroke: vi.fn(() => 'red'),
					fill: vi.fn(() => 'blue'),
					points: {
						stroke: vi.fn(() => 'green'),
						fill: vi.fn(() => 'yellow')
					}
				}
			];
		});

		it('should cache stroke and fill for series', () => {
			seriesManager.cacheStrokeFill(1, false);

			expect(seriesManager.series[1]._stroke).toBe('red');
			expect(seriesManager.series[1]._fill).toBe('blue');
		});

		it('should cache stroke and fill for points', () => {
			seriesManager.cacheStrokeFill(1, true);

			expect(seriesManager.series[1].points._stroke).toBe('green');
			expect(seriesManager.series[1].points._fill).toBe('yellow');
		});
	});

	describe('generateSeriesPaths', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ 
					scale: 'y',
					paths: vi.fn(() => ({ stroke: 'red' }))
				}
			];
		});

		it('should generate paths for series', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			const result = seriesManager.generateSeriesPaths(1, data, 1, 3, 5);

			expect(result).toEqual({ stroke: 'red' });
			expect(seriesManager.series[1].paths).toHaveBeenCalledWith(uplot, 1, 0, 4);
		});

		it('should return null for x-axis series', () => {
			const data = [[1, 2, 3]];
			const result = seriesManager.generateSeriesPaths(0, data, 0, 2, 3);

			expect(result).toBeNull();
		});
	});

	describe('utility methods', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x', show: true },
				{ scale: 'y', show: true, _focus: false },
				{ scale: 'y2', show: false, _focus: true }
			];
		});

		it('should check if any series has focus', () => {
			expect(seriesManager.hasFocusedSeries()).toBe(true);
		});

		it('should get series by index', () => {
			const series = seriesManager.getSeries(1);
			expect(series.scale).toBe('y');
		});

		it('should get all series', () => {
			const allSeries = seriesManager.getAllSeries();
			expect(allSeries).toHaveLength(3);
		});

		it('should get series count', () => {
			expect(seriesManager.getSeriesCount()).toBe(3);
		});

		it('should check if series is visible', () => {
			expect(seriesManager.isSeriesVisible(1)).toBe(true);
			expect(seriesManager.isSeriesVisible(2)).toBe(false);
		});

		it('should get visible series indices', () => {
			const visibleIndices = seriesManager.getVisibleSeriesIndices();
			expect(visibleIndices).toEqual([0, 1]);
		});
	});

	describe('updateSeriesForScaleChange', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x', _paths: {} },
				{ scale: 'y', _paths: {} },
				{ scale: 'y2', _paths: {} }
			];
		});

		it('should update series paths when their scale changes in mode 1', () => {
			seriesManager.updateSeriesForScaleChange({ y: true });

			expect(seriesManager.series[1]._paths).toBeNull();
			expect(seriesManager.series[2]._paths).toBeDefined(); // y2 scale not changed
		});

		it('should update series paths for y scale in mode 2', () => {
			seriesManager.mode = 2;
			seriesManager.updateSeriesForScaleChange({ y: true });

			expect(seriesManager.series[1]._paths).toBeNull();
			expect(seriesManager.series[2]._paths).toBeNull();
		});
	});

	describe('prepareSeriesForDraw', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ 
					scale: 'y', 
					show: true,
					stroke: vi.fn(() => 'red'),
					fill: vi.fn(() => 'blue'),
					paths: vi.fn(() => ({ stroke: 'red' })),
					points: { stroke: vi.fn(), fill: vi.fn() },
					_paths: null
				}
			];
		});

		it('should prepare visible series for drawing', () => {
			const data = [[1, 2, 3], [10, 20, 30]];
			const results = seriesManager.prepareSeriesForDraw(data, 0, 2, 3);

			expect(results).toHaveLength(1);
			expect(results[0].index).toBe(1);
			expect(results[0].series).toBe(seriesManager.series[1]);
			expect(results[0].paths).toBeDefined();
		});

		it('should skip hidden series', () => {
			seriesManager.series[1].show = false;
			const data = [[1, 2, 3], [10, 20, 30]];
			const results = seriesManager.prepareSeriesForDraw(data, 0, 2, 3);

			expect(results).toHaveLength(0);
		});
	});

	describe('getSeriesDrawInfo', () => {
		beforeEach(() => {
			seriesManager.series = [
				{ scale: 'x' },
				{ 
					scale: 'y',
					width: 2,
					pxAlign: 1,
					_stroke: 'red',
					_fill: 'blue',
					_paths: {
						stroke: 'green',
						fill: 'yellow',
						width: 3,
						flags: 1
					}
				}
			];
		});

		it('should return draw info for series', () => {
			const info = seriesManager.getSeriesDrawInfo(1, false);

			expect(info.strokeStyle).toBe('green');
			expect(info.fillStyle).toBe('yellow');
			expect(info.width).toBe(3);
			expect(info.flags).toBe(1);
			expect(info.pxAlign).toBe(1);
		});

		it('should return null for series without paths', () => {
			seriesManager.series[1]._paths = null;
			const info = seriesManager.getSeriesDrawInfo(1, false);

			expect(info).toBeNull();
		});
	});
});