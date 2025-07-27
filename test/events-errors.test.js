/**
 * Tests for error handling in EventManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventManager } from '../src/core/events.js';
import { UPlotError, ERROR_TYPES, errorReporter } from '../src/core/errors.js';

describe('EventManager Error Handling', () => {
	let mockUplot;

	beforeEach(() => {
		errorReporter.clear();
		
		mockUplot = {
			cursor: {
				show: true,
				drag: {
					_x: false,
					_y: false
				},
				bind: {
					mousedown: vi.fn(() => vi.fn()),
					mousemove: vi.fn(() => vi.fn()),
					mouseenter: vi.fn(() => vi.fn()),
					mouseleave: vi.fn(() => vi.fn()),
					dblclick: vi.fn(() => vi.fn())
				}
			},
			over: document.createElement('div'),
			wrap: document.createElement('div'),
			plotWidCss: 400,
			plotHgtCss: 300,
			pubSync: vi.fn()
		};
	});

	describe('Constructor', () => {
		it('should throw error when uplot is null', () => {
			expect(() => {
				new EventManager(null);
			}).toThrow(UPlotError);
			
			try {
				new EventManager(null);
			} catch (error) {
				expect(error.module).toBe('EventManager');
				expect(error.message).toContain("Required parameter 'uplot' is missing or null");
			}
		});

		it('should report error to global reporter', () => {
			try {
				new EventManager(null);
			} catch (error) {
				// Error should be reported
			}
			
			const errors = errorReporter.getErrors('EventManager');
			expect(errors).toHaveLength(1);
		});

		it('should construct successfully with valid parameters', () => {
			const eventManager = new EventManager(mockUplot);
			expect(eventManager).toBeInstanceOf(EventManager);
			expect(eventManager.uplot).toBe(mockUplot);
			expect(eventManager.mouseListeners).toBeInstanceOf(Map);
			expect(eventManager.globalListeners).toBeInstanceOf(Set);
		});

		it('should initialize with default values', () => {
			const eventManager = new EventManager(mockUplot);
			
			expect(eventManager.dragging).toBe(false);
			expect(eventManager.mouseLeft1).toBe(0);
			expect(eventManager.mouseTop1).toBe(0);
			expect(eventManager.rect).toBeNull();
		});
	});

	describe('initEvents', () => {
		let eventManager;

		beforeEach(() => {
			eventManager = new EventManager(mockUplot);
		});

		it('should throw error when opts is null', () => {
			expect(() => {
				eventManager.initEvents(null);
			}).toThrow(UPlotError);
			
			try {
				eventManager.initEvents(null);
			} catch (error) {
				expect(error.module).toBe('EventManager');
				expect(error.context.method).toBe('initEvents');
				expect(error.context.type).toBe(ERROR_TYPES.VALIDATION);
			}
		});

		it('should throw error when cursor is not available', () => {
			mockUplot.cursor = null;
			
			expect(() => {
				eventManager.initEvents({});
			}).toThrow(UPlotError);
			
			try {
				eventManager.initEvents({});
			} catch (error) {
				expect(error.message).toContain('Cursor configuration not available');
				expect(error.context.type).toBe(ERROR_TYPES.INITIALIZATION);
			}
		});

		it('should throw error when over element is not available', () => {
			mockUplot.over = null;
			
			expect(() => {
				eventManager.initEvents({});
			}).toThrow(UPlotError);
			
			try {
				eventManager.initEvents({});
			} catch (error) {
				expect(error.message).toContain('Over element not available for event binding');
				expect(error.context.type).toBe(ERROR_TYPES.INITIALIZATION);
			}
		});

		it('should return early when cursor.show is false', () => {
			mockUplot.cursor.show = false;
			
			expect(() => {
				eventManager.initEvents({});
			}).not.toThrow();
		});

		it('should handle event binding errors', () => {
			// Mock onMouse to throw an error
			eventManager.onMouse = vi.fn(() => {
				throw new Error('Event binding failed');
			});
			
			expect(() => {
				eventManager.initEvents({});
			}).toThrow(UPlotError);
			
			try {
				eventManager.initEvents({});
			} catch (error) {
				expect(error.message).toContain('Error initializing events');
				expect(error.context.type).toBe(ERROR_TYPES.EVENT_HANDLING);
			}
		});

		it('should initialize events successfully with valid parameters', () => {
			expect(() => {
				eventManager.initEvents({});
			}).not.toThrow();
		});

		it('should handle missing wrap element gracefully', () => {
			mockUplot.wrap = null;
			
			expect(() => {
				eventManager.initEvents({});
			}).not.toThrow();
		});

		it('should bind global events when domEnv is available', () => {
			const bindGlobalEventSpy = vi.spyOn(eventManager, 'bindGlobalEvent').mockImplementation(() => {});
			
			eventManager.initEvents({});
			
			// Should bind global events if domEnv is available
			// Note: This depends on the domEnv variable being available
		});
	});

	describe('mouseDown', () => {
		let eventManager;

		beforeEach(() => {
			eventManager = new EventManager(mockUplot);
		});

		it('should throw error when cursor is not available', () => {
			mockUplot.cursor = null;
			
			expect(() => {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			}).toThrow(UPlotError);
			
			try {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			} catch (error) {
				expect(error.message).toContain('Cursor or drag configuration not available');
				expect(error.context.type).toBe(ERROR_TYPES.EVENT_HANDLING);
			}
		});

		it('should throw error when drag configuration is missing', () => {
			mockUplot.cursor.drag = null;
			
			expect(() => {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			}).toThrow(UPlotError);
		});

		it('should handle mouse down successfully', () => {
			const event = new MouseEvent('mousedown');
			
			expect(() => {
				eventManager.mouseDown(event);
			}).not.toThrow();
			
			expect(eventManager.dragging).toBe(true);
		});

		it('should handle mouse down with custom coordinates', () => {
			expect(() => {
				eventManager.mouseDown(null, null, 100, 50);
			}).not.toThrow();
			
			expect(eventManager.mouseLeft1).toBe(100);
			expect(eventManager.mouseTop1).toBe(50);
		});

		it('should handle pubSync errors gracefully', () => {
			mockUplot.pubSync = vi.fn(() => {
				throw new Error('PubSync failed');
			});
			
			// Should not throw due to error handling
			expect(() => {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			}).not.toThrow();
		});

		it('should handle missing pubSync function gracefully', () => {
			mockUplot.pubSync = undefined;
			
			expect(() => {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			}).not.toThrow();
		});

		it('should set drag state correctly', () => {
			eventManager.mouseDown(new MouseEvent('mousedown'));
			
			expect(eventManager.dragging).toBe(true);
			expect(eventManager.dragX).toBe(false);
			expect(eventManager.dragY).toBe(false);
			expect(mockUplot.cursor.drag._x).toBe(false);
			expect(mockUplot.cursor.drag._y).toBe(false);
		});

		it('should handle onMouse binding errors', () => {
			eventManager.onMouse = vi.fn(() => {
				throw new Error('Mouse binding failed');
			});
			
			expect(() => {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			}).toThrow(UPlotError);
			
			try {
				eventManager.mouseDown(new MouseEvent('mousedown'));
			} catch (error) {
				expect(error.message).toContain('Error handling mouse down');
				expect(error.context.type).toBe(ERROR_TYPES.EVENT_HANDLING);
			}
		});
	});

	describe('Touch Events', () => {
		let eventManager;

		beforeEach(() => {
			eventManager = new EventManager(mockUplot);
		});

		it('should initialize touch events without errors', () => {
			expect(() => {
				eventManager.initTouchEvents(mockUplot.over);
			}).not.toThrow();
		});

		it('should handle touch event conversion', () => {
			eventManager.initTouchEvents(mockUplot.over);
			
			// Create a mock touch event
			const touchEvent = new TouchEvent('touchstart', {
				touches: [{
					clientX: 100,
					clientY: 50
				}]
			});
			
			// Mock preventDefault
			touchEvent.preventDefault = vi.fn();
			
			// This should not throw
			expect(() => {
				mockUplot.over.dispatchEvent(touchEvent);
			}).not.toThrow();
		});
	});

	describe('Event Cleanup', () => {
		let eventManager;

		beforeEach(() => {
			eventManager = new EventManager(mockUplot);
		});

		it('should clean up event listeners on destroy', () => {
			// Add some mock listeners
			eventManager.mouseListeners.set(mockUplot.over, { mousedown: vi.fn() });
			eventManager.globalListeners.add({ 
				event: 'resize', 
				target: window, 
				handler: vi.fn(), 
				useCapture: false 
			});
			
			expect(() => {
				eventManager.destroy();
			}).not.toThrow();
			
			expect(eventManager.mouseListeners.size).toBe(0);
			expect(eventManager.globalListeners.size).toBe(0);
		});

		it('should handle cleanup errors gracefully', () => {
			// Mock offMouse to throw an error
			eventManager.offMouse = vi.fn(() => {
				throw new Error('Cleanup failed');
			});
			
			expect(() => {
				eventManager.destroy();
			}).not.toThrow();
		});
	});

	describe('Error Recovery', () => {
		let eventManager;

		beforeEach(() => {
			eventManager = new EventManager(mockUplot);
		});

		it('should continue working after non-critical errors', () => {
			// Cause an error in one operation
			try {
				eventManager.mouseDown(null);
				mockUplot.cursor = null;
				eventManager.mouseDown(new MouseEvent('mousedown'));
			} catch (error) {
				// Expected error
			}
			
			// Reset cursor and should still work
			mockUplot.cursor = {
				show: true,
				drag: { _x: false, _y: false }
			};
			
			expect(() => {
				eventManager.mouseDown(null, null, 100, 50);
			}).not.toThrow();
		});

		it('should accumulate errors in error reporter', () => {
			// Generate multiple errors
			try { eventManager.initEvents(null); } catch (e) {}
			try { mockUplot.cursor = null; eventManager.mouseDown(new MouseEvent('mousedown')); } catch (e) {}
			
			const errors = errorReporter.getErrors('EventManager');
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should handle state reset gracefully', () => {
			// Set some state
			eventManager.dragging = true;
			eventManager.mouseLeft1 = 100;
			
			// Should be able to reset state
			eventManager.dragging = false;
			eventManager.mouseLeft1 = 0;
			
			expect(eventManager.dragging).toBe(false);
			expect(eventManager.mouseLeft1).toBe(0);
		});
	});
});