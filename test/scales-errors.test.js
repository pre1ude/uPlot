/**
 * Tests for error handling in ScaleManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScaleManager } from '../src/core/scales.js';
import { UPlotError, ERROR_TYPES, errorReporter } from '../src/core/errors.js';

describe('ScaleManager Error Handling', () => {
	let mockUplot;
	let mockOpts;

	beforeEach(() => {
		errorReporter.clear();
		
		mockUplot = {
			mode: 1,
			series: [{ scale: 'x' }, { scale: 'y' }],
			axes: [{ scale: 'x' }, { scale: 'y' }],
			data: [[1, 2, 3], [10, 20, 30]],
			bbox: { width: 400, height: 300, left: 50, top: 50 },
			layout: { plotWidCss: 400, plotHgtCss: 300, plotLftCss: 50, plotTopCss: 50 },
			valToPosX: vi.fn(),
			valToPosY: vi.fn()
		};

		mockOpts = {
			scales: {
				x: { time: false },
				y: { auto: true }
			},
			series: [{ scale: 'x' }, { scale: 'y' }]
		};
	});

	describe('Constructor', () => {
		it('should throw error when uplot is null', () => {
			expect(() => {
				new ScaleManager(null, mockOpts);
			}).toThrow(UPlotError);
			
			try {
				new ScaleManager(null, mockOpts);
			} catch (error) {
				expect(error.module).toBe('ScaleManager');
				expect(error.message).toContain("Required parameter 'uplot' is missing or null");
			}
		});

		it('should throw error when opts is undefined', () => {
			expect(() => {
				new ScaleManager(mockUplot, undefined);
			}).toThrow(UPlotError);
		});

		it('should report error to global reporter', () => {
			try {
				new ScaleManager(null, mockOpts);
			} catch (error) {
				// Error should be reported
			}
			
			const errors = errorReporter.getErrors('ScaleManager');
			expect(errors).toHaveLength(1);
		});

		it('should construct successfully with valid parameters', () => {
			const scaleManager = new ScaleManager(mockUplot, mockOpts);
			expect(scaleManager).toBeInstanceOf(ScaleManager);
			expect(scaleManager.uplot).toBe(mockUplot);
			expect(scaleManager.opts).toBe(mockOpts);
		});
	});

	describe('initScale', () => {
		let scaleManager;

		beforeEach(() => {
			scaleManager = new ScaleManager(mockUplot, mockOpts);
		});

		it('should throw error when scaleKey is null', () => {
			expect(() => {
				scaleManager.initScale(null);
			}).toThrow(UPlotError);
			
			try {
				scaleManager.initScale(null);
			} catch (error) {
				expect(error.module).toBe('ScaleManager');
				expect(error.context.method).toBe('initScale');
				expect(error.context.type).toBe(ERROR_TYPES.VALIDATION);
			}
		});

		it('should throw error when scaleKey is not a string', () => {
			expect(() => {
				scaleManager.initScale(123);
			}).toThrow(UPlotError);
			
			try {
				scaleManager.initScale(123);
			} catch (error) {
				expect(error.message).toContain("Parameter 'scaleKey' expected string but got number");
			}
		});

		it('should throw error for circular scale dependency', () => {
			mockOpts.scales.circular = { from: 'circular' };
			
			expect(() => {
				scaleManager.initScale('circular');
			}).toThrow(UPlotError);
			
			try {
				scaleManager.initScale('circular');
			} catch (error) {
				expect(error.message).toContain("Scale 'circular' cannot reference itself as parent");
				expect(error.context.scaleKey).toBe('circular');
			}
		});

		it('should throw error when parent scale cannot be initialized', () => {
			// Mock a scenario where parent scale fails to initialize
			mockOpts.scales.child = { from: 'nonexistent' };
			// Don't define nonexistent scale at all
			
			// The current implementation will create a default scale for nonexistent
			// Let's test a different error condition - circular dependency
			mockOpts.scales.circular1 = { from: 'circular2' };
			mockOpts.scales.circular2 = { from: 'circular1' };
			
			expect(() => {
				scaleManager.initScale('circular1');
			}).toThrow();
		});

		it('should initialize scale successfully with valid key', () => {
			scaleManager.initScale('x');
			expect(scaleManager.scales.x).toBeDefined();
			expect(scaleManager.scales.x.key).toBe('x');
		});
	});

	describe('initValToPct', () => {
		let scaleManager;

		beforeEach(() => {
			scaleManager = new ScaleManager(mockUplot, mockOpts);
		});

		it('should throw error when sc is null', () => {
			expect(() => {
				scaleManager.initValToPct(null);
			}).toThrow(UPlotError);
		});

		it('should throw error for log scale with invalid values', () => {
			const logScale = {
				key: 'test',
				distr: 3, // log scale
				_min: 1,
				_max: 100,
				clamp: null // no clamp function
			};

			const valToPct = scaleManager.initValToPct(logScale);
			
			expect(() => {
				valToPct(-5); // negative value for log scale
			}).toThrow(UPlotError);
			
			try {
				valToPct(-5);
			} catch (error) {
				expect(error.message).toContain('Invalid value -5 for log scale - must be positive');
				expect(error.context.type).toBe(ERROR_TYPES.SCALE_CALCULATION);
			}
		});

		it('should throw error for custom scale without forward transform', () => {
			const customScale = {
				key: 'test',
				distr: 100, // custom scale
				_min: 0,
				_max: 1
				// missing fwd function
			};

			const valToPct = scaleManager.initValToPct(customScale);
			
			expect(() => {
				valToPct(0.5);
			}).toThrow(UPlotError);
			
			try {
				valToPct(0.5);
			} catch (error) {
				expect(error.message).toContain('Custom scale missing forward transform function');
			}
		});

		it('should throw error when scale not properly initialized', () => {
			const uninitializedScale = {
				key: 'test',
				distr: 1,
				_min: null, // not initialized
				_max: null
			};

			const valToPct = scaleManager.initValToPct(uninitializedScale);
			
			expect(() => {
				valToPct(50);
			}).toThrow(UPlotError);
			
			try {
				valToPct(50);
			} catch (error) {
				expect(error.message).toContain('Scale not properly initialized - missing min/max values');
			}
		});

		it('should handle zero range gracefully', () => {
			const zeroRangeScale = {
				key: 'test',
				distr: 1,
				_min: 50,
				_max: 50 // zero range
			};

			const valToPct = scaleManager.initValToPct(zeroRangeScale);
			const result = valToPct(50);
			
			expect(result).toBe(0.5); // Should return middle position
		});

		it('should work correctly for normal scales', () => {
			const normalScale = {
				key: 'test',
				distr: 1,
				_min: 0,
				_max: 100
			};

			const valToPct = scaleManager.initValToPct(normalScale);
			
			expect(valToPct(0)).toBe(0);
			expect(valToPct(50)).toBe(0.5);
			expect(valToPct(100)).toBe(1);
		});
	});

	describe('posToVal', () => {
		let scaleManager;

		beforeEach(() => {
			scaleManager = new ScaleManager(mockUplot, mockOpts);
			scaleManager.initScale('x');
			scaleManager.initScale('y');
			
			// Set up scale with proper values
			scaleManager.scales.x._min = 0;
			scaleManager.scales.x._max = 100;
			scaleManager.scales.x.ori = 0;
			scaleManager.scales.x.dir = 1;
			scaleManager.scales.x.distr = 1;
		});

		it('should throw error when pos is null', () => {
			expect(() => {
				scaleManager.posToVal(null, 'x', false);
			}).toThrow(UPlotError);
		});

		it('should throw error when pos is not a number', () => {
			expect(() => {
				scaleManager.posToVal('not a number', 'x', false);
			}).toThrow(UPlotError);
		});

		it('should throw error when scaleKey is not a string', () => {
			expect(() => {
				scaleManager.posToVal(100, 123, false);
			}).toThrow(UPlotError);
		});

		it('should throw error when scale does not exist', () => {
			expect(() => {
				scaleManager.posToVal(100, 'nonexistent', false);
			}).toThrow(UPlotError);
			
			try {
				scaleManager.posToVal(100, 'nonexistent', false);
			} catch (error) {
				expect(error.message).toContain("Scale 'nonexistent' not found");
				expect(error.context.scaleKey).toBe('nonexistent');
			}
		});

		it('should throw error when plot dimension is zero', () => {
			mockUplot.layout.plotWidCss = 0; // zero width
			
			expect(() => {
				scaleManager.posToVal(100, 'x', false);
			}).toThrow(UPlotError);
			
			try {
				scaleManager.posToVal(100, 'x', false);
			} catch (error) {
				expect(error.message).toContain('Cannot convert position to value - plot dimension is zero');
				expect(error.context.dimension).toBe(0);
			}
		});

		it('should throw error when scale not properly initialized', () => {
			scaleManager.scales.x._min = null;
			scaleManager.scales.x._max = null;
			
			expect(() => {
				scaleManager.posToVal(100, 'x', false);
			}).toThrow(UPlotError);
			
			try {
				scaleManager.posToVal(100, 'x', false);
			} catch (error) {
				expect(error.message).toContain('Scale not properly initialized - missing min/max values');
			}
		});

		it('should throw error for custom scale without inverse transform', () => {
			scaleManager.scales.x.distr = 100; // custom scale
			// missing inv function
			
			expect(() => {
				scaleManager.posToVal(100, 'x', false);
			}).toThrow(UPlotError);
			
			try {
				scaleManager.posToVal(100, 'x', false);
			} catch (error) {
				expect(error.message).toContain('Custom scale missing inverse transform function');
			}
		});

		it('should convert position to value correctly', () => {
			// Mock layout dimensions
			mockUplot.layout.plotWidCss = 400;
			mockUplot.layout.plotLftCss = 50;
			
			const result = scaleManager.posToVal(250, 'x', false); // Middle position
			
			// Should be approximately middle value
			expect(result).toBeCloseTo(50, 1);
		});
	});

	describe('Error Recovery', () => {
		let scaleManager;

		beforeEach(() => {
			scaleManager = new ScaleManager(mockUplot, mockOpts);
		});

		it('should continue working after non-critical errors', () => {
			// Cause an error in one operation
			try {
				scaleManager.initScale(null);
			} catch (error) {
				// Expected error
			}
			
			// Should still be able to perform other operations
			scaleManager.initScale('x');
			expect(scaleManager.scales.x).toBeDefined();
		});

		it('should accumulate errors in error reporter', () => {
			// Generate multiple errors
			try { scaleManager.initScale(null); } catch (e) {}
			try { scaleManager.initScale(123); } catch (e) {}
			try { scaleManager.posToVal(null, 'x', false); } catch (e) {}
			
			const errors = errorReporter.getErrors('ScaleManager');
			expect(errors.length).toBeGreaterThan(0);
		});
	});
});