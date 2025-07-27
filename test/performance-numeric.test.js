/**
 * Performance validation tests for numeric (non-time) data
 * 
 * This test suite focuses on performance metrics using numeric data only
 * to avoid time series validation issues during testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import uPlot from '../src/uPlot.js';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  ITERATIONS: 10,
  MAX_INIT_TIME: 50,
  MAX_RENDER_TIME: 16,
  MEMORY_TOLERANCE: 1024 * 1024,
  DATA_SIZES: {
    SMALL: 100,
    MEDIUM: 1000,
    LARGE: 10000,
  }
};

// Numeric data generators (no time series)
function generateNumericData(size) {
  const data = [[], []];
  
  for (let i = 0; i < size; i++) {
    data[0].push(i);
    data[1].push(Math.sin(i * 0.1) * 100 + Math.random() * 20);
  }
  
  return data;
}

function generateMultiSeriesNumericData(size, seriesCount = 3) {
  const data = [[]];
  
  // Initialize series arrays
  for (let s = 0; s < seriesCount; s++) {
    data.push([]);
  }
  
  // Generate data points
  for (let i = 0; i < size; i++) {
    data[0].push(i);
    for (let s = 1; s <= seriesCount; s++) {
      data[s].push(Math.sin(i * 0.1 * s) * 100 + Math.random() * 20);
    }
  }
  
  return data;
}

// Performance measurement utilities
class PerformanceMonitor {
  constructor() {
    this.measurements = {};
  }
  
  startMeasurement(name) {
    this.measurements[name] = {
      startTime: performance.now(),
      startMemory: this.getMemoryUsage()
    };
  }
  
  endMeasurement(name) {
    if (!this.measurements[name]) {
      throw new Error(`No measurement started for: ${name}`);
    }
    
    const measurement = this.measurements[name];
    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();
    
    return {
      duration: endTime - measurement.startTime,
      memoryDelta: endMemory - measurement.startMemory,
      startMemory: measurement.startMemory,
      endMemory: endMemory
    };
  }
  
  getMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }
  
  measure(name, fn) {
    this.startMeasurement(name);
    const result = fn();
    const metrics = this.endMeasurement(name);
    return { result, metrics };
  }
}

describe('Numeric Performance Validation and Optimization', () => {
  let monitor;
  let container;
  
  beforeEach(() => {
    monitor = new PerformanceMonitor();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '400px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  describe('Initialization Performance', () => {
    it('should initialize within acceptable time limits for small datasets', () => {
      const data = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.SMALL);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' }
        ]
      };
      
      const durations = [];
      
      for (let i = 0; i < PERFORMANCE_CONFIG.ITERATIONS; i++) {
        const { metrics } = monitor.measure(`init-small-${i}`, () => {
          const plot = new uPlot(opts, data, container);
          plot.destroy();
          return plot;
        });
        durations.push(metrics.duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average initialization time (small dataset): ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME);
    });
    
    it('should initialize within acceptable time limits for medium datasets', () => {
      const data = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' }
        ]
      };
      
      const durations = [];
      
      for (let i = 0; i < PERFORMANCE_CONFIG.ITERATIONS; i++) {
        const { metrics } = monitor.measure(`init-medium-${i}`, () => {
          const plot = new uPlot(opts, data, container);
          plot.destroy();
          return plot;
        });
        durations.push(metrics.duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average initialization time (medium dataset): ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 2);
    });
    
    it('should initialize within acceptable time limits for large datasets', () => {
      const data = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.LARGE);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' }
        ]
      };
      
      const durations = [];
      
      for (let i = 0; i < Math.min(PERFORMANCE_CONFIG.ITERATIONS, 5); i++) {
        const { metrics } = monitor.measure(`init-large-${i}`, () => {
          const plot = new uPlot(opts, data, container);
          plot.destroy();
          return plot;
        });
        durations.push(metrics.duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average initialization time (large dataset): ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 5);
    });
  });
  
  describe('Rendering Performance', () => {
    it('should render updates within frame rate limits', () => {
      const data = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' }
        ]
      };
      
      const plot = new uPlot(opts, data, container);
      const durations = [];
      
      for (let i = 0; i < PERFORMANCE_CONFIG.ITERATIONS; i++) {
        const newData = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
        
        const { metrics } = monitor.measure(`render-${i}`, () => {
          plot.setData(newData);
        });
        
        durations.push(metrics.duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average render time: ${avgDuration.toFixed(2)}ms`);
      
      plot.destroy();
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME);
    });
    
    it('should handle resize operations efficiently', () => {
      const data = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' }
        ]
      };
      
      const plot = new uPlot(opts, data, container);
      const durations = [];
      
      const sizes = [
        { width: 600, height: 300 },
        { width: 1000, height: 500 },
        { width: 800, height: 400 },
        { width: 400, height: 200 }
      ];
      
      sizes.forEach((size, i) => {
        const { metrics } = monitor.measure(`resize-${i}`, () => {
          plot.setSize(size);
        });
        durations.push(metrics.duration);
      });
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average resize time: ${avgDuration.toFixed(2)}ms`);
      
      plot.destroy();
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME);
    });
  });
  
  describe('Memory Usage', () => {
    it('should not leak memory during normal operations', () => {
      const data = generateNumericData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' }
        ]
      };
      
      const initialMemory = monitor.getMemoryUsage();
      const plots = [];
      
      // Create multiple plots
      for (let i = 0; i < 10; i++) {
        plots.push(new uPlot(opts, data, container));
      }
      
      const peakMemory = monitor.getMemoryUsage();
      
      // Destroy all plots
      plots.forEach(plot => plot.destroy());
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      setTimeout(() => {
        const finalMemory = monitor.getMemoryUsage();
        const memoryIncrease = finalMemory - initialMemory;
        
        console.log(`Memory usage - Initial: ${initialMemory}, Peak: ${peakMemory}, Final: ${finalMemory}`);
        console.log(`Memory increase after cleanup: ${memoryIncrease} bytes`);
        
        expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.MEMORY_TOLERANCE);
      }, 100);
    });
    
    it('should handle large datasets without excessive memory usage', () => {
      const data = generateMultiSeriesNumericData(PERFORMANCE_CONFIG.DATA_SIZES.LARGE, 5);
      const opts = {
        width: 800,
        height: 400,
        scales: {
          x: { time: false },
          y: { auto: true }
        },
        series: [
          { scale: 'x' },
          { scale: 'y', stroke: 'red' },
          { scale: 'y', stroke: 'blue' },
          { scale: 'y', stroke: 'green' },
          { scale: 'y', stroke: 'orange' },
          { scale: 'y', stroke: 'purple' }
        ]
      };
      
      const { result: plot, metrics } = monitor.measure('large-dataset-memory', () => {
        return new uPlot(opts, data, container);
      });
      
      console.log(`Memory usage for large dataset: ${metrics.memoryDelta} bytes`);
      
      plot.destroy();
      
      expect(metrics.memoryDelta).toBeLessThan(PERFORMANCE_CONFIG.MEMORY_TOLERANCE * 5);
    });
  });
  
  describe('Multi-Series Performance', () => {
    it('should handle multiple series efficiently', () => {
      const seriesCounts = [2, 5, 10, 20];
      const results = [];
      
      seriesCounts.forEach(count => {
        const data = generateMultiSeriesNumericData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM, count);
        const series = [{ scale: 'x' }];
        
        // Create series configuration
        for (let i = 1; i <= count; i++) {
          series.push({ 
            scale: 'y', 
            stroke: `hsl(${(i * 360) / count}, 70%, 50%)` 
          });
        }
        
        const opts = {
          width: 800,
          height: 400,
          scales: {
            x: { time: false },
            y: { auto: true }
          },
          series: series
        };
        
        const { result: plot, metrics } = monitor.measure(`multi-series-${count}`, () => {
          return new uPlot(opts, data, container);
        });
        
        results.push({
          seriesCount: count,
          initTime: metrics.duration,
          memoryUsage: metrics.memoryDelta
        });
        
        plot.destroy();
      });
      
      // Log results
      results.forEach(result => {
        console.log(`Series: ${result.seriesCount}, Init: ${result.initTime.toFixed(2)}ms, Memory: ${result.memoryUsage} bytes`);
      });
      
      // Performance should scale reasonably with series count
      const maxResult = results[results.length - 1];
      expect(maxResult.initTime).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 10);
    });
  });
});