/**
 * Cursor Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CursorManager } from '../src/core/cursor.js';

// Mock dependencies
vi.mock('../src/domClasses', () => ({
	CURSOR_X: 'u-cursor-x',
	CURSOR_Y: 'u-cursor-y',
	CURSOR_PT: 'u-cursor-pt'
}));

vi.mock('../src/dom', () => ({
	addClass: vi.fn(),
	elTrans: vi.fn(),
	elSize: vi.fn(),
	placeDiv: vi.fn((className, parent) => {
		const el = document.createElement('div');
		if (className) el.className = className;
		if (parent) parent.appendChild(el);
		return el;
	}),
	setStylePx: vi.fn()
}));

vi.mock('../src/utils', () => ({
	assign: Object.assign,
	fnOrSelf: vi.fn(fn => typeof fn === 'function' ? fn : () => fn),
	abs: Math.abs,
	inf: Infinity,
	ceil: Math.ceil,
	round: Math.round,
	isUndef: vi.fn(val => val === undefined)
}));

vi.mock('../src/strings', () => ({
	WIDTH: 'width',
	HEIGHT: 'height',
	mousemove: 'mousemove',
	mousedown: 'mousedown',
	mouseup: 'mouseup',
	mouseleave: 'mouseleave',
	mouseenter: 'mouseenter',
	dblclick: 'dblclick'
}));

vi.mock('../src/opts', () => ({
	cursorOpts: {
		show: true,
		x: true,
		y: true,
		lock: false,
		move: vi.fn((self, left, top) => [left, top]),
		points: {
			one: false,
			show: vi.fn(() => document.createElement('div')),
			size: vi.fn(() => 10),
			width: 0,
			stroke: vi.fn(() => '#000'),
			fill: vi.fn(() => '#f00'),
		},
		bind: {},
		drag: {
			setScale: true,
			x: true,
			y: false,
			dist: 0,
			uni: null,
		},
		focus: {
			prox: -1,
			bias: 0,
		},
		hover: {
			skip: [void 0],
			prox: null,
			bias: 0,
		},
		left: -10,
		top: -10,
		idx: null,
		dataIdx: null,
		idxs: null,
		event: null,
	}
}));

describe('CursorManager', () => {
	let cursorManager;
	let mockUplot;
	let mockOver;

	beforeEach(() => {
		// Setup DOM environment
		global.document = {
			createElement: vi.fn((tag) => ({
				tagName: tag.toUpperCase(),
				className: '',
				style: {},
				appendChild: vi.fn(),
				remove: vi.fn(),
				getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 400, height: 300 }))
			}))
		};

		mockOver = {
			...document.createElement('div'),
			insertBefore: vi.fn(),
			appendChild: vi.fn()
		};
		
		mockUplot = {
			series: [
				{ label: 'x', show: true, scale: 'x' },
				{ label: 'y1', show: true, scale: 'y', class: 'series-y1' },
				{ label: 'y2', show: true, scale: 'y', class: 'series-y2' }
			],
			data: [
				[1, 2, 3, 4, 5],
				[10, 20, 30, 40, 50],
				[15, 25, 35, 45, 55]
			],
			scales: {
				x: { ori: 0, min: 1, max: 5 },
				y: { ori: 1, min: 0, max: 60 }
			},
			activeIdxs: [2, 2, 2],
			plotWidCss: 400,
			plotHgtCss: 300,
			over: mockOver,
			shouldSetCursor: false,
			fire: vi.fn(),
			valToPosX: vi.fn((val, scale, dim, off) => (val - scale.min) / (scale.max - scale.min) * dim + off),
			valToPosY: vi.fn((val, scale, dim, off) => dim - ((val - scale.min) / (scale.max - scale.min) * dim) + off)
		};

		cursorManager = new CursorManager(mockUplot);
	});

	describe('constructor', () => {
		it('should initialize with default state', () => {
			expect(cursorManager.uplot).toBe(mockUplot);
			expect(cursorManager.cursor).toBeNull();
			expect(cursorManager.showCursor).toBe(false);
			expect(cursorManager.cursorPts).toEqual([]);
			expect(cursorManager.mouseLeft1).toBe(-10);
			expect(cursorManager.mouseTop1).toBe(-10);
		});
	});

	describe('initCursor', () => {
		it('should initialize cursor with basic configuration', () => {
			const opts = {
				cursor: {
					show: true,
					x: true,
					y: true
				}
			};
			const series = mockUplot.series;
			const activeIdxs = [0, 0, 0];
			const mode = 1;
			const focus = { prox: -1 };

			const result = cursorManager.initCursor(opts, series, activeIdxs, mode, mockOver, focus);

			expect(result).toBeDefined();
			expect(cursorManager.showCursor).toBe(true);
			expect(cursorManager.cursor.show).toBe(true);
			expect(cursorManager.cursor._lock).toBe(false);
		});

		it('should create cursor DOM elements when show is true', () => {
			const opts = {
				cursor: {
					show: true,
					x: true,
					y: true
				}
			};
			const series = mockUplot.series;
			const activeIdxs = [0, 0, 0];
			const mode = 1;
			const focus = { prox: -1 };

			cursorManager.initCursor(opts, series, activeIdxs, mode, mockOver, focus);

			expect(cursorManager.vCursor).toBeDefined();
			expect(cursorManager.hCursor).toBeDefined();
		});

		it('should initialize cursor focus settings', () => {
			const opts = {
				cursor: {
					show: true,
					points: { one: true }
				}
			};
			const series = mockUplot.series;
			const activeIdxs = [0, 0, 0];
			const mode = 1;
			const focus = { prox: 10 }; // Enable focus

			cursorManager.initCursor(opts, series, activeIdxs, mode, mockOver, focus);

			expect(cursorManager.cursorFocus).toBe(true);
			expect(cursorManager.cursorOnePt).toBe(true);
		});

		it('should create dataIdx function when not provided', () => {
			const opts = {
				cursor: {
					show: true,
					dataIdx: null
				}
			};
			const series = mockUplot.series;
			const activeIdxs = [0, 0, 0];
			const mode = 1;
			const focus = { prox: -1 };

			cursorManager.initCursor(opts, series, activeIdxs, mode, mockOver, focus);

			expect(cursorManager.cursor.dataIdx).toBeInstanceOf(Function);
		});
	});

	describe('createDataIdxFunction', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
		});

		it('should return cursorIdx for series 0', () => {
			const dataIdxFn = cursorManager.createDataIdxFunction();
			const result = dataIdxFn(mockUplot, 0, 2, 100);

			expect(result).toBe(2);
		});

		it('should handle proximity checking for data series', () => {
			// Mock series with prox function that returns acceptable proximity
			mockUplot.series[1].prox = vi.fn(() => 1); // Small proximity value
			cursorManager.cursor.left = 100;
			
			// Mock valToPosX to return a position close to cursor
			mockUplot.valToPosX = vi.fn(() => 99); // Close to cursor position

			const dataIdxFn = cursorManager.createDataIdxFunction();
			const result = dataIdxFn(mockUplot, 1, 2, 100);

			expect(result).toBe(2);
		});

		it('should handle null values with skip logic', () => {
			cursorManager.cursor.hover = { skip: new Set([null, undefined]), bias: 0 };
			mockUplot.data[1] = [10, null, 30, 40, 50];

			const dataIdxFn = cursorManager.createDataIdxFunction();
			const result = dataIdxFn(mockUplot, 1, 1, 100); // Index 1 has null value

			expect(result).not.toBe(1); // Should not return the null index
		});
	});

	describe('addCursorPt', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
		});

		it('should add cursor point and update arrays', () => {
			const series = mockUplot.series[1];
			const initialPtsLength = cursorManager.cursorPts.length;

			cursorManager.addCursorPt(series, 1, mockOver, 400, 300);

			expect(cursorManager.cursorPts.length).toBe(initialPtsLength + 1);
			expect(cursorManager.cursorPtsLft.length).toBe(initialPtsLength + 1);
			expect(cursorManager.cursorPtsTop.length).toBe(initialPtsLength + 1);
		});
	});

	describe('removeCursorPt', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
			
			// Add a point first
			const series = mockUplot.series[1];
			cursorManager.addCursorPt(series, 1, mockOver, 400, 300);
		});

		it('should remove cursor point and update arrays', () => {
			// Ensure we have at least one item to remove
			expect(cursorManager.cursorPts.length).toBeGreaterThan(0);
			
			const initialPtsLength = cursorManager.cursorPts.length;
			const indexToRemove = Math.min(1, initialPtsLength - 1);

			cursorManager.removeCursorPt(indexToRemove);

			expect(cursorManager.cursorPts.length).toBe(initialPtsLength - 1);
			expect(cursorManager.cursorPtsLft.length).toBe(initialPtsLength - 1);
			expect(cursorManager.cursorPtsTop.length).toBe(initialPtsLength - 1);
		});
	});

	describe('setCursor', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
			cursorManager.updateCursor = vi.fn();
		});

		it('should set cursor position and call updateCursor', () => {
			const opts = { left: 100, top: 50 };

			cursorManager.setCursor(opts, true, true);

			expect(cursorManager.mouseLeft1).toBe(100);
			expect(cursorManager.mouseTop1).toBe(50);
			expect(cursorManager.updateCursor).toHaveBeenCalledWith(null, true, true);
		});
	});

	describe('setCursorEvent', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
		});

		it('should set cursor event', () => {
			const mockEvent = { type: 'mousemove', clientX: 100, clientY: 50 };

			cursorManager.setCursorEvent(mockEvent);

			expect(cursorManager.cursor.event).toBe(mockEvent);
		});
	});

	describe('updateCursor', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
			cursorManager.mouseLeft1 = 100;
			cursorManager.mouseTop1 = 50;
		});

		it('should update cursor position and call move function', () => {
			cursorManager.updateCursor(null, true, false);

			expect(cursorManager.cursor.left).toBe(100);
			expect(cursorManager.cursor.top).toBe(50);
			expect(cursorManager.rawMouseLeft1).toBe(100);
			expect(cursorManager.rawMouseTop1).toBe(50);
		});

		it('should fire setCursor event', () => {
			cursorManager.updateCursor(null, true, false);

			expect(mockUplot.fire).toHaveBeenCalledWith("setCursor");
		});

		it('should not fire event when _fire is false', () => {
			cursorManager.updateCursor(null, false, false);

			expect(mockUplot.fire).not.toHaveBeenCalled();
		});
	});

	describe('syncRect', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
		});

		it('should set rect to null when defer is true', () => {
			cursorManager.rect = { left: 0, top: 0, width: 400, height: 300 };

			cursorManager.syncRect(true);

			expect(cursorManager.rect).toBeNull();
		});

		it('should update rect and fire syncRect event when defer is false', () => {
			cursorManager.syncRect(false);

			expect(cursorManager.rect).toBeDefined();
			expect(mockUplot.fire).toHaveBeenCalledWith("syncRect", cursorManager.rect);
		});
	});

	describe('getRect', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
		});

		it('should return cached rect if available', () => {
			const mockRect = { left: 0, top: 0, width: 400, height: 300 };
			cursorManager.rect = mockRect;

			const result = cursorManager.getRect();

			expect(result).toBe(mockRect);
		});

		it('should sync rect if not cached', () => {
			cursorManager.rect = null;
			cursorManager.syncRect = vi.fn();

			cursorManager.getRect();

			expect(cursorManager.syncRect).toHaveBeenCalledWith(false);
		});
	});

	describe('setSeriesOpacity', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
			
			// Add cursor points
			cursorManager.cursorPts = [null, document.createElement('div'), document.createElement('div')];
		});

		it('should set opacity on cursor point', () => {
			cursorManager.setSeriesOpacity(1, 0.5);

			expect(cursorManager.cursorPts[1].style.opacity).toBe(0.5);
		});

		it('should handle null cursor points', () => {
			expect(() => {
				cursorManager.setSeriesOpacity(0, 0.5);
			}).not.toThrow();
		});
	});

	describe('destroy', () => {
		beforeEach(() => {
			const opts = { cursor: { show: true } };
			cursorManager.initCursor(opts, mockUplot.series, [0, 0, 0], 1, mockOver, { prox: -1 });
		});

		it('should clean up resources', () => {
			const mockVCursor = { remove: vi.fn() };
			const mockHCursor = { remove: vi.fn() };
			const mockPt = { remove: vi.fn() };
			
			cursorManager.vCursor = mockVCursor;
			cursorManager.hCursor = mockHCursor;
			cursorManager.cursorPts = [mockPt];

			cursorManager.destroy();

			expect(mockVCursor.remove).toHaveBeenCalled();
			expect(mockHCursor.remove).toHaveBeenCalled();
			expect(mockPt.remove).toHaveBeenCalled();
			expect(cursorManager.cursorPts).toEqual([]);
			expect(cursorManager.cursorPtsLft).toEqual([]);
			expect(cursorManager.cursorPtsTop).toEqual([]);
			expect(cursorManager.cursor).toBeNull();
			expect(cursorManager.rect).toBeNull();
		});
	});
});