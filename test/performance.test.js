/**
 * Performance validation and optimization tests
 * 
 * This test suite benchmarks the refactored uPlot against performance requirements:
 * - Initialization time
 * - Rendering performance and frame rates
 * - Memory usage patterns
 * - Performance regression detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import uPlot from '../src/uPlot.js';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  // Number of iterations for averaging results
  ITERATIONS: 10,
  // Maximum acceptable initialization time (ms)
  MAX_INIT_TIME: 50,
  // Maximum acceptable render time (ms)
  MAX_RENDER_TIME: 16, // ~60fps
  // Memory usage tolerance (bytes)
  MEMORY_TOLERANCE: 1024 * 1024, // 1MB
  // Data sizes for testing
  DATA_SIZES: {
    SMALL: 100,
    MEDIUM: 1000,
    LARGE: 10000,
  }
};

// Test data generators
function generateTimeSeriesData(size) {
  const data = [[], []];
  const now = Math.floor(Date.now() / 1000) * 1000; // Round to nearest second
  
  for (let i = 0; i < size; i++) {
    data[0].push(now + i * 1000);
    data[1].push(Math.sin(i * 0.1) * 100 + Math.random() * 20);
  }
  
  return data;
}

function generateMultiSeriesData(size, seriesCount = 3) {
  const data = [[]];
  const now = Math.floor(Date.now() / 1000) * 1000; // Round to nearest second
  
  // Initialize series arrays
  for (let s = 0; s < seriesCount; s++) {
    data.push([]);
  }
  
  // Generate data points
  for (let i = 0; i < size; i++) {
    data[0].push(now + i * 1000);
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
    // Use performance.memory if available (Chrome)
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    // Fallback for other browsers
    return 0;
  }
  
  async measureAsync(name, fn) {
    this.startMeasurement(name);
    const result = await fn();
    const metrics = this.endMeasurement(name);
    return { result, metrics };
  }
  
  measure(name, fn) {
    this.startMeasurement(name);
    const result = fn();
    const metrics = this.endMeasurement(name);
    return { result, metrics };
  }
}

// Test suite
describe('Performance Validation and Optimization', () => {
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
      const data = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.SMALL);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
        ]
      };
      
      const durations = [];
      
      // Run multiple iterations for averaging
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
      const data = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
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
      
      // Allow more time for larger datasets
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 2);
    });
    
    it('should initialize within acceptable time limits for large datasets', () => {
      const data = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.LARGE);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
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
      
      // Allow more time for large datasets
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 5);
    });
  });
  
  describe('Rendering Performance', () => {
    it('should render updates within frame rate limits', () => {
      const data = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
        ]
      };
      
      const plot = new uPlot(opts, data, container);
      const durations = [];
      
      // Test multiple render operations
      for (let i = 0; i < PERFORMANCE_CONFIG.ITERATIONS; i++) {
        const newData = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
        
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
      const data = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
        ]
      };
      
      const plot = new uPlot(opts, data, container);
      const durations = [];
      
      // Test resize operations
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
      const data = generateTimeSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
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
      
      // Wait a bit for cleanup
      setTimeout(() => {
        const finalMemory = monitor.getMemoryUsage();
        const memoryIncrease = finalMemory - initialMemory;
        
        console.log(`Memory usage - Initial: ${initialMemory}, Peak: ${peakMemory}, Final: ${finalMemory}`);
        console.log(`Memory increase after cleanup: ${memoryIncrease} bytes`);
        
        // Memory increase should be within tolerance
        expect(memoryIncrease).toBeLessThan(PERFORMANCE_CONFIG.MEMORY_TOLERANCE);
      }, 100);
    });
    
    it('should handle large datasets without excessive memory usage', () => {
      const data = generateMultiSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.LARGE, 5);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' },
          { stroke: 'blue' },
          { stroke: 'green' },
          { stroke: 'orange' },
          { stroke: 'purple' }
        ]
      };
      
      const { result: plot, metrics } = monitor.measure('large-dataset-memory', () => {
        return new uPlot(opts, data, container);
      });
      
      console.log(`Memory usage for large dataset: ${metrics.memoryDelta} bytes`);
      
      plot.destroy();
      
      // Memory usage should be reasonable for large datasets
      expect(metrics.memoryDelta).toBeLessThan(PERFORMANCE_CONFIG.MEMORY_TOLERANCE * 5);
    });
  });
  
  describe('Multi-Series Performance', () => {
    it('should handle multiple series efficiently', () => {
      const seriesCounts = [2, 5, 10, 20];
      const results = [];
      
      seriesCounts.forEach(count => {
        const data = generateMultiSeriesData(PERFORMANCE_CONFIG.DATA_SIZES.MEDIUM, count);
        const series = [{}];
        
        // Create series configuration
        for (let i = 1; i <= count; i++) {
          series.push({ stroke: `hsl(${(i * 360) / count}, 70%, 50%)` });
        }
        
        const opts = {
          width: 800,
          height: 400,
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