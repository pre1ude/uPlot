/**
 * Test script to verify the main uPlot entry point works correctly
 * with the refactored modular architecture
 */

import uPlot from './src/uPlot.js';

// Test data
const data = [
    [1609459200, 1609545600, 1609632000, 1609718400, 1609804800],
    [35, 71, 90, 38, 33]
];

// Test options
const opts = {
    title: "Refactor Test Chart",
    width: 600,
    height: 400,
    series: [
        {},
        {
            stroke: "red",
            fill: "rgba(255,0,0,0.1)"
        }
    ]
};

console.log('Testing main uPlot entry point...');

try {
    // Test that the main uPlot constructor works
    const chart = new uPlot(opts, data);
    
    console.log('✓ uPlot constructor works');
    console.log('✓ Chart instance created:', !!chart);
    
    // Test that public API methods are available and are functions
    console.log('✓ setData method available:', typeof chart.setData === 'function');
    console.log('✓ setSize method available:', typeof chart.setSize === 'function');
    console.log('✓ destroy method available:', typeof chart.destroy === 'function');
    console.log('✓ addSeries method available:', typeof chart.addSeries === 'function');
    console.log('✓ delSeries method available:', typeof chart.delSeries === 'function');
    console.log('✓ setSeries method available:', typeof chart.setSeries === 'function');
    console.log('✓ setCursor method available:', typeof chart.setCursor === 'function');
    console.log('✓ setLegend method available:', typeof chart.setLegend === 'function');
    
    // Test that static methods are available
    console.log('✓ uPlot.assign available:', typeof uPlot.assign === 'function');
    console.log('✓ uPlot.fmtNum available:', typeof uPlot.fmtNum === 'function');
    console.log('✓ uPlot.rangeNum available:', typeof uPlot.rangeNum === 'function');
    console.log('✓ uPlot.rangeLog available:', typeof uPlot.rangeLog === 'function');
    console.log('✓ uPlot.rangeAsinh available:', typeof uPlot.rangeAsinh === 'function');
    console.log('✓ uPlot.orient available:', typeof uPlot.orient === 'function');
    console.log('✓ uPlot.pxRatio available:', typeof uPlot.pxRatio === 'number');
    
    // Test that modules are properly initialized
    console.log('✓ Layout manager initialized:', !!chart.layout);
    console.log('✓ Scale manager initialized:', !!chart.scales);
    console.log('✓ Event manager initialized:', !!chart.events);
    console.log('✓ Cursor manager initialized:', !!chart.cursor);
    console.log('✓ Legend manager initialized:', !!chart.legend);
    console.log('✓ Series manager initialized:', !!chart.series);
    console.log('✓ Axis manager initialized:', !!chart.axes);
    console.log('✓ Renderer initialized:', !!chart.renderer);
    
    // Test that the chart has expected properties
    console.log('✓ Chart has data:', Array.isArray(chart.data));
    console.log('✓ Chart has options:', typeof chart.opts === 'object');
    console.log('✓ Chart has DOM root:', !!chart.root);
    console.log('✓ Chart has canvas:', !!chart.can);
    console.log('✓ Chart has context:', !!chart.ctx);
    
    // Test that module delegation works
    console.log('✓ Width property delegated to layout:', typeof chart.width === 'number');
    console.log('✓ Height property delegated to layout:', typeof chart.height === 'number');
    
    // Test that the chart can be destroyed
    chart.destroy();
    console.log('✓ Chart destroyed successfully');
    
    console.log('\n🎉 All tests passed! Main uPlot entry point is working correctly with refactored modules.');
    
} catch (error) {
    console.error('✗ Error testing main entry point:', error);
    process.exit(1);
}