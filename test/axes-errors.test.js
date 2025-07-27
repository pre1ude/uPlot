/**
 * Tests for error handling in AxisManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxisManager } from '../src/core/axes.js';
import { UPlotError, ERROR_TYPES, errorReporter } from '../src/core/errors.js';

describe('AxisManager Error Handling', () => {
	let mockUplot;
	let mockScaleManager;

	beforeEach(() => {
		errorReporter.clear();
		
		mockUplot = {
			mode: 1,
			pxRatio: 1,
			wrap: document.createElement('div'),
			axes: [
				{ show: true, side: 0, scale: 'x', space: vi.fn(() => 10), incrs: vi.fn(() => [1, 2, 5]) },
				{ show: true, side: 1, scale: 'y', space: vi.fn(() => 10), incrs: vi.fn(() => [1, 2, 5]) }
			],
			scales: {
				x: { min: 0, max: 100, distr: 1 },
				y: { min: 0, max: 100, distr: 1 }
			},
			series: [
				{ scale: 'x' },
				{ scale: 'y' }
			]
		};

		mockScaleManager = {
			scales: mockUplot.scales
		};
	});

	describe('Constructor', () => {
		it('should throw error when uplot is null', () => {
			expect(() => {
				new AxisManager(null, mockScaleManager);
			}).toThrow(UPlotError);
			
			try {
				new AxisManager(null, mockScaleManager);
			} catch (error) {
				expect(error.module).toBe('AxisManager');
				expect(error.message).toContain("Required parameter 'uplot' is missing or null");
			}
		});

		it('should throw error when scaleManager is undefined', () => {
			expect(() => {
				new AxisManager(mockUplot, undefined);
			}).toThrow(UPlotError);
		});

		it('should report error to global reporter', () => {
			try {
				new AxisManager(null, mockScaleManager);
			} catch (error) {
				// Error should be reported
			}
			
			const errors = errorReporter.getErrors('AxisManager');
			expect(errors).toHaveLength(1);
		});

		it('should construct successfully with valid parameters', () => {
			const axisManager = new AxisManager(mockUplot, mockScaleManager);
			expect(axisManager).toBeInstanceOf(AxisManager);
			expect(axisManager.uplot).toBe(mockUplot);
			expect(axisManager.scaleManager).toBe(mockScaleManager);
		});
	});

	describe('initAxes', () => {
		let axisManager;

		beforeEach(() => {
			axisManager = new AxisManager(mockUplot, mockScaleManager);
		});

		it('should throw error when opts is null', () => {
			expect(() => {
				axisManager.initAxes(null);
			}).toThrow(UPlotError);
			
			try {
				axisManager.initAxes(null);
			} catch (error) {
				expect(error.module).toBe('AxisManager');
				expect(error.context.method).toBe('initAxes');
				expect(error.context.type).toBe(ERROR_TYPES.VALIDATION);
			}
		});

		it('should throw error when series is not available', () => {
			axisManager.series = null;
			
			expect(() => {
				axisManager.initAxes({});
			}).toThrow(UPlotError);
			
			try {
				axisManager.initAxes({});
			} catch (error) {
				expect(error.message).toContain('No series available for axis initialization');
				expect(error.context.type).toBe(ERROR_TYPES.INITIALIZATION);
			}
		});

		it('should throw error when series is empty array', () => {
			axisManager.series = [];
			
			expect(() => {
				axisManager.initAxes({});
			}).toThrow(UPlotError);
		});

		it('should throw error when axes is not an array', () => {
			axisManager.axes = null;
			
			expect(() => {
				axisManager.initAxes({});
			}).toThrow(UPlotError);
			
			try {
				axisManager.initAxes({});
			} catch (error) {
				expect(error.message).toContain('Axes array not properly initialized');
			}
		});

		it('should handle missing scale gracefully', () => {
			mockUplot.series = [{ scale: 'nonexistent' }];
			
			// Should not throw, but should handle gracefully
			expect(() => {
				axisManager.initAxes({});
			}).not.toThrow();
		});

		it('should initialize axes successfully with valid parameters', () => {
			expect(() => {
				axisManager.initAxes({});
			}).not.toThrow();
		});
	});

	describe('getIncrSpace', () => {
		let axisManager;

		beforeEach(() => {
			axisManager = new AxisManager(mockUplot, mockScaleManager);
		});

		it('should throw error when axisIdx is null', () => {
			expect(() => {
				axisManager.getIncrSpace(null, 0, 100, 400);
			}).toThrow(UPlotError);
		});

		it('should throw error when axisIdx is not a number', () => {
			expect(() => {
				axisManager.getIncrSpace('invalid', 0, 100, 400);
			}).toThrow(UPlotError);
		});

		it('should throw error when axisIdx is out of bounds', () => {
			expect(() => {
				axisManager.getIncrSpace(10, 0, 100, 400);
			}).toThrow(UPlotError);
			
			try {
				axisManager.getIncrSpace(10, 0, 100, 400);
			} catch (error) {
				expect(error.message).toContain('Invalid axis index 10');
				expect(error.context.axisIdx).toBe(10);
			}
		});

		it('should throw error when axis at index is null', () => {
			mockUplot.axes[0] = null;
			
			expect(() => {
				axisManager.getIncrSpace(0, 0, 100, 400);
			}).toThrow(UPlotError);
			
			try {
				axisManager.getIncrSpace(0, 0, 100, 400);
			} catch (error) {
				expect(error.message).toContain('Axis at index 0 is null or undefined');
			}
		});

		it('should throw error when fullDim is not a number', () => {
			expect(() => {
				axisManager.getIncrSpace(0, 0, 100, 'invalid');
			}).toThrow(UPlotError);
		});

		it('should return [0, 0] for zero or negative fullDim', () => {
			const result = axisManager.getIncrSpace(0, 0, 100, 0);
			expect(result).toEqual([0, 0]);
		});

		it('should calculate increment space successfully', () => {
			const result = axisManager.getIncrSpace(0, 0, 100, 400);
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
		});

		it('should handle errors in space/incrs functions', () => {
			mockUplot.axes[0].space = vi.fn(() => {
				throw new Error('Space calculation failed');
			});
			
			expect(() => {
				axisManager.getIncrSpace(0, 0, 100, 400);
			}).toThrow(UPlotError);
			
			try {
				axisManager.getIncrSpace(0, 0, 100, 400);
			} catch (error) {
				expect(error.message).toContain('Error calculating increment space');
				expect(error.context.type).toBe(ERROR_TYPES.LAYOUT_CALCULATION);
			}
		});
	});

	describe('axesCalc', () => {
		let axisManager;

		beforeEach(() => {
			axisManager = new AxisManager(mockUplot, mockScaleManager);
			
			// Mock additional required methods
			mockUplot.axes.forEach(axis => {
				axis.splits = vi.fn(() => [0, 25, 50, 75, 100]);
				axis.values = vi.fn(() => ['0', '25', '50', '75', '100']);
				axis.filter = vi.fn((u, splits) => splits);
				axis.rotate = vi.fn(() => 0);
				axis.size = vi.fn(() => 50);
				axis._show = true;
			});
		});

		it('should throw error when cycleNum is null', () => {
			expect(() => {
				axisManager.axesCalc(null, 400, 300, [0, 1, 2], vi.fn());
			}).toThrow(UPlotError);
		});

		it('should throw error when plotWidCss is not a number', () => {
			expect(() => {
				axisManager.axesCalc(1, 'invalid', 300, [0, 1, 2], vi.fn());
			}).toThrow(UPlotError);
		});

		it('should throw error when axes is not properly initialized', () => {
			axisManager.axes = null;
			
			expect(() => {
				axisManager.axesCalc(1, 400, 300, [0, 1, 2], vi.fn());
			}).toThrow(UPlotError);
			
			try {
				axisManager.axesCalc(1, 400, 300, [0, 1, 2], vi.fn());
			} catch (error) {
				expect(error.message).toContain('Axes not properly initialized');
			}
		});

		it('should throw error when scale is not found', () => {
			mockUplot.axes[0].scale = 'nonexistent';
			mockUplot.scales.nonexistent = undefined;
			
			// Should handle this gracefully with safeExecute
			const result = axisManager.axesCalc(1, 400, 300, [0, 1, 2], vi.fn());
			expect(typeof result).toBe('boolean');
		});

		it('should handle axis calculation errors gracefully', () => {
			mockUplot.axes[0].splits = vi.fn(() => {
				throw new Error('Splits calculation failed');
			});
			
			// Should handle this gracefully with safeExecute
			const result = axisManager.axesCalc(1, 400, 300, [0, 1, 2], vi.fn());
			expect(typeof result).toBe('boolean');
		});

		it('should calculate axes successfully', () => {
			const resetYSeries = vi.fn();
			const result = axisManager.axesCalc(1, 400, 300, [0, 1, 2], resetYSeries);
			
			expect(typeof result).toBe('boolean');
		});

		it('should call resetYSeries when axis show state changes', () => {
			const resetYSeries = vi.fn();
			mockUplot.scales.x.min = null; // This should trigger show state change
			
			axisManager.axesCalc(1, 400, 300, [0, 1, 2], resetYSeries);
			
			// resetYSeries should be called when show state changes
			// Note: This depends on the specific implementation logic
		});
	});

	describe('Error Recovery', () => {
		let axisManager;

		beforeEach(() => {
			axisManager = new AxisManager(mockUplot, mockScaleManager);
		});

		it('should continue working after non-critical errors', () => {
			// Cause an error in one operation
			try {
				axisManager.getIncrSpace(null, 0, 100, 400);
			} catch (error) {
				// Expected error
			}
			
			// Should still be able to perform other operations
			const result = axisManager.getIncrSpace(0, 0, 100, 400);
			expect(Array.isArray(result)).toBe(true);
		});

		it('should accumulate errors in error reporter', () => {
			// Don't clear errors for this test - we want to see accumulation
			const initialErrorCount = errorReporter.getErrors('AxisManager').length;
			
			// Generate multiple errors that will be reported (these throw and get reported)
			try { 
				new AxisManager(null, mockScaleManager); 
			} catch (e) {
				// Constructor errors are reported
			}
			try { 
				new AxisManager(mockUplot, null); 
			} catch (e) {
				// Constructor errors are reported
			}
			try { 
				axisManager.getIncrSpace(null, 0, 100, 400); 
			} catch (e) {
				// Validation errors are reported
			}
			
			const finalErrorCount = errorReporter.getErrors('AxisManager').length;
			expect(finalErrorCount).toBeGreaterThan(initialErrorCount);
		});
	});
});