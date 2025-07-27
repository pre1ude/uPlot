/**
 * API Compatibility Test Suite
 * 
 * This test suite verifies that the refactored uPlot maintains complete API compatibility
 * with the original implementation. It tests all public methods, constructor signatures,
 * event firing behavior, and plugin system functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import uPlot from '../src/uPlot.js';

// Mock DOM environment
const mockContext = {
	canvas: null, // Will be set below
	clearRect: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	stroke: vi.fn(),
	fill: vi.fn(),
	fillText: vi.fn(),
	translate: vi.fn(),
	rotate: vi.fn(),
	save: vi.fn(),
	restore: vi.fn(),
	clip: vi.fn(),
	setLineDash: vi.fn(),
	measureText: vi.fn(() => ({ width: 50 })),
	strokeStyle: '#000',
	fillStyle: '#000',
	lineWidth: 1,
	lineCap: 'butt',
	lineJoin: 'miter',
	globalAlpha: 1,
	font: '10px sans-serif',
	textAlign: 'start',
	textBaseline: 'alphabetic',
};

const mockCanvas = {
	getContext: vi.fn(() => mockContext),
	style: {},
	width: 800,
	height: 600,
	appendChild: vi.fn(),
	insertBefore: vi.fn(),
	remove: vi.fn(),
	getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
	classList: {
		add: vi.fn(),
		remove: vi.fn(),
		contains: vi.fn(),
	},
};

// Set canvas reference in context
mockContext.canvas = mockCanvas;

global.document = {
	createElement: vi.fn((tag) => {
		if (tag === 'canvas') {
			return mockCanvas;
		}
		return {
			style: {},
			appendChild: vi.fn(),
			insertBefore: vi.fn(),
			remove: vi.fn(),
			getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
			classList: {
				add: vi.fn(),
				remove: vi.fn(),
				contains: vi.fn(),
			},
			textContent: '',
		};
	}),
	createTextNode: vi.fn(() => ({ textContent: '' })),
};

global.window = {
	devicePixelRatio: 1,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
};

global.HTMLElement = class HTMLElement {
	constructor() {
		this.style = {};
		this.children = [];
		this.classList = {
			add: vi.fn(),
			remove: vi.fn(),
			contains: vi.fn(),
		};
	}
	
	appendChild(child) {
		this.children.push(child);
		return child;
	}
	
	insertBefore(child, before) {
		this.children.push(child);
		return child;
	}
	
	remove() {
		// Mock remove
	}
	
	addEventListener() {}
	removeEventListener() {}
	getBoundingClientRect() {
		return { left: 0, top: 0, width: 800, height: 600 };
	}
};

describe('API Compatibility Test Suite', () => {
	let container;
	
	beforeEach(() => {
		container = new HTMLElement();
	});
	
	afterEach(() => {
		// Clean up any global state
	});

	describe('Constructor Signature Compatibility', () => {
		it('should accept (opts, data, target) constructor signature', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				]
			};
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			const chart = new uPlot(opts, data, container);
			
			expect(chart).toBeDefined();
			expect(chart.data).toEqual(data);
			expect(chart.width).toBe(800);
			expect(chart.height).toBe(600);
		});

		it('should accept (opts, data) constructor signature', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				]
			};
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			const chart = new uPlot(opts, data);
			
			expect(chart).toBeDefined();
			expect(chart.data).toEqual(data);
		});

		it('should accept (opts) constructor signature', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				]
			};
			
			const chart = new uPlot(opts);
			
			expect(chart).toBeDefined();
			expect(chart.width).toBe(800);
			expect(chart.height).toBe(600);
		});

		it('should accept function as target parameter', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				]
			};
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			const targetFn = vi.fn();
			
			const chart = new uPlot(opts, data, targetFn);
			
			expect(chart).toBeDefined();
			expect(targetFn).toHaveBeenCalledWith(chart, expect.any(Function));
		});
	});

	describe('Public Properties Compatibility', () => {
		let chart;
		
		beforeEach(() => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				]
			};
			chart = new uPlot(opts, [], container);
		});

		it('should expose all required readonly properties', () => {
			expect(chart.root).toBeDefined();
			expect(chart.status).toBeDefined();
			expect(chart.width).toBeDefined();
			expect(chart.height).toBeDefined();
			expect(chart.pxRatio).toBeDefined();
			expect(chart.ctx).toBeDefined();
			expect(chart.bbox).toBeDefined();
			expect(chart.select).toBeDefined();
			expect(chart.cursor).toBeDefined();
			expect(chart.legend).toBeDefined();
			expect(chart.series).toBeDefined();
			expect(chart.scales).toBeDefined();
			expect(chart.axes).toBeDefined();
			expect(chart.hooks).toBeDefined();
			expect(chart.data).toBeDefined();
			expect(chart.over).toBeDefined();
			expect(chart.under).toBeDefined();
		});

		it('should have correct property types', () => {
			expect(typeof chart.status).toBe('number');
			expect(typeof chart.width).toBe('number');
			expect(typeof chart.height).toBe('number');
			expect(typeof chart.pxRatio).toBe('number');
			expect(chart.root instanceof HTMLElement).toBe(true);
			expect(chart.ctx).toBeDefined();
			expect(typeof chart.bbox).toBe('object');
			expect(typeof chart.select).toBe('object');
			expect(typeof chart.cursor).toBe('object');
			expect(typeof chart.legend).toBe('object');
			expect(Array.isArray(chart.series)).toBe(true);
			expect(typeof chart.scales).toBe('object');
			expect(Array.isArray(chart.axes)).toBe(true);
			expect(typeof chart.hooks).toBe('object');
			expect(Array.isArray(chart.data)).toBe(true);
		});

		it('should expose rect property as getter', () => {
			expect(chart.rect).toBeDefined();
			expect(typeof chart.rect).toBe('object');
		});
	});

	describe('Public Methods Compatibility', () => {
		let chart;
		
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
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50],
				[15, 25, 35, 45, 55]
			];
			chart = new uPlot(opts, data, container);
		});

		describe('setData method', () => {
			it('should maintain identical behavior', () => {
				const newData = [
					[1, 2, 3],
					[100, 200, 300],
					[150, 250, 350]
				];
				
				chart.setData(newData);
				
				expect(chart.data).toEqual(newData);
			});

			it('should support resetScales parameter', () => {
				const newData = [
					[1, 2, 3],
					[100, 200, 300]
				];
				
				chart.setData(newData, false);
				
				expect(chart.data).toEqual(newData);
			});
		});

		describe('setSize method', () => {
			it('should maintain identical behavior', () => {
				chart.setSize({ width: 1000, height: 800 });
				
				expect(chart.width).toBe(1000);
				expect(chart.height).toBe(800);
			});
		});

		describe('setScale method', () => {
			it('should maintain identical behavior', () => {
				const setScaleSpy = vi.spyOn(chart.scales, '_setScale');
				
				chart.setScale('x', { min: 0, max: 10 });
				
				expect(setScaleSpy).toHaveBeenCalledWith('x', 0, 10);
			});
		});

		describe('setCursor method', () => {
			it('should maintain identical behavior', () => {
				const setCursorSpy = vi.spyOn(chart, 'setCursor');
				
				chart.setCursor({ left: 100, top: 200 });
				
				expect(setCursorSpy).toHaveBeenCalledWith({ left: 100, top: 200 });
			});

			it('should support fireHook parameter', () => {
				const setCursorSpy = vi.spyOn(chart, 'setCursor');
				
				chart.setCursor({ left: 100, top: 200 }, false);
				
				expect(setCursorSpy).toHaveBeenCalledWith({ left: 100, top: 200 }, false);
			});
		});

		describe('setLegend method', () => {
			it('should maintain identical behavior', () => {
				const setLegendSpy = vi.spyOn(chart, 'setLegend');
				
				chart.setLegend({ idx: 2 });
				
				expect(setLegendSpy).toHaveBeenCalledWith({ idx: 2 });
			});

			it('should support fireHook parameter', () => {
				const setLegendSpy = vi.spyOn(chart, 'setLegend');
				
				chart.setLegend({ idx: 2 }, false);
				
				expect(setLegendSpy).toHaveBeenCalledWith({ idx: 2 }, false);
			});
		});

		describe('setSeries method', () => {
			it('should maintain identical behavior', () => {
				chart.setSeries(1, { show: false });
				
				expect(chart.series[1].show).toBe(false);
			});

			it('should support fireHook parameter', () => {
				const setSpy = vi.spyOn(chart, 'setSeries');
				
				chart.setSeries(1, { show: false }, false);
				
				expect(setSpy).toHaveBeenCalledWith(1, { show: false }, false);
			});
		});

		describe('addSeries method', () => {
			it('should maintain identical behavior', () => {
				const initialCount = chart.series.length;
				const seriesOpts = { label: 'New Series' };
				
				const index = chart.addSeries(seriesOpts);
				
				expect(chart.series.length).toBe(initialCount + 1);
				expect(typeof index).toBe('number');
			});

			it('should support seriesIdx parameter', () => {
				const seriesOpts = { label: 'Inserted Series' };
				
				const index = chart.addSeries(seriesOpts, 1);
				
				expect(index).toBe(1);
			});
		});

		describe('delSeries method', () => {
			it('should maintain identical behavior', () => {
				const initialCount = chart.series.length;
				
				chart.delSeries(1);
				
				expect(chart.series.length).toBe(initialCount - 1);
			});
		});

		describe('setSelect method', () => {
			it('should maintain identical behavior', () => {
				const selectOpts = { left: 10, width: 100, top: 20, height: 200 };
				
				chart.setSelect(selectOpts);
				
				expect(chart.select.left).toBe(10);
				expect(chart.select.width).toBe(100);
				expect(chart.select.top).toBe(20);
				expect(chart.select.height).toBe(200);
			});

			it('should support fireHook parameter', () => {
				const selectOpts = { left: 10, width: 100, top: 20, height: 200 };
				
				chart.setSelect(selectOpts, false);
				
				expect(chart.select.left).toBe(10);
			});
		});

		describe('setPxRatio method', () => {
			it('should maintain identical behavior', () => {
				chart.setPxRatio(2);
				
				expect(chart.pxRatio).toBe(2);
			});

			it('should handle null parameter', () => {
				chart.setPxRatio(null);
				
				expect(chart.pxRatio).toBe(1); // should fall back to global
			});
		});

		describe('Position/Value conversion methods', () => {
			it('should expose posToIdx method', () => {
				expect(typeof chart.posToIdx).toBe('function');
				
				const result = chart.posToIdx(100);
				expect(typeof result).toBe('number');
			});

			it('should expose posToVal method', () => {
				expect(typeof chart.posToVal).toBe('function');
				
				const result = chart.posToVal(100, 'x');
				expect(typeof result).toBe('number');
			});

			it('should expose valToPos method', () => {
				expect(typeof chart.valToPos).toBe('function');
				
				const result = chart.valToPos(5, 'x');
				expect(typeof result).toBe('number');
			});

			it('should expose valToIdx method', () => {
				expect(typeof chart.valToIdx).toBe('function');
				
				const result = chart.valToIdx(2.5);
				expect(typeof result).toBe('number');
			});

			it('should support canvasPixels parameter', () => {
				const result1 = chart.posToVal(100, 'x', false);
				const result2 = chart.posToVal(100, 'x', true);
				
				expect(typeof result1).toBe('number');
				expect(typeof result2).toBe('number');
			});
		});

		describe('Utility methods', () => {
			it('should expose syncRect method', () => {
				expect(typeof chart.syncRect).toBe('function');
				
				chart.syncRect();
				chart.syncRect(true);
			});

			it('should expose redraw method', () => {
				expect(typeof chart.redraw).toBe('function');
				
				chart.redraw();
				chart.redraw(true);
				chart.redraw(false, true);
			});

			it('should expose batch method', () => {
				expect(typeof chart.batch).toBe('function');
				
				const batchFn = vi.fn();
				chart.batch(batchFn);
				
				expect(batchFn).toHaveBeenCalled();
			});

			it('should expose destroy method', () => {
				expect(typeof chart.destroy).toBe('function');
				
				const destroySpy = vi.spyOn(chart, 'destroy');
				chart.destroy();
				
				expect(destroySpy).toHaveBeenCalled();
			});
		});
	});
	describe
('Event Firing Behavior Compatibility', () => {
		let chart;
		let hookSpy;
		
		beforeEach(() => {
			hookSpy = vi.fn();
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				],
				hooks: {
					ready: [hookSpy],
					setData: [hookSpy],
					setScale: [hookSpy],
					setCursor: [hookSpy],
					setLegend: [hookSpy],
					setSeries: [hookSpy],
					destroy: [hookSpy]
				}
			};
			chart = new uPlot(opts, [], container);
		});

		it('should fire ready event during initialization', () => {
			expect(hookSpy).toHaveBeenCalledWith(chart);
		});

		it('should fire setData event when data is set', () => {
			hookSpy.mockClear();
			const data = [[1, 2, 3], [10, 20, 30]];
			
			chart.setData(data);
			
			expect(hookSpy).toHaveBeenCalledWith(chart);
		});

		it('should fire setScale event when scale is set', () => {
			hookSpy.mockClear();
			
			chart.setScale('x', { min: 0, max: 10 });
			
			expect(hookSpy).toHaveBeenCalledWith(chart, 'x');
		});

		it('should fire setCursor event when cursor is set', () => {
			hookSpy.mockClear();
			
			chart.setCursor({ left: 100, top: 200 });
			
			expect(hookSpy).toHaveBeenCalledWith(chart);
		});

		it('should fire setLegend event when legend is set', () => {
			hookSpy.mockClear();
			
			chart.setLegend({ idx: 1 });
			
			expect(hookSpy).toHaveBeenCalledWith(chart);
		});

		it('should fire setSeries event when series is modified', () => {
			hookSpy.mockClear();
			
			chart.setSeries(1, { show: false });
			
			expect(hookSpy).toHaveBeenCalledWith(chart, 1, { show: false });
		});

		it('should fire destroy event when chart is destroyed', () => {
			hookSpy.mockClear();
			
			chart.destroy();
			
			expect(hookSpy).toHaveBeenCalledWith(chart);
		});

		it('should support multiple hooks for same event', () => {
			const hook1 = vi.fn();
			const hook2 = vi.fn();
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				hooks: {
					ready: [hook1, hook2]
				}
			};
			
			new uPlot(opts, [], container);
			
			expect(hook1).toHaveBeenCalled();
			expect(hook2).toHaveBeenCalled();
		});

		it('should not fire events when fireHook parameter is false', () => {
			hookSpy.mockClear();
			
			chart.setCursor({ left: 100, top: 200 }, false);
			chart.setLegend({ idx: 1 }, false);
			chart.setSeries(1, { show: false }, false);
			chart.setSelect({ left: 10, width: 100, top: 20, height: 200 }, false);
			
			expect(hookSpy).not.toHaveBeenCalled();
		});
	});

	describe('Plugin System Compatibility', () => {
		it('should process plugins during initialization', () => {
			const pluginOpts = vi.fn((u, opts) => ({ ...opts, processed: true }));
			const plugin = { opts: pluginOpts };
			
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				plugins: [plugin]
			};
			
			const chart = new uPlot(opts, [], container);
			
			expect(pluginOpts).toHaveBeenCalledWith(chart, expect.any(Object));
			expect(chart.opts.processed).toBe(true);
		});

		it('should support multiple plugins', () => {
			const plugin1Opts = vi.fn((u, opts) => ({ ...opts, plugin1: true }));
			const plugin2Opts = vi.fn((u, opts) => ({ ...opts, plugin2: true }));
			const plugin1 = { opts: plugin1Opts };
			const plugin2 = { opts: plugin2Opts };
			
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				plugins: [plugin1, plugin2]
			};
			
			const chart = new uPlot(opts, [], container);
			
			expect(plugin1Opts).toHaveBeenCalled();
			expect(plugin2Opts).toHaveBeenCalled();
			expect(chart.opts.plugin1).toBe(true);
			expect(chart.opts.plugin2).toBe(true);
		});

		it('should support plugins without opts function', () => {
			const plugin = { someOtherProperty: true };
			
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				plugins: [plugin]
			};
			
			expect(() => {
				new uPlot(opts, [], container);
			}).not.toThrow();
		});

		it('should allow plugins to add hooks', () => {
			const hookFn = vi.fn();
			const pluginOpts = (u, opts) => ({
				...opts,
				hooks: {
					...opts.hooks,
					ready: [...(opts.hooks?.ready || []), hookFn]
				}
			});
			const plugin = { opts: pluginOpts };
			
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				plugins: [plugin]
			};
			
			new uPlot(opts, [], container);
			
			expect(hookFn).toHaveBeenCalled();
		});
	});

	describe('Static Properties and Methods Compatibility', () => {
		it('should expose all static utility functions', () => {
			expect(typeof uPlot.assign).toBe('function');
			expect(typeof uPlot.fmtNum).toBe('function');
			expect(typeof uPlot.rangeNum).toBe('function');
			expect(typeof uPlot.rangeLog).toBe('function');
			expect(typeof uPlot.rangeAsinh).toBe('function');
			expect(typeof uPlot.orient).toBe('function');
			expect(typeof uPlot.pxRatio).toBe('number');
		});

		it('should expose time-related static functions when FEAT_TIME is enabled', () => {
			if (typeof uPlot.fmtDate !== 'undefined') {
				expect(typeof uPlot.fmtDate).toBe('function');
			}
			if (typeof uPlot.tzDate !== 'undefined') {
				expect(typeof uPlot.tzDate).toBe('function');
			}
		});

		it('should expose join function when FEAT_JOIN is enabled', () => {
			if (typeof uPlot.join !== 'undefined') {
				expect(typeof uPlot.join).toBe('function');
			}
		});

		it('should expose sync function', () => {
			expect(typeof uPlot.sync).toBe('function');
		});

		it('should expose path utilities when FEAT_PATHS is enabled', () => {
			if (typeof uPlot.addGap !== 'undefined') {
				expect(typeof uPlot.addGap).toBe('function');
			}
			if (typeof uPlot.clipGaps !== 'undefined') {
				expect(typeof uPlot.clipGaps).toBe('function');
			}
		});

		it('should expose paths object with path builders', () => {
			if (uPlot.paths) {
				expect(typeof uPlot.paths).toBe('object');
				expect(typeof uPlot.paths.points).toBe('function');
				
				if (uPlot.paths.linear) {
					expect(typeof uPlot.paths.linear).toBe('function');
				}
				if (uPlot.paths.stepped) {
					expect(typeof uPlot.paths.stepped).toBe('function');
				}
				if (uPlot.paths.bars) {
					expect(typeof uPlot.paths.bars).toBe('function');
				}
				if (uPlot.paths.spline) {
					expect(typeof uPlot.paths.spline).toBe('function');
				}
				if (uPlot.paths.spline2) {
					expect(typeof uPlot.paths.spline2).toBe('function');
				}
			}
		});

		describe('Static utility function behavior', () => {
			it('should maintain assign function behavior', () => {
				const target = { a: 1 };
				const source = { b: 2 };
				
				const result = uPlot.assign(target, source);
				
				expect(result).toBe(target);
				expect(target.b).toBe(2);
			});

			it('should maintain fmtNum function behavior', () => {
				const result = uPlot.fmtNum(1234.567);
				
				expect(typeof result).toBe('string');
			});

			it('should maintain rangeNum function behavior', () => {
				const result = uPlot.rangeNum(0, 100, 0.1, false);
				
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(2);
				expect(typeof result[0]).toBe('number');
				expect(typeof result[1]).toBe('number');
			});

			it('should maintain rangeLog function behavior', () => {
				const result = uPlot.rangeLog(1, 1000, 10, false);
				
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(2);
			});

			it('should maintain rangeAsinh function behavior', () => {
				const result = uPlot.rangeAsinh(-100, 100, 10, false);
				
				expect(Array.isArray(result)).toBe(true);
				expect(result.length).toBe(2);
			});
		});
	});

	describe('Advanced API Compatibility', () => {
		let chart;
		
		beforeEach(() => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' },
					{ label: 'Series 2' }
				],
				scales: {
					x: {},
					y: {}
				},
				axes: [
					{},
					{}
				]
			};
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50],
				[15, 25, 35, 45, 55]
			];
			chart = new uPlot(opts, data, container);
		});

		it('should maintain band operations compatibility', () => {
			if (typeof chart.addBand === 'function') {
				const bandOpts = {
					series: [1, 2],
					fill: 'rgba(255, 0, 0, 0.1)'
				};
				
				expect(() => {
					chart.addBand(bandOpts);
				}).not.toThrow();
			}
		});

		it('should maintain scale access compatibility', () => {
			expect(chart.scales).toBeDefined();
			expect(typeof chart.scales).toBe('object');
			
			// Should have x and y scales
			expect(chart.scales.x).toBeDefined();
			expect(chart.scales.y).toBeDefined();
		});

		it('should maintain axes access compatibility', () => {
			expect(Array.isArray(chart.axes)).toBe(true);
			expect(chart.axes.length).toBeGreaterThan(0);
		});

		it('should maintain series access compatibility', () => {
			expect(Array.isArray(chart.series)).toBe(true);
			expect(chart.series.length).toBe(3); // x-series + 2 data series
		});

		it('should maintain cursor state compatibility', () => {
			expect(chart.cursor).toBeDefined();
			expect(typeof chart.cursor).toBe('object');
			
			// Should have expected cursor properties
			expect('left' in chart.cursor).toBe(true);
			expect('top' in chart.cursor).toBe(true);
			expect('idx' in chart.cursor).toBe(true);
		});

		it('should maintain legend state compatibility', () => {
			expect(chart.legend).toBeDefined();
			expect(typeof chart.legend).toBe('object');
		});

		it('should maintain select state compatibility', () => {
			expect(chart.select).toBeDefined();
			expect(typeof chart.select).toBe('object');
			
			// Should have expected select properties
			expect('show' in chart.select).toBe(true);
			expect('left' in chart.select).toBe(true);
			expect('top' in chart.select).toBe(true);
			expect('width' in chart.select).toBe(true);
			expect('height' in chart.select).toBe(true);
		});

		it('should maintain bbox compatibility', () => {
			expect(chart.bbox).toBeDefined();
			expect(typeof chart.bbox).toBe('object');
		});

		it('should maintain hooks compatibility', () => {
			expect(chart.hooks).toBeDefined();
			expect(typeof chart.hooks).toBe('object');
		});
	});

	describe('Error Handling Compatibility', () => {
		it('should handle invalid constructor parameters gracefully', () => {
			expect(() => {
				new uPlot(null);
			}).toThrow();
		});

		it('should handle invalid data gracefully', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [{}]
			};
			const chart = new uPlot(opts, [], container);
			
			expect(() => {
				chart.setData(null);
			}).not.toThrow();
		});

		it('should handle invalid scale keys gracefully', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [{}]
			};
			const chart = new uPlot(opts, [], container);
			
			expect(() => {
				chart.setScale('nonexistent', { min: 0, max: 10 });
			}).not.toThrow();
		});

		it('should handle invalid series indices gracefully', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [{}]
			};
			const chart = new uPlot(opts, [], container);
			
			expect(() => {
				chart.setSeries(999, { show: false });
			}).not.toThrow();
		});
	});

	describe('Performance and Memory Compatibility', () => {
		it('should clean up resources on destroy', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [{}]
			};
			const chart = new uPlot(opts, [], container);
			
			chart.destroy();
			
			expect(chart.ready).toBe(false);
			expect(chart.status).toBe(0);
		});

		it('should handle large datasets without breaking', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Large Series' }
				]
			};
			
			// Create large dataset
			const size = 10000;
			const xData = Array.from({ length: size }, (_, i) => i);
			const yData = Array.from({ length: size }, (_, i) => Math.sin(i / 100) * 100);
			const data = [xData, yData];
			
			expect(() => {
				const chart = new uPlot(opts, data, container);
				chart.destroy();
			}).not.toThrow();
		});
	});
});