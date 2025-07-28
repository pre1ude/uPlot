import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../src/core/renderer.js';

// Mock canvas context
const createMockContext = () => ({
	canvas: {
		width: 800,
		height: 600,
		style: {}
	},
	clearRect: vi.fn(),
	save: vi.fn(),
	restore: vi.fn(),
	translate: vi.fn(),
	rotate: vi.fn(),
	clip: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	stroke: vi.fn(),
	fill: vi.fn(),
	fillText: vi.fn(),
	setLineDash: vi.fn(),
	strokeStyle: '',
	fillStyle: '',
	lineWidth: 1,
	lineCap: 'butt',
	lineJoin: 'round',
	font: '',
	textAlign: '',
	textBaseline: '',
	globalAlpha: 1
});

// Mock uPlot instance
const createMockUPlot = (overrides = {}) => {
	const ctx = createMockContext();
	return {
		ctx,
		can: ctx.canvas,
		opts: { drawOrder: ["axes", "series"] },
		pxRatio: 1,
	series: [],
	data: [[]],
	axes: [],
	scales: {},
	bands: [],
	focus: { alpha: 0.3 },
	mode: 1,
	plotLft: 50,
	plotTop: 50,
	plotWid: 700,
	plotHgt: 500,
	i0: 0,
	i1: 100,
	pxRound: (val) => Math.round(val),
	getPos: vi.fn((val, scale, dim, off) => off + val),
	fire: vi.fn(),
	isFn: (val) => typeof val === 'function',
	PI: Math.PI,
	isArr: Array.isArray,
	EMPTY_OBJ: {},
	hasData: vi.fn(() => true),
	...overrides
};
};

// Mock layout manager
const createMockLayoutManager = () => ({
	fullWidCss: 800,
	fullHgtCss: 600
});

