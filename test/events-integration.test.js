import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventManager } from '../src/core/events.js';

// Mock DOM environment
Object.defineProperty(window, 'MouseEvent', {
	value: class MockMouseEvent {
		constructor(type, options = {}) {
			this.type = type;
			this.clientX = options.clientX || 0;
			this.clientY = options.clientY || 0;
			this.button = options.button || 0;
			this.buttons = options.buttons || 0;
			this.bubbles = options.bubbles || false;
			this.cancelable = options.cancelable || false;
		}
	}
});

describe('EventManager Integration', () => {
	let eventManager;
	let mockUplot;

	beforeEach(() => {
		// Create a more realistic uPlot mock
		mockUplot = {
			cursor: {
				show: true,
				_lock: false,
				event: null,
				left: 0,
				top: 0,
				bind: {
					mousedown: (self, targ, fn) => fn,
					mouseup: (self, targ, fn) => fn,
					mousemove: (self, targ, fn) => fn,
					mouseenter: (self, targ, fn) => fn,
					mouseleave: (self, targ, fn) => fn,
					dblclick: (self, targ, fn) => fn,
				},
				move: (self, left, top) => [left, top],
				drag: {
					click: vi.fn(),
					setScale: true,
					dist: 0,
					x: true,
					y: false,
					_x: false,
					_y: false,
				}
			},
			over: {
				getBoundingClientRect: () => ({
					left: 0,
					top: 0,
					width: 400,
					height: 300
				}),
				dispatchEvent: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn()
			},
			wrap: {
				addEventListener: vi.fn(),
				removeEventListener: vi.fn()
			},
			plotWidCss: 400,
			plotHgtCss: 300,
			fire: vi.fn(),
			pubSync: vi.fn(),
			updateCursor: vi.fn(),
			setSelect: vi.fn(),
			setPxRatio: vi.fn(),
			syncRect: vi.fn(),
		};

		eventManager = new EventManager(mockUplot);
	});

	it('should initialize and handle a complete mouse interaction flow', () => {
		// Initialize events
		eventManager.initEvents({});

		// Simulate mouse down
		eventManager.mouseDown(null, null, 100, 50);
		expect(eventManager.dragging).toBe(true);
		expect(eventManager.mouseLeft0).toBe(100);
		expect(eventManager.mouseTop0).toBe(50);

		// Simulate mouse move
		eventManager.mouseMove(null, null, 150, 75);
		expect(eventManager.mouseLeft1).toBe(150);
		expect(eventManager.mouseTop1).toBe(75);

		// Simulate mouse up
		eventManager.mouseUp(null, null, 150, 75);
		expect(eventManager.dragging).toBe(false);
	});

	it('should handle cursor locking correctly', () => {
		mockUplot.cursor._lock = true;

		// These should return early due to cursor lock
		eventManager.mouseMove({});
		eventManager.mouseLeave({});
		eventManager.dblClick({});

		expect(mockUplot.updateCursor).not.toHaveBeenCalled();
	});

	it('should properly clean up resources', () => {
		// Add some listeners
		eventManager.mouseListeners.set(mockUplot.over, { mousedown: vi.fn() });
		eventManager.globalListeners.add({
			event: 'resize',
			target: window,
			handler: vi.fn(),
			useCapture: false
		});

		// Destroy should clean everything up
		eventManager.destroy();

		expect(eventManager.mouseListeners.size).toBe(0);
		expect(eventManager.globalListeners.size).toBe(0);
	});

	it('should provide accurate state information', () => {
		eventManager.mouseLeft1 = 200;
		eventManager.mouseTop1 = 100;
		eventManager.rawMouseLeft1 = 205;
		eventManager.rawMouseTop1 = 105;
		eventManager.dragging = true;
		eventManager.dragX = true;
		eventManager.mouseLeft0 = 50;
		eventManager.mouseTop0 = 25;

		const mousePos = eventManager.getMousePos();
		expect(mousePos).toEqual({
			left: 200,
			top: 100,
			rawLeft: 205,
			rawTop: 105
		});

		const dragState = eventManager.getDragState();
		expect(dragState).toEqual({
			dragging: true,
			dragX: true,
			dragY: false,
			startLeft: 50,
			startTop: 25
		});
	});

	it('should handle touch events initialization', () => {
		expect(() => {
			eventManager.initTouchEvents(mockUplot.over);
		}).not.toThrow();
	});
});