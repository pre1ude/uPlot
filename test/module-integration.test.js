/**
 * Integration tests for module interactions in uPlot
 * Tests complete uPlot initialization, data flow between modules, and event propagation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Date.now to return a consistent timestamp for testing
const mockNow = 1609459200000; // 2021-01-01 00:00:00 UTC
global.Date.now = vi.fn(() => mockNow);
import { UPlotCore } from '../src/core/uplot-core.js';

// Mock DOM environment
const createMockContext = () => ({
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
	createLinearGradient: vi.fn(() => ({
		addColorStop: vi.fn()
	})),
	setTransform: vi.fn(),
	resetTransform: vi.fn(),
	strokeStyle: '',
	fillStyle: '',
	lineWidth: 1,
	globalAlpha: 1,
	font: '12px sans-serif',
	textAlign: 'start',
	textBaseline: 'alphabetic',
});

const createMockCanvas = () => ({
	getContext: vi.fn(() => createMockContext()),
	style: {},
	width: 800,
	height: 600,
	appendChild: vi.fn(),
	insertBefore: vi.fn(),
	remove: vi.fn(),
	getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	classList: {
		add: vi.fn(),
		remove: vi.fn(),
		contains: vi.fn(),
	},
});

const createMockElement = () => ({
	style: {},
	appendChild: vi.fn(),
	insertBefore: vi.fn(),
	remove: vi.fn(),
	getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	classList: {
		add: vi.fn(),
		remove: vi.fn(),
		contains: vi.fn(),
	},
	children: [],
});

// Override jsdom's canvas implementation
Object.defineProperty(global.HTMLCanvasElement.prototype, 'getContext', {
	value: vi.fn(() => createMockContext()),
	writable: true,
});

global.document = {
	createElement: vi.fn((tag) => {
		if (tag === 'canvas') {
			return createMockCanvas();
		}
		return createMockElement();
	}),
	createTextNode: vi.fn(() => ({ textContent: '' })),
};

global.window = {
	devicePixelRatio: 1,
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	getComputedStyle: vi.fn(() => ({
		getPropertyValue: vi.fn(() => '16px'),
	})),
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

describe('Module Integration Tests', () => {
	let container;
	
	beforeEach(() => {
		container = new HTMLElement();
		vi.clearAllMocks();
	});
	
	afterEach(() => {
		// Clean up any global state
	});

	describe('Complete uPlot Initialization', () => {
		it('should initialize all modules in correct order', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1', stroke: 'red' }
				],
				axes: [
					{},
					{ label: 'Y Axis' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			const uplot = new UPlotCore(opts, data, container);
			
			// Verify all managers are initialized
			expect(uplot.layout).toBeDefined();
			expect(uplot.scales).toBeDefined();
			expect(uplot.events).toBeDefined();
			expect(uplot.cursor).toBeDefined();
			expect(uplot.legend).toBeDefined();
			expect(uplot.series).toBeDefined();
			expect(uplot.axes).toBeDefined();
			expect(uplot.renderer).toBeDefined();
			
			// Verify initialization state
			expect(uplot.ready).toBe(true);
			expect(uplot.status).toBe(1);
			
			// Verify data is set
			expect(uplot.data).toEqual(data);
			expect(uplot.dataLen).toBe(5);
		});

		it('should create proper DOM structure with all elements', () => {
			const opts = {
				width: 800,
				height: 600,
				title: 'Test Chart',
				series: [{}],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			// Verify DOM elements are created
			expect(uplot.root).toBeDefined();
			expect(uplot.can).toBeDefined();
			expect(uplot.ctx).toBeDefined();
			expect(uplot.wrap).toBeDefined();
			expect(uplot.under).toBeDefined();
			expect(uplot.over).toBeDefined();
			
			// Verify canvas context is available
			expect(uplot.ctx.clearRect).toBeDefined();
			expect(uplot.ctx.beginPath).toBeDefined();
		});

		it('should handle complex configuration with multiple series and axes', () => {
			const opts = {
				width: 1000,
				height: 800,
				title: 'Complex Chart',
				series: [
					{},
					{ 
						label: 'Temperature', 
						stroke: 'red', 
						scale: 'temp'
					},
					{ 
						label: 'Humidity', 
						stroke: 'blue', 
						scale: 'humidity'
					}
				],
				axes: [
					{ label: 'Index' },
					{ 
						label: 'Temperature (°C)', 
						scale: 'temp',
						stroke: 'red'
					},
					{ 
						label: 'Humidity (%)', 
						scale: 'humidity',
						stroke: 'blue',
						side: 1
					}
				],
				scales: {
					x: { time: false },
					temp: { range: [0, 100] },
					humidity: { range: [0, 100] }
				}
			};
			
			const data = [
				[1, 2, 3, 4],
				[20, 25, 30, 28],
				[45, 50, 55, 52]
			];
			
			const uplot = new UPlotCore(opts, data, container);
			
			expect(uplot.ready).toBe(true);
			expect(uplot.series.getSeriesCount()).toBe(3);
			expect(uplot.axes.getAxesCount()).toBe(3);
		});
	});

	describe('Data Flow Between Modules', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1', stroke: 'red' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			uplot = new UPlotCore(opts, [], container);
		});

		it('should propagate data changes through all relevant modules', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			// Spy on module methods that should be called during data update
			const scalesAutoScaleXSpy = vi.spyOn(uplot.scales, 'autoScaleX');
			const rendererDrawSpy = vi.spyOn(uplot.renderer, 'draw');
			const fireSpy = vi.spyOn(uplot, 'fire');
			
			uplot.setData(data);
			
			// Verify data propagation
			expect(uplot.data).toEqual(data);
			expect(uplot.dataLen).toBe(5);
			
			// Verify modules are updated
			expect(scalesAutoScaleXSpy).toHaveBeenCalled();
			expect(rendererDrawSpy).toHaveBeenCalled();
			expect(fireSpy).toHaveBeenCalledWith('setData');
		});

		it('should handle scale updates and propagate to dependent modules', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			uplot.setData(data);
			
			// Update scale range
			const scaleOpts = { min: 0, max: 100 };
			const updateScaleSpy = vi.spyOn(uplot.scales, 'updateScale');
			const rendererDrawSpy = vi.spyOn(uplot.renderer, 'draw');
			
			uplot.scales.updateScale('y', scaleOpts);
			
			expect(updateScaleSpy).toHaveBeenCalledWith('y', scaleOpts);
			// Renderer should be called for redraw after scale update
			expect(rendererDrawSpy).toHaveBeenCalled();
		});

		it('should coordinate series changes across modules', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50],
				[15, 25, 35, 45, 55]
			];
			
			uplot.setData(data);
			
			// Add a new series
			const seriesOpts = { label: 'New Series', stroke: 'green' };
			const addSeriesSpy = vi.spyOn(uplot.series, 'addSeries');
			const legendUpdateSpy = vi.spyOn(uplot.legend, 'updateLegend');
			
			const index = uplot.addSeries(seriesOpts);
			
			expect(addSeriesSpy).toHaveBeenCalledWith(seriesOpts, index);
			expect(legendUpdateSpy).toHaveBeenCalled();
			expect(typeof index).toBe('number');
		});

		it('should handle cursor updates and coordinate with legend', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			uplot.setData(data);
			
			const cursorPos = { left: 100, top: 200 };
			const setCursorSpy = vi.spyOn(uplot.cursor, 'setCursor');
			const legendSetSpy = vi.spyOn(uplot.legend, 'setLegend');
			
			uplot.setCursor(cursorPos);
			
			expect(setCursorSpy).toHaveBeenCalledWith(cursorPos, undefined, undefined);
			// Legend should be updated when cursor moves
			expect(legendSetSpy).toHaveBeenCalled();
		});
	});

	describe('Event Propagation Across Modules', () => {
		let uplot;
		
		beforeEach(() => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1', stroke: 'red' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				},
				hooks: {
					ready: [],
					setData: [],
					setCursor: [],
					setLegend: []
				}
			};
			
			uplot = new UPlotCore(opts, [], container);
		});

		it('should fire events in correct sequence during initialization', () => {
			const events = [];
			const originalFire = uplot.fire;
			
			uplot.fire = vi.fn((event, ...args) => {
				events.push(event);
				return originalFire.call(uplot, event, ...args);
			});
			
			// Trigger a data update to see event sequence
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			uplot.setData(data);
			
			expect(events).toContain('setData');
		});

		it('should propagate mouse events through event system to cursor and legend', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			uplot.setData(data);
			
			// Mock mouse event
			const mouseEvent = {
				clientX: 150,
				clientY: 100,
				target: uplot.over
			};
			
			const eventMouseMoveSpy = vi.spyOn(uplot.events, 'mouseMove');
			const cursorUpdateSpy = vi.spyOn(uplot.cursor, 'updateCursor');
			
			// Simulate mouse move
			uplot.events.mouseMove(mouseEvent, null, 150, 100);
			
			expect(eventMouseMoveSpy).toHaveBeenCalled();
			expect(cursorUpdateSpy).toHaveBeenCalled();
		});

		it('should handle resize events and coordinate layout updates', () => {
			const newSize = { width: 1000, height: 800 };
			
			const layoutUpdateSpy = vi.spyOn(uplot.layout, 'updateLayout');
			const rendererDrawSpy = vi.spyOn(uplot.renderer, 'draw');
			
			uplot.setSize(newSize);
			
			expect(uplot.width).toBe(1000);
			expect(uplot.height).toBe(800);
			expect(layoutUpdateSpy).toHaveBeenCalled();
			expect(rendererDrawSpy).toHaveBeenCalled();
		});

		it('should coordinate selection events across modules', () => {
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			uplot.setData(data);
			
			const selectOpts = {
				left: 50,
				width: 200,
				top: 30,
				height: 150
			};
			
			const fireSpy = vi.spyOn(uplot, 'fire');
			const rendererDrawSpy = vi.spyOn(uplot.renderer, 'draw');
			
			uplot.setSelect(selectOpts);
			
			expect(uplot.select.left).toBe(50);
			expect(uplot.select.width).toBe(200);
			expect(rendererDrawSpy).toHaveBeenCalled();
		});
	});

	describe('Module Interdependency Management', () => {
		it('should handle module dependencies correctly during initialization', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			// Verify that modules have references to dependencies
			expect(uplot.cursor.uplot).toBe(uplot);
			expect(uplot.legend.uplot).toBe(uplot);
			expect(uplot.series.uplot).toBe(uplot);
			expect(uplot.axes.uplot).toBe(uplot);
			expect(uplot.renderer.uplot).toBe(uplot);
		});

		it('should handle circular dependency prevention', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			// This should not throw due to circular dependencies
			expect(() => {
				const uplot = new UPlotCore(opts, [], container);
				expect(uplot.ready).toBe(true);
			}).not.toThrow();
		});

		it('should coordinate value-to-position conversions between scales and other modules', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const data = [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50]
			];
			
			const uplot = new UPlotCore(opts, data, container);
			
			// Test value-to-position conversion coordination
			const scalesValToPosXSpy = vi.spyOn(uplot.scales, 'valToPosX');
			const scalesValToPosYSpy = vi.spyOn(uplot.scales, 'valToPosY');
			
			const xPos = uplot.valToPosX(3, {}, 800, 0);
			const yPos = uplot.valToPosY(30, {}, 600, 0);
			
			expect(scalesValToPosXSpy).toHaveBeenCalledWith(3, {}, 800, 0);
			expect(scalesValToPosYSpy).toHaveBeenCalledWith(30, {}, 600, 0);
			expect(typeof xPos).toBe('number');
			expect(typeof yPos).toBe('number');
		});
	});

	describe('Error Handling Across Modules', () => {
		it('should handle errors gracefully without breaking other modules', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			// Force an error in one module and verify others continue working
			const originalUpdateCursor = uplot.cursor.updateCursor;
			uplot.cursor.updateCursor = vi.fn(() => {
				throw new Error('Cursor error');
			});
			
			// This should not break the entire chart
			expect(() => {
				uplot.setData([[1, 2, 3], [10, 20, 30]]);
			}).not.toThrow();
			
			// Restore original method
			uplot.cursor.updateCursor = originalUpdateCursor;
		});

		it('should provide meaningful error context from modules', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			// Test error reporting includes module context
			expect(() => {
				uplot.scales.updateScale('nonexistent', {});
			}).toThrow();
		});
	});

	describe('Performance and Memory Management', () => {
		it('should properly clean up all modules on destroy', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			// Spy on destroy methods
			const eventDestroySpy = vi.spyOn(uplot.events, 'destroy');
			const cursorDestroySpy = vi.spyOn(uplot.cursor, 'destroy');
			const legendDestroySpy = vi.spyOn(uplot.legend, 'destroy');
			
			uplot.destroy();
			
			expect(eventDestroySpy).toHaveBeenCalled();
			expect(cursorDestroySpy).toHaveBeenCalled();
			expect(legendDestroySpy).toHaveBeenCalled();
			expect(uplot.ready).toBe(false);
			expect(uplot.status).toBe(0);
		});

		it('should handle rapid data updates efficiently', () => {
			const opts = {
				width: 800,
				height: 600,
				series: [
					{},
					{ label: 'Series 1' }
				],
				scales: {
					x: { time: false },
					y: { auto: true }
				}
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			// Perform multiple rapid data updates
			const datasets = [
				[[1, 2, 3], [10, 20, 30]],
				[[1, 2, 3, 4], [10, 20, 30, 40]],
				[[1, 2, 3, 4, 5], [10, 20, 30, 40, 50]]
			];
			
			datasets.forEach(data => {
				expect(() => {
					uplot.setData(data);
				}).not.toThrow();
			});
			
			expect(uplot.dataLen).toBe(5);
		});
	});

	describe('Plugin System Integration', () => {
		it('should coordinate plugins with all modules', () => {
			const pluginInitSpy = vi.fn();
			const pluginHookSpy = vi.fn();
			
			const plugin = {
				opts: (u, opts) => {
					pluginInitSpy(u, opts);
					return {
						...opts,
						hooks: {
							...opts.hooks,
							ready: [...(opts.hooks?.ready || []), pluginHookSpy]
						}
					};
				}
			};
			
			const opts = {
				width: 800,
				height: 600,
				series: [{}],
				scales: {
					x: { time: false },
					y: { auto: true }
				},
				plugins: [plugin]
			};
			
			const uplot = new UPlotCore(opts, [], container);
			
			expect(pluginInitSpy).toHaveBeenCalledWith(uplot, expect.any(Object));
			expect(pluginHookSpy).toHaveBeenCalledWith(uplot);
		});
	});
});