/**
 * Tests for error handling in LegendManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LegendManager } from '../src/core/legend.js';
import { UPlotError, ERROR_TYPES, errorReporter } from '../src/core/errors.js';

describe('LegendManager Error Handling', () => {
	let mockUplot;

	beforeEach(() => {
		errorReporter.clear();
		
		mockUplot = {
			series: [
				{ scale: 'x', label: 'X Axis' },
				{ scale: 'y', label: 'Y Axis', values: null }
			],
			fire: vi.fn()
		};
	});

	describe('Constructor', () => {
		it('should throw error when uplot is null', () => {
			expect(() => {
				new LegendManager(null);
			}).toThrow(UPlotError);
			
			try {
				new LegendManager(null);
			} catch (error) {
				expect(error.module).toBe('LegendManager');
				expect(error.message).toContain("Required parameter 'uplot' is missing or null");
			}
		});

		it('should report error to global reporter', () => {
			try {
				new LegendManager(null);
			} catch (error) {
				// Error should be reported
			}
			
			const errors = errorReporter.getErrors('LegendManager');
			expect(errors).toHaveLength(1);
		});

		it('should construct successfully with valid parameters', () => {
			const legendManager = new LegendManager(mockUplot);
			expect(legendManager).toBeInstanceOf(LegendManager);
			expect(legendManager.uplot).toBe(mockUplot);
			expect(legendManager.mouseListeners).toBeInstanceOf(Map);
		});

		it('should initialize with default values', () => {
			const legendManager = new LegendManager(mockUplot);
			
			expect(legendManager.legend).toBeNull();
			expect(legendManager.showLegend).toBe(false);
			expect(legendManager.legendRows).toEqual([]);
			expect(legendManager.legendCells).toEqual([]);
			expect(legendManager.multiValLegend).toBe(false);
		});
	});

	describe('initLegend', () => {
		let legendManager;
		let mockRoot;

		beforeEach(() => {
			legendManager = new LegendManager(mockUplot);
			mockRoot = document.createElement('div');
		});

		it('should return early when FEAT_LEGEND is disabled', () => {
			// Mock FEAT_LEGEND to be false
			const originalFeatLegend = require('../src/feats.js').FEAT_LEGEND;
			vi.doMock('../src/feats.js', () => ({ FEAT_LEGEND: false }));
			
			const result = legendManager.initLegend({}, [], [], 1, mockRoot, {}, {});
			expect(result).toBeUndefined();
		});

		it('should throw error when opts is null', () => {
			expect(() => {
				legendManager.initLegend(null, [], [], 1, mockRoot, {}, {});
			}).toThrow(UPlotError);
			
			try {
				legendManager.initLegend(null, [], [], 1, mockRoot, {}, {});
			} catch (error) {
				expect(error.module).toBe('LegendManager');
				expect(error.context.method).toBe('initLegend');
				expect(error.context.type).toBe(ERROR_TYPES.VALIDATION);
			}
		});

		it('should throw error when series is not an array', () => {
			expect(() => {
				legendManager.initLegend({}, 'not array', [], 1, mockRoot, {}, {});
			}).toThrow(UPlotError);
			
			try {
				legendManager.initLegend({}, 'not array', [], 1, mockRoot, {}, {});
			} catch (error) {
				expect(error.message).toContain('Series must be an array');
				expect(error.context.seriesType).toBe('string');
			}
		});

		it('should throw error when activeIdxs is not an array', () => {
			expect(() => {
				legendManager.initLegend({}, [], 'not array', 1, mockRoot, {}, {});
			}).toThrow(UPlotError);
			
			try {
				legendManager.initLegend({}, [], 'not array', 1, mockRoot, {}, {});
			} catch (error) {
				expect(error.message).toContain('ActiveIdxs must be an array');
				expect(error.context.activeIdxsType).toBe('string');
			}
		});

		it('should throw error when root is missing', () => {
			expect(() => {
				legendManager.initLegend({}, [], [], 1, null, {}, {});
			}).toThrow(UPlotError);
		});

		it('should handle legend initialization errors', () => {
			// Mock assign to throw an error
			const originalAssign = require('../src/utils.js').assign;
			vi.doMock('../src/utils.js', () => ({
				...require('../src/utils.js'),
				assign: vi.fn(() => {
					throw new Error('Assign failed');
				})
			}));
			
			expect(() => {
				legendManager.initLegend({}, [], [], 1, mockRoot, {}, {});
			}).toThrow(UPlotError);
			
			try {
				legendManager.initLegend({}, [], [], 1, mockRoot, {}, {});
			} catch (error) {
				expect(error.message).toContain('Error initializing legend');
				expect(error.context.type).toBe(ERROR_TYPES.INITIALIZATION);
			}
		});

		it('should initialize legend successfully with valid parameters', () => {
			const opts = { legend: { show: true, live: false } };
			const series = [{ scale: 'x' }, { scale: 'y' }];
			const activeIdxs = [0, 1];
			
			const result = legendManager.initLegend(opts, series, activeIdxs, 1, mockRoot, {}, {});
			
			expect(result).toBeDefined();
			expect(legendManager.legend).toBeDefined();
		});

		it('should handle multi-value legend initialization', () => {
			const opts = { legend: { show: true, live: true } };
			const series = [
				{ scale: 'x' }, 
				{ scale: 'y', values: vi.fn(() => ({ val1: 0, val2: 0 })) }
			];
			const activeIdxs = [0, 1];
			
			const result = legendManager.initLegend(opts, series, activeIdxs, 1, mockRoot, {}, {});
			
			expect(result).toBeDefined();
			expect(legendManager.multiValLegend).toBe(true);
		});

		it('should handle missing legend mount function gracefully', () => {
			const opts = { legend: { show: true, mount: undefined } };
			const series = [{ scale: 'x' }, { scale: 'y' }];
			const activeIdxs = [0, 1];
			
			expect(() => {
				legendManager.initLegend(opts, series, activeIdxs, 1, mockRoot, {}, {});
			}).not.toThrow();
		});

		it('should create DOM elements when legend is shown', () => {
			const opts = { legend: { show: true } };
			const series = [{ scale: 'x' }, { scale: 'y' }];
			const activeIdxs = [0, 1];
			
			legendManager.initLegend(opts, series, activeIdxs, 1, mockRoot, {}, {});
			
			expect(legendManager.legendTable).toBeDefined();
			expect(legendManager.legendBody).toBeDefined();
		});

		it('should not create DOM elements when legend is hidden', () => {
			const opts = { legend: { show: false } };
			const series = [{ scale: 'x' }, { scale: 'y' }];
			const activeIdxs = [0, 1];
			
			legendManager.initLegend(opts, series, activeIdxs, 1, mockRoot, {}, {});
			
			expect(legendManager.legendTable).toBeNull();
			expect(legendManager.legendBody).toBeNull();
		});
	});

	describe('Legend Row Management', () => {
		let legendManager;
		let mockRoot;

		beforeEach(() => {
			legendManager = new LegendManager(mockUplot);
			mockRoot = document.createElement('div');
			
			// Initialize legend first
			const opts = { legend: { show: true } };
			const series = [{ scale: 'x' }, { scale: 'y' }];
			const activeIdxs = [0, 1];
			legendManager.initLegend(opts, series, activeIdxs, 1, mockRoot, {}, {});
		});

		it('should add legend row successfully', () => {
			const series = { scale: 'y', label: 'Test Series', show: true };
			
			expect(() => {
				legendManager.addLegendRow(series, 1, [series], 1, {}, {});
			}).not.toThrow();
		});

		it('should remove legend row successfully', () => {
			// Add a row first
			const series = { scale: 'y', label: 'Test Series', show: true };
			legendManager.addLegendRow(series, 1, [series], 1, {}, {});
			
			expect(() => {
				legendManager.removeLegendRow(1);
			}).not.toThrow();
		});

		it('should handle missing legend gracefully', () => {
			legendManager.showLegend = false;
			
			expect(() => {
				legendManager.addLegendRow({}, 1, [], 1, {}, {});
			}).not.toThrow();
			
			expect(() => {
				legendManager.removeLegendRow(1);
			}).not.toThrow();
		});
	});

	describe('Legend Updates', () => {
		let legendManager;

		beforeEach(() => {
			legendManager = new LegendManager(mockUplot);
			legendManager.legend = { values: [] };
			legendManager.showLegend = true;
		});

		it('should update series legend successfully', () => {
			legendManager.legendRows = [null, document.createElement('tr')];
			
			expect(() => {
				legendManager.updateSeriesLegend(1, { show: true });
			}).not.toThrow();
		});

		it('should handle missing legend rows gracefully', () => {
			legendManager.legendRows = [];
			
			expect(() => {
				legendManager.updateSeriesLegend(1, { show: true });
			}).not.toThrow();
		});

		it('should set series opacity successfully', () => {
			legendManager.legendRows = [null, document.createElement('tr')];
			
			expect(() => {
				legendManager.setSeriesOpacity(1, 0.5);
			}).not.toThrow();
			
			expect(legendManager.legendRows[1].style.opacity).toBe('0.5');
		});
	});

	describe('Event Handling', () => {
		let legendManager;

		beforeEach(() => {
			legendManager = new LegendManager(mockUplot);
		});

		it('should bind mouse events successfully', () => {
			const target = document.createElement('div');
			const handler = vi.fn();
			
			// Mock cursor bind
			mockUplot.cursor = {
				bind: {
					click: vi.fn(() => handler)
				}
			};
			
			expect(() => {
				legendManager.onMouse('click', target, handler);
			}).not.toThrow();
		});

		it('should unbind mouse events successfully', () => {
			const target = document.createElement('div');
			
			expect(() => {
				legendManager.offMouse('click', target);
			}).not.toThrow();
		});

		it('should clean up all event listeners on destroy', () => {
			// Add some mock listeners
			legendManager.mouseListeners.set(document.createElement('div'), { click: vi.fn() });
			
			expect(() => {
				legendManager.destroy();
			}).not.toThrow();
			
			expect(legendManager.mouseListeners.size).toBe(0);
		});
	});

	describe('Error Recovery', () => {
		let legendManager;

		beforeEach(() => {
			legendManager = new LegendManager(mockUplot);
		});

		it('should continue working after non-critical errors', () => {
			// Cause an error in one operation
			try {
				legendManager.initLegend(null, [], [], 1, document.createElement('div'), {}, {});
			} catch (error) {
				// Expected error
			}
			
			// Should still be able to perform other operations
			expect(() => {
				legendManager.updateSeriesLegend(0, { show: true });
			}).not.toThrow();
		});

		it('should accumulate errors in error reporter', () => {
			// Generate multiple errors
			try { legendManager.initLegend(null, [], [], 1, document.createElement('div'), {}, {}); } catch (e) {}
			try { legendManager.initLegend({}, 'not array', [], 1, document.createElement('div'), {}, {}); } catch (e) {}
			
			const errors = errorReporter.getErrors('LegendManager');
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should handle DOM cleanup gracefully', () => {
			legendManager.legendTable = document.createElement('table');
			legendManager.legendRows = [document.createElement('tr')];
			
			expect(() => {
				legendManager.destroy();
			}).not.toThrow();
			
			expect(legendManager.legendRows).toEqual([]);
			expect(legendManager.legend).toBeNull();
		});
	});
});