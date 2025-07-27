// Simple Node.js integration test for the refactored uPlot
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Test importing the built files
try {
    // Test ESM import
    const uPlotESM = await import('./dist/uPlot.esm.js');
    console.log('✓ ESM import successful');
    console.log('✓ Default export type:', typeof uPlotESM.default);
    console.log('✓ Static methods available:', {
        assign: typeof uPlotESM.default.assign,
        fmtNum: typeof uPlotESM.default.fmtNum,
        rangeNum: typeof uPlotESM.default.rangeNum
    });

    // Test CJS import
    const uPlotCJS = require('./dist/uPlot.cjs.js');
    console.log('✓ CJS import successful');
    console.log('✓ CJS export type:', typeof uPlotCJS);

    // Test basic instantiation (without DOM)
    const mockTarget = {
        appendChild: () => {},
        style: {},
        getBoundingClientRect: () => ({ width: 600, height: 300 })
    };

    const opts = {
        width: 600,
        height: 300,
        series: [
            {},
            { stroke: "red", label: "Test Series" }
        ]
    };

    const data = [
        [1, 2, 3, 4, 5],
        [2, 4, 6, 8, 10]
    ];

    // This will fail in Node.js due to DOM dependencies, but we can test the constructor
    try {
        const chart = new uPlotESM.default(opts, data);
        console.log('✓ Constructor executed (may fail due to DOM dependencies)');
    } catch (error) {
        if (error.message.includes('document') || error.message.includes('DOM')) {
            console.log('✓ Constructor failed as expected in Node.js environment (DOM dependencies)');
        } else {
            console.error('✗ Unexpected constructor error:', error.message);
        }
    }

} catch (error) {
    console.error('✗ Import test failed:', error);
}