describe('Renderer', () => {
	let renderer;
	let mockUPlot;
	let mockLayoutManager;

	beforeEach(() => {
		mockUPlot = createMockUPlot();
		mockLayoutManager = createMockLayoutManager();
		renderer = new Renderer(mockUPlot, mockLayoutManager);
	});

	describe('constructor', () => {
		it('should initialize with uPlot and layoutManager references', () => {
			expect(renderer.u).toBe(mockUPlot);
			expect(renderer.layoutManager).toBe(mockLayoutManager);
			expect(renderer.ctx).toBe(mockUPlot.ctx);
			expect(renderer.can).toBe(mockUPlot.can);
		});

		it('should initialize style cache properties', () => {
			expect(renderer.ctxStroke).toBe(null);
			expect(renderer.ctxFill).toBe(null);
			expect(renderer.ctxWidth).toBe(null);
			expect(renderer.ctxAlpha).toBe(1);
		});

		it('should set up draw order map', () => {
			expect(renderer.drawOrderMap).toHaveProperty('axes');
			expect(renderer.drawOrderMap).toHaveProperty('series');
			expect(typeof renderer.drawOrderMap.axes).toBe('function');
			expect(typeof renderer.drawOrderMap.series).toBe('function');
		});
	});

	describe('initCanvas', () => {
		it('should set canvas dimensions based on layout and pixel ratio', () => {
			mockUPlot.pxRatio = 2;
			mockLayoutManager.fullWidCss = 400;
			mockLayoutManager.fullHgtCss = 300;

			renderer.initCanvas();

			expect(renderer.can.width).toBe(800); // 400 * 2
			expect(renderer.can.height).toBe(600); // 300 * 2
			expect(renderer.can.style.width).toBe('400px');
			expect(renderer.can.style.height).toBe('300px');
		});

		it('should invalidate style cache', () => {
			renderer.ctxStroke = 'red';
			renderer.ctxFill = 'blue';
			
			renderer.initCanvas();
			
			expect(renderer.ctxStroke).toBe(null);
			expect(renderer.ctxFill).toBe(null);
		});
	});

	describe('clear', () => {
		it('should clear the entire canvas', () => {
			renderer.clear();
			
			expect(mockUPlot.ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
		});
	});

	describe('draw', () => {
		it('should clear canvas and execute draw order when dimensions are positive', () => {
			const clearSpy = vi.spyOn(renderer, 'clear');
			const drawAxesGridSpy = vi.spyOn(renderer, 'drawAxesGrid').mockImplementation(() => {});
			const drawSeriesSpy = vi.spyOn(renderer, 'drawSeries').mockImplementation(() => {});

			renderer.draw();

			expect(clearSpy).toHaveBeenCalled();
			expect(mockUPlot.fire).toHaveBeenCalledWith("drawClear");
			expect(drawAxesGridSpy).toHaveBeenCalled();
			expect(drawSeriesSpy).toHaveBeenCalled();
			expect(mockUPlot.fire).toHaveBeenCalledWith("draw");
		});

		it('should not draw when dimensions are zero', () => {
			mockLayoutManager.fullWidCss = 0;
			mockLayoutManager.fullHgtCss = 0;
			
			const clearSpy = vi.spyOn(renderer, 'clear');
			
			renderer.draw();
			
			expect(clearSpy).not.toHaveBeenCalled();
			expect(mockUPlot.fire).not.toHaveBeenCalled();
		});
	});

	describe('setCtxStyle', () => {
		it('should set stroke style when different from cached value', () => {
			renderer.setCtxStyle('red', 2, [], 'round', 'blue');
			
			expect(mockUPlot.ctx.strokeStyle).toBe('red');
			expect(renderer.ctxStroke).toBe('red');
		});

		it('should not set stroke style when same as cached value', () => {
			renderer.ctxStroke = 'red';
			mockUPlot.ctx.strokeStyle = 'red';
			
			renderer.setCtxStyle('red', 2, [], 'round', 'blue');
			
			// Should not change since it's the same
			expect(mockUPlot.ctx.strokeStyle).toBe('red');
		});

		it('should set all style properties correctly', () => {
			renderer.setCtxStyle('red', 3, [5, 5], 'round', 'blue', 'miter');
			
			expect(mockUPlot.ctx.strokeStyle).toBe('red');
			expect(mockUPlot.ctx.fillStyle).toBe('blue');
			expect(mockUPlot.ctx.lineWidth).toBe(3);
			expect(mockUPlot.ctx.lineCap).toBe('round');
			expect(mockUPlot.ctx.lineJoin).toBe('miter');
			expect(mockUPlot.ctx.setLineDash).toHaveBeenCalledWith([5, 5]);
		});

		it('should use default values for undefined parameters', () => {
			renderer.setCtxStyle();
			
			// transparent is "#0000" from strings.js
			expect(renderer.ctxStroke).toBe('#0000');
			expect(mockUPlot.ctx.lineCap).toBe('butt');
			expect(mockUPlot.ctx.lineJoin).toBe('round');
			expect(mockUPlot.ctx.setLineDash).toHaveBeenCalledWith([]);
		});
	});

	describe('setFontStyle', () => {
		it('should set font properties when different from cached values', () => {
			renderer.setFontStyle('12px Arial', 'black', 'center', 'middle');
			
			expect(mockUPlot.ctx.fillStyle).toBe('black');
			expect(mockUPlot.ctx.font).toBe('12px Arial');
			expect(mockUPlot.ctx.textAlign).toBe('center');
			expect(mockUPlot.ctx.textBaseline).toBe('middle');
		});

		it('should not set properties when same as cached values', () => {
			renderer.ctxFont = '12px Arial';
			renderer.ctxFill = 'black';
			renderer.ctxAlign = 'center';
			renderer.ctxBaseline = 'middle';
			
			mockUPlot.ctx.font = '12px Arial';
			mockUPlot.ctx.fillStyle = 'black';
			mockUPlot.ctx.textAlign = 'center';
			mockUPlot.ctx.textBaseline = 'middle';
			
			renderer.setFontStyle('12px Arial', 'black', 'center', 'middle');
			
			// Values should remain the same since they're cached
			expect(mockUPlot.ctx.font).toBe('12px Arial');
			expect(mockUPlot.ctx.fillStyle).toBe('black');
		});
	});

	describe('cacheStrokeFill', () => {
		it('should cache stroke and fill for series', () => {
			const mockSeries = {
				stroke: vi.fn(() => 'red'),
				fill: vi.fn(() => 'blue')
			};
			mockUPlot.series = [null, mockSeries];
			
			renderer.cacheStrokeFill(1, false);
			
			expect(mockSeries.stroke).toHaveBeenCalledWith(mockUPlot, 1);
			expect(mockSeries.fill).toHaveBeenCalledWith(mockUPlot, 1);
			expect(mockSeries._stroke).toBe('red');
			expect(mockSeries._fill).toBe('blue');
		});

		it('should cache stroke and fill for points', () => {
			const mockPoints = {
				stroke: vi.fn(() => 'green'),
				fill: vi.fn(() => 'yellow')
			};
			const mockSeries = { points: mockPoints };
			mockUPlot.series = [null, mockSeries];
			
			renderer.cacheStrokeFill(1, true);
			
			expect(mockPoints.stroke).toHaveBeenCalledWith(mockUPlot, 1);
			expect(mockPoints.fill).toHaveBeenCalledWith(mockUPlot, 1);
			expect(mockPoints._stroke).toBe('green');
			expect(mockPoints._fill).toBe('yellow');
		});
	});

	describe('getOuterIdxs', () => {
		it('should return full range for data without nulls', () => {
			const data = [1, 2, 3, 4, 5];
			const result = renderer.getOuterIdxs(data);
			
			expect(result).toEqual([0, 4]);
		});

		it('should skip leading nulls', () => {
			const data = [null, null, 1, 2, 3];
			const result = renderer.getOuterIdxs(data);
			
			expect(result).toEqual([2, 4]);
		});

		it('should skip trailing nulls', () => {
			const data = [1, 2, 3, null, null];
			const result = renderer.getOuterIdxs(data);
			
			expect(result).toEqual([0, 2]);
		});

		it('should skip both leading and trailing nulls', () => {
			const data = [null, 1, 2, 3, null];
			const result = renderer.getOuterIdxs(data);
			
			expect(result).toEqual([1, 3]);
		});

		it('should handle all null data', () => {
			const data = [null, null, null];
			const result = renderer.getOuterIdxs(data);
			
			expect(result).toEqual([3, 2]); // i0 > i1 indicates no valid data
		});

		it('should handle empty data', () => {
			const data = [];
			const result = renderer.getOuterIdxs(data);
			
			expect(result).toEqual([0, -1]);
		});
	});

	describe('invalidateStyleCache', () => {
		it('should reset all cached style properties', () => {
			// Set some cached values
			renderer.ctxStroke = 'red';
			renderer.ctxFill = 'blue';
			renderer.ctxWidth = 5;
			renderer.ctxAlpha = 0.5;
			
			renderer.invalidateStyleCache();
			
			expect(renderer.ctxStroke).toBe(null);
			expect(renderer.ctxFill).toBe(null);
			expect(renderer.ctxWidth).toBe(null);
			expect(renderer.ctxJoin).toBe(null);
			expect(renderer.ctxCap).toBe(null);
			expect(renderer.ctxFont).toBe(null);
			expect(renderer.ctxAlign).toBe(null);
			expect(renderer.ctxBaseline).toBe(null);
			expect(renderer.ctxDash).toBe(null);
			expect(renderer.ctxAlpha).toBe(1);
		});
	});

	describe('doStroke', () => {
		it('should stroke path when lineWidth > 0', () => {
			const mockPath = {};
			
			renderer.doStroke('red', mockPath, 2);
			
			expect(mockUPlot.ctx.stroke).toHaveBeenCalledWith(mockPath);
		});

		it('should not stroke when lineWidth is 0', () => {
			const mockPath = {};
			
			renderer.doStroke('red', mockPath, 0);
			
			expect(mockUPlot.ctx.stroke).not.toHaveBeenCalled();
		});

		it('should handle Map of paths with different styles', () => {
			const pathMap = new Map([
				['red', {}],
				['blue', {}]
			]);
			
			renderer.doStroke(null, pathMap, 2);
			
			expect(mockUPlot.ctx.stroke).toHaveBeenCalledTimes(2);
			expect(renderer.ctxStroke).toBe('blue'); // Last one set
		});

		it('should not stroke when path is null', () => {
			renderer.doStroke('red', null, 2);
			
			expect(mockUPlot.ctx.stroke).not.toHaveBeenCalled();
		});
	});

	describe('doFill', () => {
		it('should fill path when fillStyle and fillPath are provided', () => {
			const mockPath = {};
			
			renderer.doFill('blue', mockPath);
			
			expect(mockUPlot.ctx.fill).toHaveBeenCalledWith(mockPath);
		});

		it('should handle Map of paths with different styles', () => {
			const pathMap = new Map([
				['red', {}],
				['blue', {}]
			]);
			
			renderer.doFill(null, pathMap);
			
			expect(mockUPlot.ctx.fill).toHaveBeenCalledTimes(2);
			expect(renderer.ctxFill).toBe('blue'); // Last one set
		});

		it('should not fill when path is null', () => {
			renderer.doFill('blue', null);
			
			expect(mockUPlot.ctx.fill).not.toHaveBeenCalled();
		});

		it('should not fill when fillStyle is null', () => {
			const mockPath = {};
			
			renderer.doFill(null, mockPath);
			
			expect(mockUPlot.ctx.fill).not.toHaveBeenCalled();
		});
	});
});