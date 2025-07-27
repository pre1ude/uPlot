// Mock DOM functions that are not available in jsdom
global.matchMedia = global.matchMedia || function (query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: function () {},
    removeListener: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    dispatchEvent: function () {},
  };
};

// Mock ResizeObserver
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock requestAnimationFrame
global.requestAnimationFrame = global.requestAnimationFrame || function (callback) {
  return setTimeout(callback, 16);
};

global.cancelAnimationFrame = global.cancelAnimationFrame || function (id) {
  clearTimeout(id);
};

// Mock Canvas and CanvasRenderingContext2D for performance tests
const mockCanvasContext = {
  // Drawing methods
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  rect: () => {},
  fill: () => {},
  stroke: () => {},
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  
  // Path methods
  clip: () => {},
  save: () => {},
  restore: () => {},
  
  // Transform methods
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  transform: () => {},
  setTransform: () => {},
  
  // Text methods
  fillText: () => {},
  strokeText: () => {},
  measureText: () => ({ width: 0 }),
  
  // Image methods
  drawImage: () => {},
  
  // Properties
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  
  // Canvas dimensions
  canvas: {
    width: 800,
    height: 400,
    style: {}
  }
};

// Override HTMLCanvasElement.prototype.getContext
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function(contextType) {
    if (contextType === '2d') {
      return mockCanvasContext;
    }
    return null;
  };
}

// Mock performance.memory for memory testing
if (typeof performance !== 'undefined' && !performance.memory) {
  let mockMemoryUsage = 1000000; // Start with 1MB
  
  Object.defineProperty(performance, 'memory', {
    get: () => ({
      usedJSHeapSize: mockMemoryUsage + Math.random() * 100000,
      totalJSHeapSize: mockMemoryUsage * 2,
      jsHeapSizeLimit: mockMemoryUsage * 10
    })
  });
}