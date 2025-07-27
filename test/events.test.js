import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventManager } from '../src/core/events.js';

// Mock DOM functions
vi.mock('../src/dom', () => ({
	domEnv: true,
	doc: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
	win: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
	on: vi.fn(),
	off: vi.fn(),
}));

// Mock strings
vi.mock('../src/strings', () => ({
	mousemove: 'mousemove',
	mousedown: 'mousedown',
	mouseup: 'mouseup',
	mouseleave: 'mouseleave',
	mouseenter: 'mouseenter',
	dblclick: 'dblclick',
	resize: 'resize',
	scroll: 'scroll',
	dppxchange: 'dppxchange',
}));

describe('EventManager', () => {
	let eventManager;
	let mockUplot;
	let mockCursor;
	let mockOver;
	let mockWrap;

	beforeEach(() => {
		mockCursor = {
			show: true,
			_lock: false,
			event: null,
			left: 0,
			top: 0,
			bind: {
				mousedown: vi.fn((self, targ, fn) => fn),
				mouseup: vi.fn((self, targ, fn) => fn),
				mousemove: vi.fn((self, targ, fn) => fn),
				mouseenter: vi.fn((self, targ, fn) => fn),
				mouseleave: vi.fn((self, targ, fn) => fn),
				dblclick: vi.fn((self, targ, fn) => fn),
			},
			move: vi.fn((self, left, top) => [left, top]),
			drag: {
				click: vi.fn(),
				setScale: true,
				dist: 0,
				x: true,
				y: false,
				_x: false,
				_y: false,
			}
		};

		mockOver = {
			getBoundingClientRect: vi.fn(() => ({
				left: 0,
				top: 0,
				width: 400,
				height: 300
			}))
		};

		mockWrap = {};

		mockUplot = {
			cursor: mockCursor,
			over: mockOver,
			wrap: mockWrap,
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

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with default values', () => {
			expect(eventManager.uplot).toBe(mockUplot);
			expect(eventManager.mouseListeners).toBeInstanceOf(Map);
			expect(eventManager.globalListeners).toBeInstanceOf(Set);
			expect(eventManager.dragging).toBe(false);
			expect(eventManager.mouseLeft1).toBe(0);
			expect(eventManager.mouseTop1).toBe(0);
		});
	});

	describe('initEvents', () => {
		it('should not bind events when cursor is hidden', () => {
			mockCursor.show = false;
			const onMouseSpy = vi.spyOn(eventManager, 'onMouse');
			
			eventManager.initEvents({});
			
			expect(onMouseSpy).not.toHaveBeenCalled();
		});

		it('should bind cursor events when cursor is shown', () => {
			const onMouseSpy = vi.spyOn(eventManager, 'onMouse');
			
			eventManager.initEvents({});
			
			expect(onMouseSpy).toHaveBeenCalledWith('mousedown', mockOver, expect.any(Function));
			expect(onMouseSpy).toHaveBeenCalledWith('mousemove', mockOver, expect.any(Function));
			expect(onMouseSpy).toHaveBeenCalledWith('mouseenter', mockOver, expect.any(Function));
			expect(onMouseSpy).toHaveBeenCalledWith('mouseleave', mockOver, expect.any(Function));
			expect(onMouseSpy).toHaveBeenCalledWith('dblclick', mockOver, expect.any(Function));
		});
	});

	describe('onMouse', () => {
		it('should bind event listener when cursor bind returns a function', () => {
			const mockFn = vi.fn();
			const mockListener = vi.fn();
			mockCursor.bind.mousedown.mockReturnValue(mockListener);

			eventManager.onMouse('mousedown', mockOver, mockFn);

			expect(mockCursor.bind.mousedown).toHaveBeenCalledWith(mockUplot, mockOver, mockFn, true);
			expect(eventManager.mouseListeners.get(mockOver)).toEqual({
				mousedown: mockListener
			});
		});

		it('should not bind event listener when cursor bind returns null', () => {
			const mockFn = vi.fn();
			mockCursor.bind.mousedown.mockReturnValue(null);

			eventManager.onMouse('mousedown', mockOver, mockFn);

			expect(eventManager.mouseListeners.get(mockOver)).toBeUndefined();
		});
	});

	describe('offMouse', () => {
		beforeEach(() => {
			// Set up some listeners
			eventManager.mouseListeners.set(mockOver, {
				mousedown: vi.fn(),
				mousemove: vi.fn()
			});
		});

		it('should remove specific event listener', () => {
			eventManager.offMouse('mousedown', mockOver);

			const listeners = eventManager.mouseListeners.get(mockOver);
			expect(listeners.mousedown).toBeUndefined();
			expect(listeners.mousemove).toBeDefined();
		});

		it('should remove all event listeners when event is null', () => {
			eventManager.offMouse(null, mockOver);

			expect(eventManager.mouseListeners.get(mockOver)).toBeUndefined();
		});
	});

	describe('mouseDown', () => {
		it('should set dragging state and initialize mouse positions', () => {
			eventManager.mouseDown(null, null, 100, 50);

			expect(eventManager.dragging).toBe(true);
			expect(eventManager.mouseLeft0).toBe(100);
			expect(eventManager.mouseTop0).toBe(50);
			expect(eventManager.mouseLeft1).toBe(100);
			expect(eventManager.mouseTop1).toBe(50);
			expect(eventManager.downSelectLeft).toBe(100);
			expect(eventManager.downSelectTop).toBe(50);
		});

		it('should use current mouse position when coordinates not provided', () => {
			eventManager.mouseLeft1 = 200;
			eventManager.mouseTop1 = 150;

			eventManager.mouseDown(null, null);

			expect(eventManager.mouseLeft0).toBe(200);
			expect(eventManager.mouseTop0).toBe(150);
		});
	});

	describe('mouseMove', () => {
		it('should return early when cursor is locked', () => {
			mockCursor._lock = true;
			const setCursorEventSpy = vi.spyOn(eventManager, 'setCursorEvent');

			eventManager.mouseMove({});

			expect(setCursorEventSpy).not.toHaveBeenCalled();
		});

		it('should ignore phantom mousemove events during drag', () => {
			eventManager.dragging = true;
			const mockEvent = { movementX: 0, movementY: 0 };
			const updateCursorSpy = vi.spyOn(eventManager, 'updateCursor');

			eventManager.mouseMove(mockEvent);

			expect(updateCursorSpy).not.toHaveBeenCalled();
		});

		it('should update mouse position from event', () => {
			const mockEvent = { clientX: 150, clientY: 100 };
			eventManager.rect = { left: 50, top: 25 };

			eventManager.mouseMove(mockEvent);

			expect(eventManager.rawMouseLeft1).toBe(100); // 150 - 50
			expect(eventManager.rawMouseTop1).toBe(75);   // 100 - 25
		});

		it('should clamp negative positions to -10', () => {
			const mockEvent = { clientX: 25, clientY: 10 };
			eventManager.rect = { left: 50, top: 25 };

			eventManager.mouseMove(mockEvent);

			expect(eventManager.rawMouseLeft1).toBe(-10);
			expect(eventManager.rawMouseTop1).toBe(-10);
		});
	});

	describe('mouseUp', () => {
		it('should reset dragging state', () => {
			eventManager.dragging = true;
			mockCursor.drag._x = true;
			mockCursor.drag._y = true;

			eventManager.mouseUp(null, null, 100, 50);

			expect(eventManager.dragging).toBe(false);
			expect(mockCursor.drag._x).toBe(false);
			expect(mockCursor.drag._y).toBe(false);
		});

		it('should call setSelect when drag conditions are met', () => {
			eventManager.mouseLeft0 = 50;
			eventManager.mouseTop0 = 25;
			eventManager.dragX = true;
			mockCursor.drag.setScale = true;
			mockCursor.drag.dist = 5;

			eventManager.mouseUp(null, null, 100, 75);

			expect(mockUplot.setSelect).toHaveBeenCalledWith({
				left: 50,
				width: 50,
				top: 0,
				height: 300
			}, false);
		});
	});

	describe('mouseLeave', () => {
		it('should return early when cursor is locked', () => {
			mockCursor._lock = true;
			const setCursorEventSpy = vi.spyOn(eventManager, 'setCursorEvent');

			eventManager.mouseLeave({});

			expect(setCursorEventSpy).not.toHaveBeenCalled();
		});

		it('should set mouse position to -10 when not dragging', () => {
			eventManager.dragging = false;

			eventManager.mouseLeave({});

			expect(eventManager.mouseLeft1).toBe(-10);
			expect(eventManager.mouseTop1).toBe(-10);
		});

		it('should not change mouse position when dragging', () => {
			eventManager.dragging = true;
			eventManager.mouseLeft1 = 100;
			eventManager.mouseTop1 = 50;

			eventManager.mouseLeave({});

			expect(eventManager.mouseLeft1).toBe(100);
			expect(eventManager.mouseTop1).toBe(50);
		});
	});

	describe('setCursorEvent', () => {
		it('should set cursor event reference', () => {
			const mockEvent = { type: 'mousemove' };

			eventManager.setCursorEvent(mockEvent);

			expect(mockCursor.event).toBe(mockEvent);
		});
	});

	describe('syncRect', () => {
		it('should update rect cache when forced or null', () => {
			eventManager.rect = null;

			eventManager.syncRect(false);

			expect(mockOver.getBoundingClientRect).toHaveBeenCalled();
			expect(mockUplot.fire).toHaveBeenCalledWith('syncRect', expect.any(Object));
		});

		it('should update rect cache when forced', () => {
			eventManager.rect = { left: 0, top: 0 };

			eventManager.syncRect(true);

			expect(mockOver.getBoundingClientRect).toHaveBeenCalled();
		});

		it('should not update rect cache when not forced and rect exists', () => {
			eventManager.rect = { left: 0, top: 0 };

			eventManager.syncRect(false);

			expect(mockOver.getBoundingClientRect).not.toHaveBeenCalled();
		});
	});

	describe('getMousePos', () => {
		it('should return current mouse position', () => {
			eventManager.mouseLeft1 = 100;
			eventManager.mouseTop1 = 50;
			eventManager.rawMouseLeft1 = 110;
			eventManager.rawMouseTop1 = 60;

			const pos = eventManager.getMousePos();

			expect(pos).toEqual({
				left: 100,
				top: 50,
				rawLeft: 110,
				rawTop: 60
			});
		});
	});

	describe('getDragState', () => {
		it('should return current drag state', () => {
			eventManager.dragging = true;
			eventManager.dragX = true;
			eventManager.dragY = false;
			eventManager.mouseLeft0 = 25;
			eventManager.mouseTop0 = 75;

			const state = eventManager.getDragState();

			expect(state).toEqual({
				dragging: true,
				dragX: true,
				dragY: false,
				startLeft: 25,
				startTop: 75
			});
		});
	});

	describe('handleWrapClick', () => {
		it('should call drag.click when target is over and drag occurred', () => {
			eventManager.mouseLeft0 = 50;
			eventManager.mouseTop0 = 25;
			eventManager.mouseLeft1 = 100;
			eventManager.mouseTop1 = 75;

			const mockEvent = { target: mockOver };

			eventManager.handleWrapClick(mockEvent);

			expect(mockCursor.drag.click).toHaveBeenCalledWith(mockUplot, mockEvent);
		});

		it('should not call drag.click when target is not over', () => {
			const mockEvent = { target: {} };

			eventManager.handleWrapClick(mockEvent);

			expect(mockCursor.drag.click).not.toHaveBeenCalled();
		});

		it('should not call drag.click when no drag occurred', () => {
			eventManager.mouseLeft0 = 100;
			eventManager.mouseTop0 = 75;
			eventManager.mouseLeft1 = 100;
			eventManager.mouseTop1 = 75;

			const mockEvent = { target: mockOver };

			eventManager.handleWrapClick(mockEvent);

			expect(mockCursor.drag.click).not.toHaveBeenCalled();
		});
	});

	describe('updateCursor', () => {
		it('should update raw positions and call cursor.move', () => {
			eventManager.mouseLeft1 = 100;
			eventManager.mouseTop1 = 50;
			mockCursor.move.mockReturnValue([110, 60]);

			eventManager.updateCursor(null, true, false);

			expect(eventManager.rawMouseLeft1).toBe(100);
			expect(eventManager.rawMouseTop1).toBe(50);
			expect(mockCursor.move).toHaveBeenCalledWith(mockUplot, 100, 50);
			expect(eventManager.mouseLeft1).toBe(110);
			expect(eventManager.mouseTop1).toBe(60);
			expect(mockCursor.left).toBe(110);
			expect(mockCursor.top).toBe(60);
		});

		it('should delegate to uPlot updateCursor method', () => {
			eventManager.updateCursor(123, true, false);

			expect(mockUplot.updateCursor).toHaveBeenCalledWith(123, true, false);
		});
	});

	describe('initTouchEvents', () => {
		let mockTarget;

		beforeEach(() => {
			mockTarget = {
				dispatchEvent: vi.fn(),
				addEventListener: vi.fn()
			};
		});

		it('should initialize touch events without throwing', () => {
			expect(() => {
				eventManager.initTouchEvents(mockTarget);
			}).not.toThrow();
		});
	});

	describe('edge cases', () => {
		it('should handle null event in mouseMove', () => {
			eventManager.rect = { left: 0, top: 0 };
			const syncRectSpy = vi.spyOn(eventManager, 'syncRect');

			eventManager.mouseMove(null, null, 100, 50);

			expect(syncRectSpy).toHaveBeenCalledWith(true);
			expect(eventManager.mouseLeft1).toBe(100);
			expect(eventManager.mouseTop1).toBe(50);
		});

		it('should handle drag distance calculation in mouseUp', () => {
			eventManager.mouseLeft0 = 50;
			eventManager.mouseTop0 = 25;
			eventManager.dragX = true;
			mockCursor.drag.setScale = true;
			mockCursor.drag.dist = 10;

			// Small drag - should not trigger setSelect
			eventManager.mouseUp(null, null, 55, 30);
			expect(mockUplot.setSelect).not.toHaveBeenCalled();

			// Large drag - should trigger setSelect
			eventManager.mouseUp(null, null, 70, 40);
			expect(mockUplot.setSelect).toHaveBeenCalled();
		});

		it('should handle Y-axis drag selection', () => {
			eventManager.mouseLeft0 = 50;
			eventManager.mouseTop0 = 25;
			eventManager.dragX = true;
			mockCursor.drag.setScale = true;
			mockCursor.drag.dist = 5;
			mockCursor.drag.y = true;

			eventManager.mouseUp(null, null, 100, 75);

			expect(mockUplot.setSelect).toHaveBeenCalledWith({
				left: 50,
				width: 50,
				top: 25,
				height: 50
			}, false);
		});
	});

	describe('destroy', () => {
		it('should clear all listeners', () => {
			const offMouseSpy = vi.spyOn(eventManager, 'offMouse');
			eventManager.mouseListeners.set(mockOver, { mousedown: vi.fn() });
			eventManager.globalListeners.add({
				event: 'resize',
				target: {},
				handler: vi.fn(),
				useCapture: false
			});

			eventManager.destroy();

			expect(offMouseSpy).toHaveBeenCalledWith(null, mockOver);
			expect(eventManager.mouseListeners.size).toBe(0);
			expect(eventManager.globalListeners.size).toBe(0);
		});
	});
});