/**
 * Simplified performance validation tests
 * 
 * This test suite focuses on basic performance metrics without complex data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import uPlot from '../src/uPlot.js';

// Simple performance test configuration
const PERF_CONFIG = {
  ITERATIONS: 5,
  MAX_INIT_TIME: 100, // More lenient for testing
  MAX_RENDER_TIME: 50,
};

// Simple data generators
function generateSimpleData(size) {
  const data = [[], []];
  
  for (let i = 0; i < size; i++) {
    data[0].push(i);
    data[1].push(Math.sin(i * 0.1) * 100);
  }
  
  return data;
}

// Performance measurement utilities
class SimplePerformanceMonitor {
  measure(name, fn) {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    
    return {
      result,
      duration: endTime - startTime
    };
  }
}

describe('Simple Performance Validation', () => {
  let monitor;
  let container;
  
  beforeEach(() => {
    monitor = new SimplePerformanceMonitor();
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
  
  describe('Basic Initialization Performance', () => {
    it('should initialize within acceptable time limits', () => {
      const data = generateSimpleData(100);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
        ]
      };
      
      const durations = [];
      
      for (let i = 0; i < PERF_CONFIG.ITERATIONS; i++) {
        const { duration } = monitor.measure(`init-${i}`, () => {
          const plot = new uPlot(opts, data, container);
          plot.destroy();
          return plot;
        });
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average initialization time: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(PERF_CONFIG.MAX_INIT_TIME);
    });
  });
  
  describe('Basic Rendering Performance', () => {
    it('should handle data updates efficiently', () => {
      const data1 = generateSimpleData(100);
      const data2 = generateSimpleData(100);
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
      
      for (let i = 0; i < PERF_CONFIG.ITERATIONS; i++) {
        const { duration } = monitor.measure(`render-${i}`, () => {
          plot.setData(data2);
        });
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`Average render time: ${avgDuration.toFixed(2)}ms`);
      
      plot.destroy();
      expect(avgDuration).toBeLessThan(PERF_CONFIG.MAX_RENDER_TIME);
    });
  });
  
  describe('Memory Usage Validation', () => {
    it('should not accumulate excessive memory during operations', () => {
      const data = generateSimpleData(100);
      const opts = {
        width: 800,
        height: 400,
        series: [
          {},
          { stroke: 'red' }
        ]
      };
      
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const plots = [];
      
      // Create multiple plots
      for (let i = 0; i < 5; i++) {
        plots.push(new uPlot(opts, data, container));
      }
      
      const peakMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      // Destroy all plots
      plots.forEach(plot => plot.destroy());
      
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      console.log(`Memory usage - Initial: ${initialMemory}, Peak: ${peakMemory}, Final: ${finalMemory}`);
      
      // Basic memory validation - final should not be significantly higher than initial
      if (performance.memory) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB tolerance
      }
    });
  });
});