/**
 * Tests for error handling in SeriesManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SeriesManager } from '../src/core/series.js';
import { UPlotError, ERROR_TYPES, errorReporter } from '../src/core/errors.js';

describe('SeriesManager Error Handling', () => {
	let mockUplot;
	let mockScaleManager;

	beforeEach(() => {
		errorReporter.clear();
		
		mockUplot = {
			mode: 1,
			opts: {
				series: [{ scale: 'x' }, { scale: 'y' }]
			},
			fire: vi.fn()
		};

		mockScaleManager = {
			scales: {
				x: { time: false },
				y: { time: false }
			}
		};
	});

	describe('Constructor', () => {
		it('should throw error when uplot is null', () => {
			expect(() => {
				new SeriesManager(null, mockScaleManager);
			}).toThrow(UPlotError);
			
			try {
				new SeriesManager(null, mockScaleManager);
			} catch (error) {
				expect(error.module).toBe('SeriesManager');
				expect(error.message).toContain("Required parameter 'uplot' is missing or null");
			}
		});

		it('should throw error when scaleManager is undefined', () => {
			expect(() => {
				new SeriesManager(mockUplot, undefined);
			}).toThrow(UPlotError);
		});

		it('should report error to global reporter', () => {
			try {
				new SeriesManager(null, mockScaleManager);
			} catch (error) {
				// Error should be reported
			}
			
			const errors = errorReporter.getErrors('SeriesManager');
			expect(errors).toHaveLength(1);
		});

		it('should construct successfully with valid parameters', () => {
			const seriesManager = new SeriesManager(mockUplot, mockScaleManager);
			expect(seriesManager).toBeInstanceOf(SeriesManager);
			expect(seriesManager.uplot).toBe(mockUplot);
			expect(seriesManager.scaleManager).toBe(mockScaleManager);
		});
	});

	describe('initSeries', () => {
		let seriesManager;

		beforeEach(() => {
			seriesManager = new SeriesManager(mockUplot, mockScaleManager);
		});

		it('should throw error when opts is null', () => {
			expect(() => {
				seriesManager.initSeries(null);
			}).toThrow(UPlotError);
			
			try {
				seriesManager.initSeries(null);
			} catch (error) {
				expect(error.module).toBe('SeriesManager');
				expect(error.context.method).toBe('initSeries');
				expect(error.context.type).toBe(ERROR_TYPES.VALIDATION);
			}
		});

		it('should throw error when series options is not an array', () => {
			expect(() => {
				seriesManager.initSeries({ series: 'not an array' });
			}).toThrow(UPlotError);
			
			try {
				seriesManager.initSeries({ series: 'not an array' });
			} catch (error) {
				expect(error.message).toContain('Series options must be an array');
				expect(error.context.seriesOptsType).toBe('string');
			}
		});

		it('should handle errors in setDefaults gracefully', () => {
			// Mock setDefaults to throw an error
			seriesManager.setDefaults = vi.fn(() => {
				throw new Error('Defaults setting failed');
			});
			
			expect(() => {
				seriesManager.initSeries({ series: [] });
			}).toThrow(UPlotError);
			
			try {
				seriesManager.initSeries({ series: [] });
			} catch (error) {
				expect(error.message).toContain('Error setting series defaults');
				expect(error.context.type).toBe(ERROR_TYPES.INITIALIZATION);
			}
		});

		it('should initialize series successfully with valid parameters', () => {
			const result = seriesManager.initSeries({ series: [] });
			expect(Array.isArray(result)).toBe(true);
			expect(mockUplot.series).toBe(result);
		});

		it('should handle processSeriesConfig errors gracefully', () => {
			// Mock processSeriesConfig to throw an error
			seriesManager.processSeriesConfig = vi.fn(() => {
				throw new Error('Config processing failed');
			});
			
			// Should not throw due to safeExecute wrapper
			expect(() => {
				seriesManager.initSeries({ series: [{}] });
			}).not.toThrow();
		});

		it('should set up time formatting functions when FEAT_TIME is enabled', () => {
			const opts = {
				series: [],
				tzDate: (ts) => new Date(ts),
				fmtDate: (ts) => ts.toString()
			};
			
			seriesManager.initSeries(opts);
			
			expect(seriesManager._tzDate).toBeDefined();
			expect(seriesManager._fmtDate).toBeDefined();
		});
	});

	describe('addSeries', () => {
		let seriesManager;

		beforeEach(() => {
			seriesManager = new SeriesManager(mockUplot, mockScaleManager);
			seriesManager.initSeries({ series: [{ scale: 'x' }] });
		});

		it('should throw error when opts is null', () => {
			expect(() => {
				seriesManager.addSeries(null);
			}).toThrow(UPlotError);
		});

		it('should throw error when series index is invalid', () => {
			expect(() => {
				seriesManager.addSeries({}, -1);
			}).toThrow(UPlotError);
			
			try {
				seriesManager.addSeries({}, -1);
			} catch (error) {
				expect(error.message).toContain('Invalid series index -1');
				expect(error.context.seriesIndex).toBe(-1);
			}
		});

		it('should throw error when series index is out of bounds', () => {
			expect(() => {
				seriesManager.addSeries({}, 10);
			}).toThrow(UPlotError);
			
			try {
				seriesManager.addSeries({}, 10);
			} catch (error) {
				expect(error.message).toContain('Series index 10 is out of bounds');
				expect(error.context.maxIndex).toBe(seriesManager.series.length);
			}
		});

		it('should handle errors in series processing', () => {
			// Mock processSeriesConfig to throw an error
			seriesManager.processSeriesConfig = vi.fn(() => {
				throw new Error('Processing failed');
			});
			
			expect(() => {
				seriesManager.addSeries({});
			}).toThrow();
			
			try {
				seriesManager.addSeries({});
			} catch (error) {
				// The original error is thrown, but it should be reported to errorReporter
				expect(error.message).toContain('Processing failed');
			}
		});

		it('should add series successfully with valid parameters', () => {
			const initialLength = seriesManager.series.length;
			const result = seriesManager.addSeries({ scale: 'y' });
			
			expect(result).toBe(initialLength);
			expect(seriesManager.series.length).toBe(initialLength + 1);
			expect(mockUplot.fire).toHaveBeenCalledWith('addSeries', result);
		});

		it('should insert series at specified index', () => {
			const result = seriesManager.addSeries({ scale: 'y' }, 0);
			
			expect(result).toBe(0);
			expect(seriesManager.series[0].scale).toBe('y');
		});

		it('should handle missing fire function gracefully', () => {
			mockUplot.fire = undefined;
			
			expect(() => {
				seriesManager.addSeries({ scale: 'y' });
			}).not.toThrow();
		});
	});

	describe('delSeries', () => {
		let seriesManager;

		beforeEach(() => {
			seriesManager = new SeriesManager(mockUplot, mockScaleManager);
			seriesManager.initSeries({ series: [{ scale: 'x' }, { scale: 'y' }] });
		});

		it('should throw error when index is null', () => {
			expect(() => {
				seriesManager.delSeries(null);
			}).toThrow(UPlotError);
		});

		it('should throw error when index is not a number', () => {
			expect(() => {
				seriesManager.delSeries('invalid');
			}).toThrow(UPlotError);
		});

		it('should throw error when index is out of bounds', () => {
			expect(() => {
				seriesManager.delSeries(10);
			}).toThrow(UPlotError);
			
			try {
				seriesManager.delSeries(10);
			} catch (error) {
				expect(error.message).toContain('Invalid series index 10');
				expect(error.context.seriesLength).toBe(seriesManager.series.length);
			}
		});

		it('should throw error when trying to delete x-axis series in mode 1', () => {
			expect(() => {
				seriesManager.delSeries(0);
			}).toThrow(UPlotError);
			
			try {
				seriesManager.delSeries(0);
			} catch (error) {
				expect(error.message).toContain('Cannot delete the x-axis series (index 0) in mode 1');
				expect(error.context.mode).toBe(1);
			}
		});

		it('should allow deleting x-axis series in mode 2', () => {
			seriesManager.mode = 2;
			const initialLength = seriesManager.series.length;
			
			const result = seriesManager.delSeries(0);
			
			expect(result).toBe(0);
			expect(seriesManager.series.length).toBe(initialLength - 1);
		});

		it('should delete series successfully', () => {
			const initialLength = seriesManager.series.length;
			const result = seriesManager.delSeries(1);
			
			expect(result).toBe(1);
			expect(seriesManager.series.length).toBe(initialLength - 1);
			expect(mockUplot.fire).toHaveBeenCalledWith('delSeries', 1);
		});

		it('should handle errors during deletion', () => {
			// Mock splice to throw an error
			seriesManager.series.splice = vi.fn(() => {
				throw new Error('Splice failed');
			});
			
			expect(() => {
				seriesManager.delSeries(1);
			}).toThrow(UPlotError);
			
			try {
				seriesManager.delSeries(1);
			} catch (error) {
				expect(error.message).toContain('Error removing series at index 1');
				expect(error.context.type).toBe(ERROR_TYPES.DATA_PROCESSING);
			}
		});

		it('should handle missing fire function gracefully', () => {
			mockUplot.fire = undefined;
			
			expect(() => {
				seriesManager.delSeries(1);
			}).not.toThrow();
		});
	});

	describe('Error Recovery', () => {
		let seriesManager;

		beforeEach(() => {
			seriesManager = new SeriesManager(mockUplot, mockScaleManager);
		});

		it('should continue working after non-critical errors', () => {
			// Cause an error in one operation
			try {
				seriesManager.addSeries(null);
			} catch (error) {
				// Expected error
			}
			
			// Should still be able to perform other operations
			seriesManager.initSeries({ series: [] });
			expect(Array.isArray(seriesManager.series)).toBe(true);
		});

		it('should accumulate errors in error reporter', () => {
			// Generate multiple errors
			try { seriesManager.addSeries(null); } catch (e) {}
			try { seriesManager.delSeries('invalid'); } catch (e) {}
			try { seriesManager.initSeries(null); } catch (e) {}
			
			const errors = errorReporter.getErrors('SeriesManager');
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should handle partial initialization gracefully', () => {
			// Initialize with minimal data
			const result = seriesManager.initSeries({ series: [] });
			expect(Array.isArray(result)).toBe(true);
			
			// Should be able to add series after partial initialization
			expect(() => {
				seriesManager.addSeries({ scale: 'y' });
			}).not.toThrow();
		});
	});
});