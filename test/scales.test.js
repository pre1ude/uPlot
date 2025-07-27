import { describe, it, expect, beforeEach } from 'vitest';
import { ScaleManager } from '../src/core/scales.js';

describe('ScaleManager', () => {
	let uplot;
	let opts;
	let scaleManager;

	beforeEach(() => {
		// Mock uPlot instance
		uplot = {
			mode: 1,
			pxRatio: 1,
			data: [[0, 1, 2, 3, 4], [10, 20, 30, 40, 50]],
			series: [
				{ scale: 'x' },
				{ scale: 'y' }
			],
			axes: [
				{ scale: 'x', side: 2 },
				{ scale: 'y', side: 3 }
			],
			bbox: {
				left: 0,
				top: 0,
				width: 400,
				height: 300
			},
			layout: {
				plotWidCss: 400,
				plotHgtCss: 300,
				plotLftCss: 0,
				plotTopCss: 0
			},
			shouldSetScales: false
		};

		opts = {
			scales: {
				x: { min: null, max: null },
				y: { min: null, max: null }
			},
			series: [
				{ scale: 'x' },
				{ scale: 'y' }
			]
		};

		scaleManager = new ScaleManager(uplot, opts);
	});

	describe('constructor', () => {
		it('should initialize with correct properties', () => {
			expect(scaleManager.uplot).toBe(uplot);
			expect(scaleManager.opts).toBe(opts);
			expect(scaleManager.scales).toEqual({});
			expect(scaleManager.pendScales).toEqual({});
			expect(scaleManager.mode).toBe(1);
			expect(scaleManager.xScaleKey).toBe('x');
		});

		it('should determine correct xScaleKey for mode 2', () => {
			uplot.mode = 2;
			opts.series = [null, { facets: [{ scale: 'time' }] }];
			scaleManager = new ScaleManager(uplot, opts);
			expect(scaleManager.xScaleKey).toBe('time');
		});
	});

	describe('initScale', () => {
		it('should initialize basic x scale', () => {
			scaleManager.initScale('x');
			
			const xScale = scaleManager.scales.x;
			expect(xScale).toBeDefined();
			expect(xScale.key).toBe('x');
			expect(typeof xScale.valToPct).toBe('function');
		});

		it('should initialize basic y scale', () => {
			scaleManager.initScale('y');
			
			const yScale = scaleManager.scales.y;
			expect(yScale).toBeDefined();
			expect(yScale.key).toBe('y');
			expect(typeof yScale.valToPct).toBe('function');
		});

		it('should handle dependent scales', () => {
			// First initialize parent scale
			scaleManager.initScale('x');
			
			// Then initialize dependent scale
			opts.scales.dependent = { from: 'x', min: 0, max: 100 };
			scaleManager.initScale('dependent');
			
			const depScale = scaleManager.scales.dependent;
			expect(depScale).toBeDefined();
			expect(depScale.key).toBe('dependent');
			expect(depScale.min).toBe(0);
			expect(depScale.max).toBe(100);
		});

		it('should not reinitialize existing scales', () => {
			scaleManager.initScale('x');
			const originalScale = scaleManager.scales.x;
			
			scaleManager.initScale('x');
			expect(scaleManager.scales.x).toBe(originalScale);
		});
	});

	describe('initScales', () => {
		it('should initialize all required scales', () => {
			scaleManager.initScales();
			
			expect(scaleManager.scales.x).toBeDefined();
			expect(scaleManager.scales.y).toBeDefined();
		});

		it('should handle pending scales with initial values', () => {
			opts.scales.x = { min: 0, max: 10 };
			scaleManager = new ScaleManager(uplot, opts);
			scaleManager.initScales();
			
			expect(scaleManager.pendScales.x).toEqual({ min: 0, max: 10 });
			expect(scaleManager.scales.x.min).toBeNull();
			expect(scaleManager.scales.x.max).toBeNull();
		});
	});

	describe('position conversion functions', () => {
		beforeEach(() => {
			scaleManager.initScales();
			// Set up scale ranges
			scaleManager.scales.x.min = 0;
			scaleManager.scales.x.max = 10;
			scaleManager.scales.x._min = 0;
			scaleManager.scales.x._max = 10;
			scaleManager.scales.x.dir = 1;
			scaleManager.scales.x.ori = 0;
			
			scaleManager.scales.y.min = 0;
			scaleManager.scales.y.max = 100;
			scaleManager.scales.y._min = 0;
			scaleManager.scales.y._max = 100;
			scaleManager.scales.y.dir = 1;
			scaleManager.scales.y.ori = 1;
		});

		describe('getHPos', () => {
			it('should convert value to horizontal position correctly', () => {
				const scale = scaleManager.scales.x;
				const pos = scaleManager.getHPos(5, scale, 400, 0);
				expect(pos).toBe(200); // 5 is 50% of 0-10 range, so 50% of 400 = 200
			});

			it('should handle negative direction', () => {
				const scale = scaleManager.scales.x;
				scale.dir = -1;
				const pos = scaleManager.getHPos(5, scale, 400, 0);
				expect(pos).toBe(200); // (1 - 0.5) * 400 = 200
			});
		});

		describe('getVPos', () => {
			it('should convert value to vertical position correctly', () => {
				const scale = scaleManager.scales.y;
				const pos = scaleManager.getVPos(50, scale, 300, 0);
				expect(pos).toBe(150); // 50 is 50% of 0-100 range, inverted for vertical: (1-0.5) * 300 = 150
			});
		});

		describe('valToPosX and valToPosY', () => {
			it('should convert values to X positions', () => {
				const pos = scaleManager.valToPosX(5, scaleManager.scales.x, 400, 0);
				expect(pos).toBe(200);
			});

			it('should convert values to Y positions', () => {
				const pos = scaleManager.valToPosY(50, scaleManager.scales.y, 300, 0);
				expect(pos).toBe(150);
			});
		});

		describe('posToVal', () => {
			it('should convert position to value correctly', () => {
				const val = scaleManager.posToVal(200, 'x', false);
				expect(val).toBe(5); // 200 is 50% of 400, so 50% of 0-10 range = 5
			});

			it('should handle canvas coordinates', () => {
				const val = scaleManager.posToVal(200, 'x', true);
				expect(val).toBe(5);
			});
		});

		describe('posToValX and posToValY', () => {
			it('should convert X position to value', () => {
				const val = scaleManager.posToValX(200, false);
				expect(val).toBe(5);
			});

			it('should convert Y position to value', () => {
				const val = scaleManager.posToValY(150, 'y', false);
				expect(val).toBe(50);
			});
		});
	});

	describe('scale management', () => {
		beforeEach(() => {
			scaleManager.initScales();
		});

		describe('setScale', () => {
			it('should queue scale changes', () => {
				scaleManager.setScale('x', { min: 0, max: 10 });
				expect(scaleManager.pendScales.x).toEqual({ min: 0, max: 10 });
				expect(uplot.shouldSetScales).toBe(true);
			});

			it('should swap min/max if min > max', () => {
				scaleManager.setScale('x', { min: 10, max: 0 });
				expect(scaleManager.pendScales.x).toEqual({ min: 0, max: 10 });
			});

			it('should ignore invalid scale keys', () => {
				scaleManager.setScale('invalid', { min: 0, max: 10 });
				expect(scaleManager.pendScales.invalid).toBeUndefined();
			});
		});

		describe('_setScale', () => {
			it('should be a shorthand for setScale with min/max', () => {
				scaleManager._setScale('x', 0, 10);
				expect(scaleManager.pendScales.x).toEqual({ min: 0, max: 10 });
			});
		});

		describe('autoScaleX', () => {
			it('should auto-scale X axis based on data', () => {
				scaleManager.autoScaleX();
				expect(scaleManager.viaAutoScaleX).toBe(true);
				expect(scaleManager.pendScales.x).toBeDefined();
			});

			it('should handle empty data', () => {
				uplot.data = [];
				scaleManager.autoScaleX();
				expect(scaleManager.pendScales.x).toEqual({ min: null, max: null });
			});
		});

		describe('setScales', () => {
			it('should process pending scale changes', () => {
				scaleManager.pendScales.x = { min: 0, max: 10 };
				const changed = scaleManager.setScales();
				
				expect(changed.x).toBe(true);
				expect(scaleManager.scales.x.min).toBe(0);
				expect(scaleManager.scales.x.max).toBe(10);
				expect(scaleManager.pendScales).toEqual({});
			});

			it('should handle auto-scaling', () => {
				// Mock auto function
				scaleManager.scales.x.auto = () => true;
				scaleManager.pendScales.x = { min: 0, max: 10 };
				
				const changed = scaleManager.setScales();
				expect(changed.x).toBe(true);
			});
		});
	});

	describe('utility methods', () => {
		beforeEach(() => {
			scaleManager.initScales();
		});

		describe('getScale', () => {
			it('should return scale by key', () => {
				const scale = scaleManager.getScale('x');
				expect(scale).toBe(scaleManager.scales.x);
			});

			it('should return undefined for invalid key', () => {
				const scale = scaleManager.getScale('invalid');
				expect(scale).toBeUndefined();
			});
		});

		describe('getXScale', () => {
			it('should return X scale', () => {
				const scale = scaleManager.getXScale();
				expect(scale).toBe(scaleManager.scales.x);
			});
		});

		describe('getAllScales', () => {
			it('should return all scales', () => {
				const scales = scaleManager.getAllScales();
				expect(scales).toBe(scaleManager.scales);
			});
		});

		describe('hasScale', () => {
			it('should return true for existing scale', () => {
				expect(scaleManager.hasScale('x')).toBe(true);
			});

			it('should return false for non-existing scale', () => {
				expect(scaleManager.hasScale('invalid')).toBe(false);
			});
		});

		describe('updateScale', () => {
			it('should update scale options', () => {
				scaleManager.updateScale('x', { min: 5, max: 15 });
				expect(scaleManager.scales.x.min).toBe(5);
				expect(scaleManager.scales.x.max).toBe(15);
			});

			it('should reinitialize valToPct when distribution changes', () => {
				const originalValToPct = scaleManager.scales.x.valToPct;
				scaleManager.updateScale('x', { distr: 3 });
				expect(scaleManager.scales.x.valToPct).not.toBe(originalValToPct);
			});

			it('should ignore invalid scale keys', () => {
				expect(() => {
					scaleManager.updateScale('invalid', { min: 0 });
				}).not.toThrow();
			});
		});
	});

	describe('initValToPct', () => {
		it('should create linear conversion function', () => {
			const scale = {
				distr: 1,
				_min: 0,
				_max: 10,
				clamp: () => {}
			};
			
			const valToPct = scaleManager.initValToPct(scale);
			expect(valToPct(5)).toBe(0.5);
			expect(valToPct(0)).toBe(0);
			expect(valToPct(10)).toBe(1);
		});

		it('should create log conversion function', () => {
			const scale = {
				distr: 3,
				_min: 0, // log10(1)
				_max: 2, // log10(100)
				min: 1,
				max: 100,
				key: 'test',
				clamp: (self, val, min, max, key) => Math.max(min, Math.min(max, val))
			};
			
			const valToPct = scaleManager.initValToPct(scale);
			expect(valToPct(10)).toBe(0.5); // log10(10) = 1, which is 50% between 0 and 2
		});

		it('should create asinh conversion function', () => {
			const scale = {
				distr: 4,
				_min: 0,
				_max: 2,
				asinh: 1
			};
			
			const valToPct = scaleManager.initValToPct(scale);
			expect(typeof valToPct).toBe('function');
		});

		it('should create custom conversion function', () => {
			const scale = {
				distr: 100,
				_min: 0,
				_max: 10,
				fwd: (val) => val * 2
			};
			
			const valToPct = scaleManager.initValToPct(scale);
			expect(valToPct(2.5)).toBe(0.5); // fwd(2.5) = 5, which is 50% between 0 and 10
		});
	});
});