/**
 * Basic performance validation tests
 * 
 * This test suite validates performance using the same patterns as existing tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import uPlot from '../src/uPlot.js';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  ITERATIONS: 5,
  MAX_INIT_TIME: 100,
  MAX_RENDER_TIME: 50,
};

// Simple data generators
function generateBasicData(size) {
  const data = [[], []];
  
  for (let i = 0; i < size; i++) {
    data[0].push(i);
    data[1].push(Math.sin(i * 0.1) * 100);
  }
  
  return data;
}

// Performance measurement utilities
class BasicPerformanceMonitor {
  measure(name, fn) {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    
    return {
      result,
      duration: endTime - startTime
    };
  }
  
  getMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }
}

describe('Basic Performance Validation', () => {
  let monitor;
  let container;
  
  beforeEach(() => {
    monitor = new BasicPerformanceMonitor();
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
    it('should initialize within acceptable time limits', () => {
      const data = generateBasicData(100);
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
        const { duration } = monitor.measure(`init-${i}`, () => {
          const plot = new uPlot(opts, data, container);
          plot.destroy();
          return plot;
        });
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average initialization time: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME);
    });
    
    it('should handle medium datasets efficiently', () => {
      const data = generateBasicData(1000);
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
        const { duration } = monitor.measure(`init-medium-${i}`, () => {
          const plot = new uPlot(opts, data, container);
          plot.destroy();
          return plot;
        });
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average initialization time (medium): ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 2);
    });
  });
  
  describe('Rendering Performance', () => {
    it('should handle data updates efficiently', () => {
      const data1 = generateBasicData(500);
      const data2 = generateBasicData(500);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
        ]
      };
      
      const plot = new uPlot(opts, data1, container);
      const durations = [];
      
      for (let i = 0; i < PERFORMANCE_CONFIG.ITERATIONS; i++) {
        const { duration } = monitor.measure(`render-${i}`, () => {
          plot.setData(data2);
        });
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average render time: ${avgDuration.toFixed(2)}ms`);
      
      plot.destroy();
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME);
    });
    
    it('should handle resize operations efficiently', () => {
      const data = generateBasicData(500);
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
      
      const sizes = [
        { width: 600, height: 300 },
        { width: 1000, height: 500 },
        { width: 800, height: 400 }
      ];
      
      sizes.forEach((size, i) => {
        const { duration } = monitor.measure(`resize-${i}`, () => {
          plot.setSize(size);
        });
        durations.push(duration);
      });
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average resize time: ${avgDuration.toFixed(2)}ms`);
      
      plot.destroy();
      expect(avgDuration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME);
    });
  });
  
  describe('Memory Usage Validation', () => {
    it('should not accumulate excessive memory', () => {
      const data = generateBasicData(500);
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
      for (let i = 0; i < 5; i++) {
        plots.push(new uPlot(opts, data, container));
      }
      
      const peakMemory = monitor.getMemoryUsage();
      
      // Destroy all plots
      plots.forEach(plot => plot.destroy());
      
      const finalMemory = monitor.getMemoryUsage();
      
      console.log(`Memory usage - Initial: ${initialMemory}, Peak: ${peakMemory}, Final: ${finalMemory}`);
      
      // Basic memory validation
      if (performance.memory) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB tolerance
      }
    });
  });
  
  describe('Multi-Series Performance', () => {
    it('should handle multiple series efficiently', () => {
      const seriesCounts = [2, 5, 10];
      const results = [];
      
      seriesCounts.forEach(count => {
        const data = [[]];
        
        // Generate data for multiple series
        for (let s = 0; s < count; s++) {
          data.push([]);
        }
        
        for (let i = 0; i < 500; i++) {
          data[0].push(i);
          for (let s = 1; s <= count; s++) {
            data[s].push(Math.sin(i * 0.1 * s) * 100);
          }
        }
        
        const series = [{}];
        for (let i = 1; i <= count; i++) {
          series.push({ stroke: `hsl(${(i * 360) / count}, 70%, 50%)` });
        }
        
        const opts = {
          width: 800,
          height: 400,
          series: series
        };
        
        const { result: plot, duration } = monitor.measure(`multi-series-${count}`, () => {
          return new uPlot(opts, data, container);
        });
        
        results.push({
          seriesCount: count,
          initTime: duration
        });
        
        plot.destroy();
      });
      
      // Log results
      results.forEach(result => {
        console.log(`Series: ${result.seriesCount}, Init: ${result.initTime.toFixed(2)}ms`);
      });
      
      // Performance should scale reasonably with series count
      const maxResult = results[results.length - 1];
      expect(maxResult.initTime).toBeLessThan(PERFORMANCE_CONFIG.MAX_INIT_TIME * 5);
    });
  });
});