/**
 * Benchmark script for comparing refactored uPlot performance
 * 
 * This script provides detailed benchmarking capabilities to:
 * - Compare initialization times
 * - Measure rendering performance
 * - Monitor memory usage patterns
 * - Generate performance reports
 */

import uPlot from '../src/uPlot.js';

// Benchmark configuration
const BENCHMARK_CONFIG = {
  ITERATIONS: 50,
  WARMUP_ITERATIONS: 5,
  DATA_SIZES: [100, 500, 1000, 5000, 10000],
  SERIES_COUNTS: [1, 3, 5, 10],
  CHART_SIZES: [
    { width: 400, height: 200 },
    { width: 800, height: 400 },
    { width: 1200, height: 600 }
  ]
};

// Data generators
function generateTimeSeriesData(size) {
  const data = [[], []];
  const now = Date.now();
  
  for (let i = 0; i < size; i++) {
    data[0].push(now + i * 1000);
    data[1].push(Math.sin(i * 0.1) * 100 + Math.random() * 20);
  }
  
  return data;
}

function generateMultiSeriesData(size, seriesCount) {
  const data = [[]];
  const now = Date.now();
  
  for (let s = 0; s < seriesCount; s++) {
    data.push([]);
  }
  
  for (let i = 0; i < size; i++) {
    data[0].push(now + i * 1000);
    for (let s = 1; s <= seriesCount; s++) {
      data[s].push(Math.sin(i * 0.1 * s) * 100 + Math.random() * 20);
    }
  }
  
  return data;
}

// Benchmark utilities
class Benchmark {
  constructor() {
    this.results = {};
  }
  
