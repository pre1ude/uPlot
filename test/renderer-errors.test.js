/**
 * Tests for error handling in Renderer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../src/core/renderer.js';
import { UPlotError, ERROR_TYPES, errorReporter } from '../src/core/errors.js';

describe('Renderer Error Handling', () => {
	let mockUplot;
	let mockLayoutManager;
	let mockCanvas;
	let mockCtx;

	beforeEach(() => {
		errorReporter.clear();
		
		// Mock canvas and context
		mockCtx = {
			clearRect: vi.fn(),
			translate: vi.fn(),
			save: vi.fn(),
			restore: vi.fn(),
			beginPath: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			stroke: vi.fn(),
			fill: vi.fn(),
			clip: vi.fn(),
			fillText: vi.fn(),
			rotate: vi.fn(),
			setLineDash: vi.fn()
		};

		mockCanvas = {
			width: 400,
			height: 300,
			style: {}
		};

		mockUplot = {
			ctx: mockCtx,
			can: mockCanvas,
			pxRatio: 1,
			opts: {
				drawOrder: ['axes', 'series']
			},
			fire: vi.fn()
		};

		mockLayoutManager = {
			fullWidCss: 400,
			fullHgtCss: 300
		};

		// Add canvas to context
		mockCtx.canvas = mockCanvas;
	});

	describe('Constructor', () => {
		it('should throw error when uplot is null', () => {
			expect(() => {
				new Renderer(null, mockLayoutManager);
			}).toThrow(UPlotError);
			
			try {
				new Renderer(null, mockLayoutManager);
			} catch (error) {
				expect(error.module).toBe('Renderer');
				expect(error.message).toContain("Required parameter 'uplot' is missing or null");
			}
		});

		it('should throw error when layoutManager is undefined', () => {
			expect(() => {
				new Renderer(mockUplot, undefined);
			}).toThrow(UPlotError);
		});

		it('should throw error when uplot missing canvas context', () => {
			mockUplot.ctx = null;
			
			expect(() => {
				new Renderer(mockUplot, mockLayoutManager);
			}).toThrow(UPlotError);
			
			try {
				new Renderer(mockUplot, mockLayoutManager);
			} catch (error) {
				expect(error.message).toContain('uPlot instance missing canvas context');
				expect(error.context.type).toBe(ERROR_TYPES.INITIALIZATION);
			}
		});

		it('should throw error when drawOrder is not an array', () => {
			mockUplot.opts.drawOrder = 'invalid';
			
			expect(() => {
				new Renderer(mockUplot, mockLayoutManager);
			}).toThrow(UPlotError);
			
			try {
				new Renderer(mockUplot, mockLayoutManager);
			} catch (error) {
				expect(error.message).toContain('drawOrder option must be an array');
				expect(error.context.drawOrderType).toBe('string');
			}
		});

		it('should throw error for invalid drawOrder key', () => {
			mockUplot.opts.drawOrder = ['invalid'];
			
			expect(() => {
				new Renderer(mockUplot, mockLayoutManager);
			}).toThrow(UPlotError);
			
			try {
				new Renderer(mockUplot, mockLayoutManager);
			} catch (error) {
				expect(error.message).toContain('Invalid draw order key: invalid');
				expect(error.context.invalidKey).toBe('invalid');
			}
		});

		it('should report error to global reporter', () => {
			try {
				new Renderer(null, mockLayoutManager);
			} catch (error) {
				// Error should be reported
			}
			
			const errors = errorReporter.getErrors('Renderer');
			expect(errors).toHaveLength(1);
		});

		it('should construct successfully with valid parameters', () => {
			const renderer = new Renderer(mockUplot, mockLayoutManager);
			expect(renderer).toBeInstanceOf(Renderer);
			expect(renderer.u).toBe(mockUplot);
			expect(renderer.layoutManager).toBe(mockLayoutManager);
		});

		it('should use default drawOrder when not specified', () => {
			delete mockUplot.opts.drawOrder;
			
			const renderer = new Renderer(mockUplot, mockLayoutManager);
			expect(renderer.drawOrder).toHaveLength(2);
		});
	});

	describe('initCanvas', () => {
		let renderer;

		beforeEach(() => {
			renderer = new Renderer(mockUplot, mockLayoutManager);
		});

		it('should throw error when pixel ratio is invalid', () => {
			mockUplot.pxRatio = 0;
			
			expect(() => {
				renderer.initCanvas({});
			}).toThrow(UPlotError);
			
			try {
				renderer.initCanvas({});
			} catch (error) {
				expect(error.message).toContain('Invalid pixel ratio: 0');
				expect(error.context.pxRatio).toBe(0);
			}
		});

		it('should throw error when pixel ratio is negative', () => {
			mockUplot.pxRatio = -1;
			
			expect(() => {
				renderer.initCanvas({});
			}).toThrow(UPlotError);
		});

		it('should throw error when dimensions are not numbers', () => {
			mockLayoutManager.fullWidCss = 'invalid';
			
			expect(() => {
				renderer.initCanvas({});
			}).toThrow(UPlotError);
			
			try {
				renderer.initCanvas({});
			} catch (error) {
				expect(error.message).toContain('Invalid canvas dimensions');
				expect(error.context.fullWidCss).toBe('invalid');
			}
		});

		it('should throw error when dimensions are zero or negative', () => {
			mockLayoutManager.fullWidCss = 0;
			
			expect(() => {
				renderer.initCanvas({});
			}).toThrow(UPlotError);
			
			try {
				renderer.initCanvas({});
			} catch (error) {
				expect(error.message).toContain('Invalid canvas dimensions');
				expect(error.context.fullWidCss).toBe(0);
			}
		});

		it('should handle canvas initialization errors', () => {
			// Mock canvas to throw error when setting width
			Object.defineProperty(mockCanvas, 'width', {
				set: () => {
					throw new Error('Canvas width setting failed');
				}
			});
			
			expect(() => {
				renderer.initCanvas({});
			}).toThrow(UPlotError);
			
			try {
				renderer.initCanvas({});
			} catch (error) {
				expect(error.message).toContain('Error initializing canvas');
				expect(error.context.type).toBe(ERROR_TYPES.RENDERING);
			}
		});

		it('should initialize canvas successfully with valid parameters', () => {
			// Make canvas properties writable
			Object.defineProperty(mockCanvas, 'width', {
				writable: true,
				value: 400
			});
			Object.defineProperty(mockCanvas, 'height', {
				writable: true,
				value: 300
			});
			
			expect(() => {
				renderer.initCanvas({});
			}).not.toThrow();
			
			expect(mockCanvas.width).toBe(400);
			expect(mockCanvas.height).toBe(300);
			expect(mockCanvas.style.width).toBe('400px');
			expect(mockCanvas.style.height).toBe('300px');
		});

		it('should handle high pixel ratio correctly', () => {
			mockUplot.pxRatio = 2;
			
			renderer.initCanvas({});
			
			expect(mockCanvas.width).toBe(800);
			expect(mockCanvas.height).toBe(600);
			expect(mockCanvas.style.width).toBe('400px');
			expect(mockCanvas.style.height).toBe('300px');
		});
	});

	describe('draw', () => {
		let renderer;

		beforeEach(() => {
			renderer = new Renderer(mockUplot, mockLayoutManager);
		});

		it('should not draw when dimensions are zero', () => {
			mockLayoutManager.fullWidCss = 0;
			
			renderer.draw();
			
			expect(mockCtx.clearRect).not.toHaveBeenCalled();
		});

		it('should handle drawing errors gracefully', () => {
			// Mock clear to throw an error
			renderer.clear = vi.fn(() => {
				throw new Error('Clear failed');
			});
			
			expect(() => {
				renderer.draw();
			}).toThrow(UPlotError);
			
			try {
				renderer.draw();
			} catch (error) {
				expect(error.message).toContain('Error during rendering');
				expect(error.context.type).toBe(ERROR_TYPES.RENDERING);
			}
		});

		it('should handle missing fire function gracefully', () => {
			mockUplot.fire = undefined;
			
			expect(() => {
				renderer.draw();
			}).not.toThrow();
		});

		it('should execute draw order functions', () => {
			const drawAxesSpy = vi.spyOn(renderer, 'drawAxesGrid').mockImplementation(() => {});
			const drawSeriesSpy = vi.spyOn(renderer, 'drawSeries').mockImplementation(() => {});
			
			renderer.draw();
			
			expect(drawAxesSpy).toHaveBeenCalled();
			expect(drawSeriesSpy).toHaveBeenCalled();
		});

		it('should handle errors in draw order functions gracefully', () => {
			vi.spyOn(renderer, 'drawAxesGrid').mockImplementation(() => {
				throw new Error('Draw axes failed');
			});
			vi.spyOn(renderer, 'drawSeries').mockImplementation(() => {});
			
			// Should not throw due to safeExecute wrapper
			expect(() => {
				renderer.draw();
			}).not.toThrow();
		});

		it('should fire draw events', () => {
			vi.spyOn(renderer, 'drawAxesGrid').mockImplementation(() => {});
			vi.spyOn(renderer, 'drawSeries').mockImplementation(() => {});
			
			renderer.draw();
			
			expect(mockUplot.fire).toHaveBeenCalledWith('drawClear');
			expect(mockUplot.fire).toHaveBeenCalledWith('draw');
		});
	});

	describe('clear', () => {
		let renderer;

		beforeEach(() => {
			renderer = new Renderer(mockUplot, mockLayoutManager);
		});

		it('should throw error when context is not available', () => {
			renderer.ctx = null;
			
			expect(() => {
				renderer.clear();
			}).toThrow(UPlotError);
			
			try {
				renderer.clear();
			} catch (error) {
				expect(error.message).toContain('Canvas context not available');
				expect(error.context.type).toBe(ERROR_TYPES.RENDERING);
			}
		});

		it('should handle clearRect errors', () => {
			mockCtx.clearRect = vi.fn(() => {
				throw new Error('ClearRect failed');
			});
			
			expect(() => {
				renderer.clear();
			}).toThrow(UPlotError);
			
			try {
				renderer.clear();
			} catch (error) {
				expect(error.message).toContain('Error clearing canvas');
				expect(error.context.type).toBe(ERROR_TYPES.RENDERING);
			}
		});

		it('should clear canvas successfully', () => {
			renderer.clear();
			
			expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 400, 300);
		});
	});

	describe('Error Recovery', () => {
		let renderer;

		beforeEach(() => {
			renderer = new Renderer(mockUplot, mockLayoutManager);
		});

		it('should continue working after non-critical errors', () => {
			// Cause an error in one operation
			try {
				renderer.initCanvas({ pxRatio: -1 });
			} catch (error) {
				// Expected error
			}
			
			// Should still be able to perform other operations
			mockUplot.pxRatio = 1;
			expect(() => {
				renderer.initCanvas({});
			}).not.toThrow();
		});

		it('should accumulate errors in error reporter', () => {
			// Generate errors that get reported to the error reporter
			// Constructor errors are reported automatically
			try {
				new Renderer(null, mockLayoutManager);
			} catch (e) {
				// Constructor reports errors to errorReporter
			}
			
			try {
				new Renderer(mockUplot, null);
			} catch (e) {
				// Constructor reports errors to errorReporter
			}
			
			const errors = errorReporter.getErrors('Renderer');
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should handle style cache invalidation gracefully', () => {
			expect(() => {
				renderer.invalidateStyleCache();
			}).not.toThrow();
			
			expect(renderer.ctxStroke).toBeNull();
			expect(renderer.ctxFill).toBeNull();
		});
	});
});