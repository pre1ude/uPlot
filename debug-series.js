// Debug script to check SeriesManager methods
import { SeriesManager } from './src/core/series.js';

console.log('SeriesManager prototype methods:');
console.log(Object.getOwnPropertyNames(SeriesManager.prototype));

console.log('\nSeriesManager static methods:');
console.log(Object.getOwnPropertyNames(SeriesManager));

// Check if resetYSeries is defined
console.log('\nresetYSeries method:', SeriesManager.prototype.resetYSeries);
console.log('getSeriesCount method:', SeriesManager.prototype.getSeriesCount);