  async runBenchmark(name, testFn, iterations = BENCHMARK_CONFIG.ITERATIONS) {
    console.log(`Running benchmark: ${name}`);
    
    // Warmup
    for (let i = 0; i < BENCHMARK_CONFIG.WARMUP_ITERATIONS; i++) {
      await testFn();
    }
    
    // Actual benchmark
    const times = [];
    const memoryUsages = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const startMemory = this.getMemoryUsage();
      
      await testFn();
      
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();
      
      times.push(endTime - startTime);
      memoryUsages.push(endMemory - startMemory);
      
      // Small delay to allow garbage collection
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    const stats = this.calculateStats(times);
    const memoryStats = this.calculateStats(memoryUsages);
    
    this.results[name] = {
      time: stats,
      memory: memoryStats,
      iterations
    };
    
    console.log(`  Time - Mean: ${stats.mean.toFixed(2)}ms, Median: ${stats.median.toFixed(2)}ms, Min: ${stats.min.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
    console.log(`  Memory - Mean: ${memoryStats.mean.toFixed(0)} bytes`);
    
    return this.results[name];
  }
  
  calculateStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(values.reduce((a, b) => a + Math.pow(b - (sum / values.length), 2), 0) / values.length)
    };
  }
  
  getMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }
  
  generateReport() {
    console.log('\n=== BENCHMARK REPORT ===\n');
    
    Object.entries(this.results).forEach(([name, result]) => {
      console.log(`${name}:`);
      console.log(`  Time (ms):`);
      console.log(`    Mean: ${result.time.mean.toFixed(2)}`);
      console.log(`    Median: ${result.time.median.toFixed(2)}`);
      console.log(`    95th percentile: ${result.time.p95.toFixed(2)}`);
      console.log(`    Min: ${result.time.min.toFixed(2)}`);
      console.log(`    Max: ${result.time.max.toFixed(2)}`);
      console.log(`    Std Dev: ${result.time.stdDev.toFixed(2)}`);
      console.log(`  Memory (bytes):`);
      console.log(`    Mean: ${result.memory.mean.toFixed(0)}`);
      console.log(`    Median: ${result.memory.median.toFixed(0)}`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log('');
    });
  }
  
  exportResults() {
    return {
      timestamp: new Date().toISOString(),
      config: BENCHMARK_CONFIG,
      results: this.results
    };
  }
}

// Main benchmark suite
async function runBenchmarks() {
  const benchmark = new Benchmark();
  
  // Create container for tests
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '400px';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  
  try {
    // Benchmark 1: Initialization with different data sizes
    for (const size of BENCHMARK_CONFIG.DATA_SIZES) {
      await benchmark.runBenchmark(`init-${size}-points`, async () => {
        const data = generateTimeSeriesData(size);
        const opts = {
          width: 800,
          height: 400,
          series: [
            {},
            { stroke: 'red' }
          ]
        };
        
        const plot = new uPlot(opts, data, container);
        plot.destroy();
      });
    }
    
    // Benchmark 2: Multi-series initialization
    for (const seriesCount of BENCHMARK_CONFIG.SERIES_COUNTS) {
      await benchmark.runBenchmark(`init-multi-series-${seriesCount}`, async () => {
        const data = generateMultiSeriesData(1000, seriesCount);
        const series = [{}];
        
        for (let i = 1; i <= seriesCount; i++) {
          series.push({ stroke: `hsl(${(i * 360) / seriesCount}, 70%, 50%)` });
        }
        
        const opts = {
          width: 800,
          height: 400,
          series: series
        };
        
        const plot = new uPlot(opts, data, container);
        plot.destroy();
      });
    }
    
    // Benchmark 3: Rendering performance (setData)
    const testData1 = generateTimeSeriesData(1000);
    const testData2 = generateTimeSeriesData(1000);
    const opts = {
      width: 800,
      height: 400,
      series: [
        {},
        { stroke: 'red' }
      ]
    };
    
    const plot = new uPlot(opts, testData1, container);
    
    await benchmark.runBenchmark('render-setData', async () => {
      plot.setData(testData2);
    });
    
    // Benchmark 4: Resize performance
    await benchmark.runBenchmark('resize', async () => {
      plot.setSize({ width: 600, height: 300 });
      plot.setSize({ width: 800, height: 400 });
    });
    
    plot.destroy();
    
    // Benchmark 5: Different chart sizes
    for (const size of BENCHMARK_CONFIG.CHART_SIZES) {
      await benchmark.runBenchmark(`init-size-${size.width}x${size.height}`, async () => {
        const data = generateTimeSeriesData(1000);
        const opts = {
          width: size.width,
          height: size.height,
          series: [
            {},
            { stroke: 'red' }
          ]
        };
        
        const plot = new uPlot(opts, data, container);
        plot.destroy();
      });
    }
    
    // Generate and display report
    benchmark.generateReport();
    
    // Export results for further analysis
    const results = benchmark.exportResults();
    console.log('\nBenchmark completed. Results exported.');
    
    return results;
    
  } finally {
    // Cleanup
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

// Memory profiling utilities
class MemoryProfiler {
  constructor() {
    this.snapshots = [];
  }
  
  takeSnapshot(label) {
    const snapshot = {
      label,
      timestamp: Date.now(),
      memory: this.getDetailedMemoryInfo()
    };
    
    this.snapshots.push(snapshot);
    return snapshot;
  }
  
  getDetailedMemoryInfo() {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }
  
  analyzeMemoryUsage() {
    if (this.snapshots.length < 2) {
      console.log('Need at least 2 snapshots for analysis');
      return;
    }
    
    console.log('\n=== MEMORY ANALYSIS ===\n');
    
    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1];
      const curr = this.snapshots[i];
      
      if (prev.memory && curr.memory) {
        const delta = curr.memory.usedJSHeapSize - prev.memory.usedJSHeapSize;
        console.log(`${prev.label} -> ${curr.label}: ${delta > 0 ? '+' : ''}${delta} bytes`);
      }
    }
  }
}

// Export for use in tests and external scripts
export { Benchmark, MemoryProfiler, runBenchmarks };

// Run benchmarks if this script is executed directly
if (typeof window !== 'undefined' && window.document) {
  // Browser environment
  window.runBenchmarks = runBenchmarks;
  console.log('Benchmark utilities loaded. Call runBenchmarks() to start.');
} else if (typeof process !== 'undefined' && process.argv) {
  // Node environment
  runBenchmarks().catch(console.error);
}