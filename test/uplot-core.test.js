/**
 * Unit tests for UPlotCore class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UPlotCore } from '../src/core/uplot-core.js';

describe('UPlotCore', () => {
	let container;
	
	beforeEach(() => {
		container = document.createElement('div');
	});
	
	afterEach(() => {
		// Clean up any global state
	});

	describe('Constructor', () => {
		it('should create a basic uPlot instance with minimal options', () => {
			const opts = {
				width: 800,
				height: 600,
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot).toBeDefined();
			expect(uplot.ready).toBe(true);
			expect(uplot.status).toBe(1);
			expect(uplot.width).toBe(800);
			expect(uplot.height).toBe(600);
		});

		it('should initialize with default mode 1', () => {
			const opts = { width: 800, height: 600 };
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.mode).toBe(1);
		});

		it('should respect custom mode setting', () => {
			const opts = { width: 800, height: 600, mode: 2 };
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.mode).toBe(2);
		});

		it('should initialize all manager instances', () => {
			const opts = { width: 800, height: 600 };
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.layout).toBeDefined();
			expect(uplot.scales).toBeDefined();
			expect(uplot.events).toBeDefined();
			expect(uplot.cursor).toBeDefined();
			expect(uplot.legend).toBeDefined();
			expect(uplot.series).toBeDefined();
			expect(uplot.axes).toBeDefined();
			expect(uplot.renderer).toBeDefined();
		});

		it('should create DOM structure', () => {
			const opts = { width: 800, height: 600 };
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.root).toBeDefined();
			expect(uplot.can).toBeDefined();
			expect(uplot.ctx).toBeDefined();
			expect(uplot.wrap).toBeDefined();
			expect(uplot.under).toBeDefined();
			expect(uplot.over).toBeDefined();
		});

		it('should set title when provided', () => {
			const opts = { 
				width: 800, 
				height: 600,
				title: 'Test Chart'
			};
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.opts.title).toBe('Test Chart');
		});

		it('should set id when provided', () => {
			const opts = { 
				width: 800, 
				height: 600,
				id: 'test-chart'
			};
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.opts.id).toBe('test-chart');
		});

		it('should process plugins during initialization', () => {
			const pluginOpts = vi.fn((u, opts) => ({ ...opts, processed: true }));
			const plugin = { opts: pluginOpts };
			
			const opts = { 
				width: 800, 
				height: 600,
				plugins: [plugin]
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			expect(pluginOpts).toHaveBeenCalledWith(uplot, expect.any(Object));
			expect(uplot.opts.processed).toBe(true);
		});
	});

	describe('setData', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should set data and update internal state', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			uplot.setData(data);
			
			expect(uplot.data).toEqual(data);
			expect(uplot._data).toEqual(data);
			expect(uplot.dataLen).toBe(5);
		});

		it('should handle null data by setting empty array', () => {
			uplot.setData(null);
			
			expect(uplot.data).toEqual([]);
			expect(uplot._data).toEqual([]);
		});

		it('should handle empty data array', () => {
			uplot.setData([]);
			
			expect(uplot.data).toEqual([[]]);
			expect(uplot._data).toEqual([[]]);
		});

		it('should fire setData event', () => {
			const firespy = vi.spyOn(uplot, 'fire');
			const data = [[1, 2, 3], [10, 20, 30]];
			
			uplot.setData(data);
			
			expect(firespy).toHaveBeenCalledWith('setData');
		});

		it('should reset scales by default', () => {
			const autoScaleXSpy = vi.spyOn(uplot.scalesManager, 'autoScaleX');
			const data = [[1, 2, 3], [10, 20, 30]];
			
			uplot.setData(data);
			
			expect(autoScaleXSpy).toHaveBeenCalled();
		});

		it('should not reset scales when resetScales is false', () => {
			const autoScaleXSpy = vi.spyOn(uplot.scalesManager, 'autoScaleX');
			const data = [[1, 2, 3], [10, 20, 30]];
			
			uplot.setData(data, false);
			
			expect(autoScaleXSpy).not.toHaveBeenCalled();
		});
	});

	describe('setSize', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should update chart dimensions', () => {
			uplot.setSize({ width: 1000, height: 800 });
			
			expect(uplot.width).toBe(1000);
			expect(uplot.height).toBe(800);
		});

		it('should trigger size convergence', () => {
			uplot.setSize({ width: 1000, height: 800 });
			
			expect(uplot.shouldConvergeSize).toBe(true);
			expect(uplot.shouldSetSize).toBe(true);
		});
	});

	describe('addSeries', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { 
				width: 800, 
				height: 600,
				cursor: { show: false }, // Disable cursor for these tests
				series: [
					{},
					{ label: 'Series 1' }
				]
			};
			uplot = new UPlotCore(opts, [], container);
		});

		it('should add a new series', () => {
			const initialCount = uplot.series.length;
			const seriesOpts = { label: 'New Series' };
			
			const index = uplot.addSeries(seriesOpts);
			
			expect(uplot.series.length).toBe(initialCount + 1);
			expect(typeof index).toBe('number');
		});

		it('should add series at specified index', () => {
			const seriesOpts = { label: 'Inserted Series' };
			
			const index = uplot.addSeries(seriesOpts, 1);
			
			expect(index).toBe(1);
		});
	});

	describe('delSeries', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { 
				width: 800, 
				height: 600,
				series: [
					{},
					{ label: 'Series 1' },
					{ label: 'Series 2' }
				]
			};
			uplot = new UPlotCore(opts, [], container);
		});

		it('should remove a series', () => {
			const initialCount = uplot.series.length;
			
			const index = uplot.delSeries(1);
			
			expect(uplot.series.length).toBe(initialCount - 1);
			expect(index).toBe(1);
		});
	});

	describe('setSeries', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { 
				width: 800, 
				height: 600,
				series: [
					{},
					{ label: 'Series 1', show: true }
				]
			};
			uplot = new UPlotCore(opts, [], container);
		});

		it('should update series configuration', () => {
			uplot.setSeries(1, { show: false });
			
			const series = uplot.series[1];
			expect(series.show).toBe(false);
		});

		it('should fire setSeries event by default', () => {
			const fireSpy = vi.spyOn(uplot, 'fire');
			
			uplot.setSeries(1, { show: false });
			
			expect(fireSpy).toHaveBeenCalledWith('setSeries', 1, { show: false });
		});

		it('should not fire event when _fire is false', () => {
			const fireSpy = vi.spyOn(uplot, 'fire');
			
			uplot.setSeries(1, { show: false }, false);
			
			expect(fireSpy).not.toHaveBeenCalledWith('setSeries', 1, { show: false });
		});
	});

	describe('setCursor', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should update cursor position', () => {
			const setCursorSpy = vi.spyOn(uplot.cursorManager, 'setCursor');
			
			uplot.setCursor({ left: 100, top: 200 });
			
			expect(setCursorSpy).toHaveBeenCalledWith({ left: 100, top: 200 }, undefined, undefined);
		});
	});

	describe('setLegend', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should update legend', () => {
			const setLegendSpy = vi.spyOn(uplot.legend, 'setLegend');
			
			uplot.setLegend({ idx: 5 });
			
			expect(setLegendSpy).toHaveBeenCalledWith({ idx: 5 }, undefined);
		});
	});

	describe('setSelect', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should update selection area', () => {
			const selectOpts = { left: 10, width: 100, top: 20, height: 200 };
			
			uplot.setSelect(selectOpts);
			
			expect(uplot.select.left).toBe(10);
			expect(uplot.select.width).toBe(100);
			expect(uplot.select.top).toBe(20);
			expect(uplot.select.height).toBe(200);
		});

		it('should set shouldSetSelect flag', () => {
			uplot.setSelect({ left: 10, width: 100 });
			
			expect(uplot.shouldSetSelect).toBe(true);
		});
	});

	describe('destroy', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should fire destroy event', () => {
			const fireSpy = vi.spyOn(uplot, 'fire');
			
			uplot.destroy();
			
			expect(fireSpy).toHaveBeenCalledWith('destroy');
		});

		it('should clean up managers', () => {
			const eventDestroySpy = vi.spyOn(uplot.events, 'destroy');
			const cursorDestroySpy = vi.spyOn(uplot.cursorManager, 'destroy');
			const legendDestroySpy = vi.spyOn(uplot.legend, 'destroy');
			
			uplot.destroy();
			
			expect(eventDestroySpy).toHaveBeenCalled();
			expect(cursorDestroySpy).toHaveBeenCalled();
			expect(legendDestroySpy).toHaveBeenCalled();
		});

		it('should reset ready and status flags', () => {
			uplot.destroy();
			
			expect(uplot.ready).toBe(false);
			expect(uplot.status).toBe(0);
		});
	});

	describe('Plugin System', () => {
		it('should support plugin hooks', () => {
			const hookFn = vi.fn();
			const opts = { 
				width: 800, 
				height: 600,
				hooks: {
					ready: [hookFn]
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			expect(hookFn).toHaveBeenCalledWith(uplot);
		});

		it('should support multiple hooks for same event', () => {
			const hookFn1 = vi.fn();
			const hookFn2 = vi.fn();
			const opts = { 
				width: 800, 
				height: 600,
				hooks: {
					ready: [hookFn1, hookFn2]
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			expect(hookFn1).toHaveBeenCalledWith(uplot);
			expect(hookFn2).toHaveBeenCalledWith(uplot);
		});
	});

	describe('Pixel Ratio', () => {
		it('should use default pixel ratio', () => {
			const opts = { width: 800, height: 600 };
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.pxRatio).toBe(1); // mocked value
		});

		it('should use custom pixel ratio from options', () => {
			const opts = { width: 800, height: 600, pxRatio: 2 };
			const uplot = new UPlotCore(opts, [], container);
			
			expect(uplot.pxRatio).toBe(2);
		});

		it('should update pixel ratio', () => {
			const opts = { width: 800, height: 600 };
			const uplot = new UPlotCore(opts, [], container);
			
			uplot.setPxRatio(2);
			
			expect(uplot.pxRatio).toBe(2);
		});
	});

	describe('Value/Position Conversion', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should delegate valToPosX to scales manager', () => {
			const valToPosXSpy = vi.spyOn(uplot.scalesManager, 'valToPosX');
			const xScale = uplot.scalesManager.scales.x;
			// Set up scale with proper min/max for testing
			xScale._min = 0;
			xScale._max = 100;
			
			uplot.valToPosX(10, xScale, 800, 0);
			
			expect(valToPosXSpy).toHaveBeenCalledWith(10, xScale, 800, 0);
		});

		it('should delegate valToPosY to scales manager', () => {
			const valToPosYSpy = vi.spyOn(uplot.scalesManager, 'valToPosY');
			const yScale = uplot.scalesManager.scales.y;
			// Set up scale with proper min/max for testing
			yScale._min = 0;
			yScale._max = 100;
			
			uplot.valToPosY(20, yScale, 600, 0);
			
			expect(valToPosYSpy).toHaveBeenCalledWith(20, yScale, 600, 0);
		});

		it('should delegate posToValX to scales manager', () => {
			const posToValXSpy = vi.spyOn(uplot.scalesManager, 'posToValX');
			// Set up scale with proper min/max for testing
			const xScale = uplot.scalesManager.scales.x;
			xScale._min = 0;
			xScale._max = 100;
			
			uplot.posToValX(100, true);
			
			expect(posToValXSpy).toHaveBeenCalledWith(100, true);
		});

		it('should delegate posToValY to scales manager', () => {
			const posToValYSpy = vi.spyOn(uplot.scalesManager, 'posToValY');
			// Set up scale with proper min/max for testing
			const yScale = uplot.scalesManager.scales.y;
			yScale._min = 0;
			yScale._max = 100;
			
			uplot.posToValY(200, 'y', false);
			
			expect(posToValYSpy).toHaveBeenCalledWith(200, 'y', false);
		});
	});

	describe('Layout Properties', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = { width: 800, height: 600 };
			uplot = new UPlotCore(opts, [], container);
		});

		it('should expose layout dimensions as properties', () => {
			expect(uplot.width).toBeDefined();
			expect(uplot.height).toBeDefined();
			expect(uplot.plotWidCss).toBeDefined();
			expect(uplot.plotHgtCss).toBeDefined();
			expect(uplot.plotLftCss).toBeDefined();
			expect(uplot.plotTopCss).toBeDefined();
			expect(uplot.plotLft).toBeDefined();
			expect(uplot.plotTop).toBeDefined();
			expect(uplot.plotWid).toBeDefined();
			expect(uplot.plotHgt).toBeDefined();
		});
	});
});
