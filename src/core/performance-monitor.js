/**
 * Performance monitoring utilities for uPlot modules
 * 
 * This module provides performance monitoring capabilities that can be
 * integrated into core modules to track performance metrics in real-time.
 */

// Performance monitoring configuration
const PERF_CONFIG = {
  // Enable/disable performance monitoring
  ENABLED: typeof performance !== 'undefined' && performance.mark && performance.measure,
  // Threshold for logging slow operations (ms)
  SLOW_OPERATION_THRESHOLD: 10,
  // Maximum number of measurements to keep in memory
  MAX_MEASUREMENTS: 1000,
  // Enable memory monitoring
  MEMORY_MONITORING: typeof performance !== 'undefined' && performance.memory
};

/**
 * Performance monitor class for tracking operation timing and memory usage
 */
export class PerformanceMonitor {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.measurements = new Map();
    this.operationCounts = new Map();
    this.enabled = PERF_CONFIG.ENABLED;
  }
  
  /**
   * Start timing an operation
   * @param {string} operationName - Name of the operation
   * @param {Object} context - Additional context data
   */
  startTiming(operationName, context = {}) {
    if (!this.enabled) return;
    
    const markName = `${this.moduleName}-${operationName}-start`;
    const timestamp = performance.now();
    
    try {
      performance.mark(markName);
    } catch (e) {
      // Fallback if performance.mark fails
    }
    
    this.measurements.set(operationName, {
      startTime: timestamp,
      startMemory: this.getMemoryUsage(),
      context,
      markName
    });
  }
  
  /**
   * End timing an operation and record the measurement
   * @param {string} operationName - Name of the operation
   * @returns {Object} Measurement data
   */
  endTiming(operationName) {
    if (!this.enabled) return null;
    
    const measurement = this.measurements.get(operationName);
    if (!measurement) {
      console.warn(`No timing started for operation: ${operationName}`);
      return null;
    }
    
    const endTime = performance.now();
    const duration = endTime - measurement.startTime;
    const endMemory = this.getMemoryUsage();
    const memoryDelta = endMemory - measurement.startMemory;
    
    const result = {
      operation: operationName,
      module: this.moduleName,
      duration,
      memoryDelta,
      startMemory: measurement.startMemory,
      endMemory,
      context: measurement.context,
      timestamp: endTime
    };
    
    // Create performance measure if possible
    try {
      const measureName = `${this.moduleName}-${operationName}`;
      performance.measure(measureName, measurement.markName);
    } catch (e) {
      // Fallback if performance.measure fails
    }
    
    // Log slow operations
    if (duration > PERF_CONFIG.SLOW_OPERATION_THRESHOLD) {
      console.warn(`Slow operation detected: ${this.moduleName}.${operationName} took ${duration.toFixed(2)}ms`);
    }
    
    // Update operation counts
    const count = this.operationCounts.get(operationName) || 0;
    this.operationCounts.set(operationName, count + 1);
    
    // Clean up
    this.measurements.delete(operationName);
    
    return result;
  }
  
  /**
   * Time a synchronous function
   * @param {string} operationName - Name of the operation
   * @param {Function} fn - Function to time
   * @param {Object} context - Additional context data
   * @returns {Object} { result, measurement }
   */
  time(operationName, fn, context = {}) {
    if (!this.enabled) {
      return { result: fn(), measurement: null };
    }
    
    this.startTiming(operationName, context);
    const result = fn();
    const measurement = this.endTiming(operationName);
    
    return { result, measurement };
  }
  
  /**
   * Time an asynchronous function
   * @param {string} operationName - Name of the operation
   * @param {Function} fn - Async function to time
   * @param {Object} context - Additional context data
   * @returns {Promise<Object>} { result, measurement }
   */
  async timeAsync(operationName, fn, context = {}) {
    if (!this.enabled) {
      return { result: await fn(), measurement: null };
    }
    
    this.startTiming(operationName, context);
    const result = await fn();
    const measurement = this.endTiming(operationName);
    
    return { result, measurement };
  }
  
  /**
   * Get current memory usage
   * @returns {number} Memory usage in bytes
   */
  getMemoryUsage() {
    if (PERF_CONFIG.MEMORY_MONITORING && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }
  
  /**
   * Get performance statistics for an operation
   * @param {string} operationName - Name of the operation
   * @returns {Object} Statistics
   */
  getOperationStats(operationName) {
    const count = this.operationCounts.get(operationName) || 0;
    
    // Get performance entries if available
    let entries = [];
    try {
      const measureName = `${this.moduleName}-${operationName}`;
      entries = performance.getEntriesByName(measureName, 'measure');
    } catch (e) {
      // Fallback if performance API not available
    }
    
    if (entries.length === 0) {
      return { count, measurements: 0 };
    }
    
    const durations = entries.map(entry => entry.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const sorted = durations.sort((a, b) => a - b);
    
    return {
      count,
      measurements: entries.length,
      mean: sum / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      total: sum
    };
  }
  
  /**
   * Get all performance statistics for this module
   * @returns {Object} All statistics
   */
  getAllStats() {
    const stats = {};
    
    for (const operationName of this.operationCounts.keys()) {
      stats[operationName] = this.getOperationStats(operationName);
    }
    
    return {
      module: this.moduleName,
      operations: stats,
      memorySupported: PERF_CONFIG.MEMORY_MONITORING
    };
  }
  
  /**
   * Clear all performance data
   */
  clear() {
    this.measurements.clear();
    this.operationCounts.clear();
    
    // Clear performance entries if possible
    try {
      performance.clearMeasures();
      performance.clearMarks();
    } catch (e) {
      // Fallback if performance API not available
    }
  }
  
  /**
   * Enable or disable performance monitoring
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled && PERF_CONFIG.ENABLED;
  }
}

/**
 * Global performance monitor for cross-module tracking
 */
export class GlobalPerformanceMonitor {
  constructor() {
    this.modules = new Map();
    this.enabled = PERF_CONFIG.ENABLED;
  }
  
  /**
   * Get or create a performance monitor for a module
   * @param {string} moduleName - Name of the module
   * @returns {PerformanceMonitor} Module performance monitor
   */
  getMonitor(moduleName) {
    if (!this.modules.has(moduleName)) {
      const monitor = new PerformanceMonitor(moduleName);
      monitor.setEnabled(this.enabled);
      this.modules.set(moduleName, monitor);
    }
    
    return this.modules.get(moduleName);
  }
  
  /**
   * Get performance statistics for all modules
   * @returns {Object} All module statistics
   */
  getAllStats() {
    const stats = {};
    
    for (const [moduleName, monitor] of this.modules) {
      stats[moduleName] = monitor.getAllStats();
    }
    
    return {
      timestamp: Date.now(),
      modules: stats,
      config: PERF_CONFIG
    };
  }
  
  /**
   * Generate a performance report
   * @returns {string} Formatted performance report
   */
  generateReport() {
    const stats = this.getAllStats();
    let report = '\n=== uPlot Performance Report ===\n\n';
    
    for (const [moduleName, moduleStats] of Object.entries(stats.modules)) {
      report += `Module: ${moduleName}\n`;
      
      for (const [operationName, opStats] of Object.entries(moduleStats.operations)) {
        if (opStats.measurements > 0) {
          report += `  ${operationName}:\n`;
          report += `    Calls: ${opStats.count}\n`;
          report += `    Mean: ${opStats.mean.toFixed(2)}ms\n`;
          report += `    Median: ${opStats.median.toFixed(2)}ms\n`;
          report += `    Min: ${opStats.min.toFixed(2)}ms\n`;
          report += `    Max: ${opStats.max.toFixed(2)}ms\n`;
          report += `    95th: ${opStats.p95.toFixed(2)}ms\n`;
          report += `    Total: ${opStats.total.toFixed(2)}ms\n`;
        }
      }
      
      report += '\n';
    }
    
    return report;
  }
  
  /**
   * Clear all performance data for all modules
   */
  clearAll() {
    for (const monitor of this.modules.values()) {
      monitor.clear();
    }
  }
  
  /**
   * Enable or disable performance monitoring globally
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled && PERF_CONFIG.ENABLED;
    
    for (const monitor of this.modules.values()) {
      monitor.setEnabled(this.enabled);
    }
  }
}

// Global instance for easy access
export const globalPerformanceMonitor = new GlobalPerformanceMonitor();

// Utility function to get a module monitor
export function getPerformanceMonitor(moduleName) {
  return globalPerformanceMonitor.getMonitor(moduleName);
}