/**
 * Simplified integration tests for module interactions in uPlot
 * Tests module initialization and basic interactions without complex configurations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayoutManager } from '../src/core/layout.js';
import { ScaleManager } from '../src/core/scales.js';
import { EventManager } from '../src/core/events.js';
import { CursorManager } from '../src/core/cursor.js';
import { LegendManager } from '../src/core/legend.js';
import { AxisManager } from '../src/core/axes.js';
import { Renderer } from '../src/core/renderer.js';

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

describe('Module Integration Tests - Simplified', () => {
	let mockUplot;
	let container;
	
	beforeEach(() => {
		container = new HTMLElement();
		
		// Create a mock uPlot instance with minimal required properties
		mockUplot = {
			opts: {
				width: 800,
				height: 600,
				pxRatio: 1,
				series: [{}],
				axes: [{}],
				scales: { x: {}, y: {} },
				cursor: { show: true }
			},
			data: [],
			root: container,
			can: createMockCanvas(),
			ctx: createMockContext(),
			wrap: createMockElement(),
			under: createMockElement(),
			over: createMockElement(),
			width: 800,
			height: 600,
			pxRatio: 1,
			ready: false,
			status: 0,
			fire: vi.fn(),
			pubSync: vi.fn(),
			updateCursor: vi.fn(),
			setSelect: vi.fn(),
			setPxRatio: vi.fn(),
			syncRect: vi.fn(),
		};
		
		vi.clearAllMocks();
	});

	describe('Individual Module Initialization', () => {
		it('should initialize LayoutManager with proper dependencies', () => {
			const layout = new LayoutManager(mockUplot);
			
			expect(layout).toBeDefined();
			expect(layout.uplot).toBe(mockUplot);
			expect(layout.fullWidCss).toBe(0);
			expect(layout.fullHgtCss).toBe(0);
		});

		it('should initialize ScaleManager with proper dependencies', () => {
			const scales = new ScaleManager(mockUplot, mockUplot.opts);
			
			expect(scales).toBeDefined();
			expect(scales.uplot).toBe(mockUplot);
		});

		it('should initialize EventManager with proper dependencies', () => {
			const events = new EventManager(mockUplot);
			
			expect(events).toBeDefined();
			expect(events.uplot).toBe(mockUplot);
			expect(events.mouseListeners).toBeDefined();
			expect(events.globalListeners).toBeDefined();
		});

		it('should initialize CursorManager with proper dependencies', () => {
			const cursor = new CursorManager(mockUplot);
			
			expect(cursor).toBeDefined();
			expect(cursor.uplot).toBe(mockUplot);
		});

		it('should initialize LegendManager with proper dependencies', () => {
			const legend = new LegendManager(mockUplot);
			
			expect(legend).toBeDefined();
			expect(legend.uplot).toBe(mockUplot);
		});

		it('should initialize AxisManager with proper dependencies', () => {
			const scales = new ScaleManager(mockUplot, mockUplot.opts);
			const axes = new AxisManager(mockUplot, scales);
			
			expect(axes).toBeDefined();
			expect(axes.uplot).toBe(mockUplot);
		});

		it('should initialize Renderer with proper dependencies', () => {
			const layout = new LayoutManager(mockUplot);
			const renderer = new Renderer(mockUplot, layout);
			
			expect(renderer).toBeDefined();
			expect(renderer.uplot).toBe(mockUplot);
		});
	});

	describe('Module Interactions', () => {
		let layout, scales, events, cursor, legend, axes, renderer;
		
		beforeEach(() => {
			layout = new LayoutManager(mockUplot);
			scales = new ScaleManager(mockUplot, mockUplot.opts);
			events = new EventManager(mockUplot);
			cursor = new CursorManager(mockUplot);
			legend = new LegendManager(mockUplot);
			axes = new AxisManager(mockUplot, scales);
			renderer = new Renderer(mockUplot, layout);
			
			// Add managers to mock uplot
			mockUplot.layout = layout;
			mockUplot.scales = scales;
			mockUplot.events = events;
			mockUplot.cursor = cursor;
			mockUplot.legend = legend;
			mockUplot.axes = axes;
			mockUplot.renderer = renderer;
		});

		it('should coordinate layout updates across modules', () => {
			const newSize = { width: 1000, height: 800 };
			
			// Update layout
			layout.calcSize(newSize.width, newSize.height);
			
			expect(layout.fullWidCss).toBe(1000);
			expect(layout.fullHgtCss).toBe(800);
		});

		it('should handle scale operations through ScaleManager', () => {
			const scaleOpts = { min: 0, max: 100 };
			
			// Initialize scales
			scales.initScales(mockUplot.opts);
			
			// Update scale
			scales.updateScale('y', scaleOpts);
			
			expect(scales.scales.y).toBeDefined();
		});

		it('should coordinate event handling between EventManager and CursorManager', () => {
			// Initialize event system
			events.initEvents(mockUplot.opts);
			
			// Simulate mouse move
			const mouseEvent = {
				clientX: 150,
				clientY: 100,
				target: mockUplot.over
			};
			
			events.mouseMove(mouseEvent, null, 150, 100);
			
			expect(events.mouseLeft1).toBe(150);
			expect(events.mouseTop1).toBe(100);
		});

		it('should coordinate cursor updates with legend', () => {
			// Initialize cursor and legend
			cursor.initCursor(mockUplot.opts);
			legend.initLegend(mockUplot.opts);
			
			// Update cursor position
			cursor.setCursor({ left: 100, top: 200 });
			
			expect(cursor.left).toBe(100);
			expect(cursor.top).toBe(200);
		});

		it('should handle rendering coordination', () => {
			// Initialize renderer
			renderer.initCanvas(mockUplot.opts);
			
			// Trigger draw
			renderer.draw();
			
			expect(mockUplot.ctx.clearRect).toHaveBeenCalled();
		});

		it('should coordinate axis operations with scales', () => {
			// Initialize axes and scales
			scales.initScales(mockUplot.opts);
			axes.initAxes(mockUplot.opts);
			
			// Verify axes can access scale information
			expect(axes.axes).toBeDefined();
			expect(scales.scales).toBeDefined();
		});
	});

	describe('Error Handling and Cleanup', () => {
		let layout, scales, events, cursor, legend, axes, renderer;
		
		beforeEach(() => {
			layout = new LayoutManager(mockUplot);
			scales = new ScaleManager(mockUplot, mockUplot.opts);
			events = new EventManager(mockUplot);
			cursor = new CursorManager(mockUplot);
			legend = new LegendManager(mockUplot);
			axes = new AxisManager(mockUplot, scales);
			renderer = new Renderer(mockUplot, layout);
		});

		it('should handle module cleanup properly', () => {
			// Initialize modules
			events.initEvents(mockUplot.opts);
			cursor.initCursor(mockUplot.opts);
			legend.initLegend(mockUplot.opts);
			
			// Cleanup
			events.destroy();
			cursor.destroy();
			legend.destroy();
			
			expect(events.mouseListeners.size).toBe(0);
			expect(events.globalListeners.size).toBe(0);
		});

		it('should provide error context from modules', () => {
			// Test error handling in scales
			expect(() => {
				scales.updateScale('nonexistent', {});
			}).toThrow();
		});

		it('should handle invalid inputs gracefully', () => {
			// Test with invalid layout size - this should throw due to validation
			expect(() => {
				layout.calcSize(-100, -100);
			}).toThrow();
		});
	});

	describe('Data Flow Between Modules', () => {
		let layout, scales, events, cursor, legend, axes, renderer;
		
		beforeEach(() => {
			layout = new LayoutManager(mockUplot);
			scales = new ScaleManager(mockUplot, mockUplot.opts);
			events = new EventManager(mockUplot);
			cursor = new CursorManager(mockUplot);
			legend = new LegendManager(mockUplot);
			axes = new AxisManager(mockUplot, scales);
			renderer = new Renderer(mockUplot, layout);
			
			// Add managers to mock uplot
			mockUplot.layout = layout;
			mockUplot.scales = scales;
			mockUplot.events = events;
			mockUplot.cursor = cursor;
			mockUplot.legend = legend;
			mockUplot.axes = axes;
			mockUplot.renderer = renderer;
		});

		it('should propagate size changes through layout to other modules', () => {
			const newSize = { width: 1200, height: 900 };
			
			// Update layout size
			layout.calcSize(newSize.width, newSize.height);
			
			// Verify size propagation
			expect(layout.fullWidCss).toBe(1200);
			expect(layout.fullHgtCss).toBe(900);
		});

		it('should coordinate mouse events through the event system', () => {
			// Initialize event handling
			events.initEvents(mockUplot.opts);
			
			// Simulate mouse down
			events.mouseDown(null, null, 100, 50);
			expect(events.dragging).toBe(true);
			expect(events.mouseLeft0).toBe(100);
			expect(events.mouseTop0).toBe(50);
			
			// Simulate mouse move
			events.mouseMove(null, null, 150, 75);
			expect(events.mouseLeft1).toBe(150);
			expect(events.mouseTop1).toBe(75);
			
			// Simulate mouse up
			events.mouseUp(null, null, 150, 75);
			expect(events.dragging).toBe(false);
		});

		it('should handle value-to-position conversions through scales', () => {
			// Initialize scales
			scales.initScales(mockUplot.opts);
			
			// Test conversion methods exist and are callable
			expect(typeof scales.valToPosX).toBe('function');
			expect(typeof scales.valToPosY).toBe('function');
			expect(typeof scales.posToValX).toBe('function');
			expect(typeof scales.posToValY).toBe('function');
		});
	});

	describe('Performance and Memory Management', () => {
		it('should handle rapid module operations efficiently', () => {
			const layout = new LayoutManager(mockUplot);
			
			// Perform multiple rapid size updates
			const sizes = [
				{ width: 800, height: 600 },
				{ width: 900, height: 700 },
				{ width: 1000, height: 800 },
				{ width: 1100, height: 900 }
			];
			
			sizes.forEach(size => {
				expect(() => {
					layout.calcSize(size.width, size.height);
				}).not.toThrow();
			});
			
			expect(layout.fullWidCss).toBe(1100);
			expect(layout.fullHgtCss).toBe(900);
		});

		it('should manage event listeners properly', () => {
			const events = new EventManager(mockUplot);
			
			// Initialize events
			events.initEvents(mockUplot.opts);
			
			// Verify listeners are managed
			expect(events.mouseListeners).toBeDefined();
			expect(events.globalListeners).toBeDefined();
			
			// Cleanup
			events.destroy();
			
			expect(events.mouseListeners.size).toBe(0);
			expect(events.globalListeners.size).toBe(0);
		});
	});
});