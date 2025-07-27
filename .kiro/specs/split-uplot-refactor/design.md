# Design Document

## Overview

This design outlines the refactoring of the monolithic uPlot.js file (3536 lines) into a modular architecture with focused, testable components. The refactoring will maintain complete API compatibility while improving maintainability, testability, and code organization.

## Architecture

### High-Level Architecture

The refactored uPlot.js will follow a modular architecture where the main uPlot.js file serves as an orchestrator that imports and coordinates specialized modules. Each module will have a single responsibility and well-defined interfaces.

```
┌─────────────────┐
│    uPlot.js     │  ← Main entry point & orchestrator
│   (refactored)  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  src/core/      │  ← Core modules directory
│                 │
│ ├── uplot-core  │  ← Core class & initialization
│ ├── scales      │  ← Scale management
│ ├── axes        │  ← Axis system
│ ├── series      │  ← Series management
│ ├── cursor      │  ← Cursor & interaction
│ ├── legend      │  ← Legend functionality
│ ├── layout      │  ← Size & layout management
│ ├── renderer    │  ← Canvas rendering
│ └── events      │  ← Event handling
└─────────────────┘
```

### Module Dependencies

The modules will have a clear dependency hierarchy to avoid circular dependencies:

1. **Foundation Layer**: `utils.js`, `strings.js`, `dom.js` (existing)
2. **Core Layer**: `layout.js`, `scales.js`, `events.js`
3. **Component Layer**: `axes.js`, `series.js`, `cursor.js`, `legend.js`, `renderer.js`
4. **Integration Layer**: `uplot-core.js`
5. **Entry Point**: `uPlot.js` (refactored)

## Components and Interfaces

### 1. Core Module (`src/core/uplot-core.js`)

**Responsibility**: Main uPlot class definition, public API methods, and core initialization logic.

**Interface**:
```javascript
export class UPlotCore {
  constructor(opts, data, target)
  
  // Public API methods
  setData(data, resetScales)
  setSize(size)
  destroy()
  
  // Plugin integration
  addPlugin(plugin)
  removePlugin(plugin)
}
```

**Key Functions**:
- Class constructor and initialization
- Public API method implementations
- Plugin system coordination
- Module orchestration

### 2. Scale Management (`src/core/scales.js`)

**Responsibility**: Scale initialization, management, and value-to-pixel conversions.

**Interface**:
```javascript
export class ScaleManager {
  constructor(uplot, opts)
  
  initScales(opts)
  updateScale(key, opts)
  valToPosX(val, scale)
  valToPosY(val, scale)
  posToValX(pos, scale)
  posToValY(pos, scale)
}
```

**Key Functions**:
- Scale type handling (linear, log, asinh, time)
- Auto-scaling logic
- Value-to-pixel conversion utilities
- Scale range calculations

### 3. Axis System (`src/core/axes.js`)

**Responsibility**: Axis initialization, rendering, and tick calculations.

**Interface**:
```javascript
export class AxisManager {
  constructor(uplot, scaleManager)
  
  initAxes(opts)
  drawAxes(ctx)
  calcTicks(scale, space)
  formatTick(val, scale)
}
```

**Key Functions**:
- Axis configuration and initialization
- Tick calculation and formatting
- Grid line rendering
- Axis label positioning

### 4. Series Management (`src/core/series.js`)

**Responsibility**: Series initialization, data handling, and rendering coordination.

**Interface**:
```javascript
export class SeriesManager {
  constructor(uplot, scaleManager)
  
  initSeries(opts)
  addSeries(opts, idx)
  delSeries(idx)
  drawSeries(ctx)
}
```

**Key Functions**:
- Series configuration management
- Add/remove series functionality
- Series data processing
- Path generation coordination

### 5. Cursor System (`src/core/cursor.js`)

**Responsibility**: Cursor positioning, mouse interactions, and data point highlighting.

**Interface**:
```javascript
export class CursorManager {
  constructor(uplot, eventManager)
  
  initCursor(opts)
  setCursor(left, top)
  updateCursor()
  syncCursor(cursor)
}
```

**Key Functions**:
- Cursor positioning and tracking
- Mouse interaction handling
- Data point highlighting
- Multi-chart cursor synchronization

### 6. Legend System (`src/core/legend.js`)

**Responsibility**: Legend rendering, management, and interactions.

**Interface**:
```javascript
export class LegendManager {
  constructor(uplot, seriesManager)
  
  initLegend(opts)
  updateLegend(idx, vals)
  showLegend()
  hideLegend()
}
```

**Key Functions**:
- Legend rendering and positioning
- Multi-value legend support
- Legend interaction handling
- Dynamic legend updates

### 7. Layout Manager (`src/core/layout.js`)

**Responsibility**: Size calculations, plot area management, and responsive layout.

**Interface**:
```javascript
export class LayoutManager {
  constructor(uplot)
  
  calcSize(opts)
  updateLayout()
  getPlotRect()
  getPadding()
}
```

**Key Functions**:
- Size calculations and management
- Plot area calculations
- Padding and margin handling
- Responsive layout logic

### 8. Renderer (`src/core/renderer.js`)

**Responsibility**: Canvas drawing operations and rendering optimization.

**Interface**:
```javascript
export class Renderer {
  constructor(uplot, layoutManager)
  
  initCanvas(opts)
  draw()
  clear()
  drawPath(ctx, path, stroke, fill)
}
```

**Key Functions**:
- Canvas drawing operations
- Drawing order management
- Rendering optimization
- Path generation utilities

### 9. Event System (`src/core/events.js`)

**Responsibility**: Mouse event handling, event binding, and touch support.

**Interface**:
```javascript
export class EventManager {
  constructor(uplot)
  
  initEvents(opts)
  bindEvents()
  unbindEvents()
  handleMouseMove(e)
}
```

**Key Functions**:
- Mouse event handling
- Event binding and unbinding
- Touch support
- Event delegation

## Data Models

### UPlot Instance Structure
```javascript
{
  // Core properties
  opts: Object,           // Configuration options
  data: Array,           // Chart data
  root: HTMLElement,     // Container element
  
  // Managers
  scales: ScaleManager,
  axes: AxisManager,
  series: SeriesManager,
  cursor: CursorManager,
  legend: LegendManager,
  layout: LayoutManager,
  renderer: Renderer,
  events: EventManager,
  
  // Canvas elements
  ctx: CanvasRenderingContext2D,
  can: HTMLCanvasElement,
  
  // State
  status: Number,        // Initialization status
  select: Object,        // Selection state
  focus: Object          // Focus state
}
```

### Module Communication Pattern
Modules will communicate through:
1. **Constructor injection**: Dependencies passed during initialization
2. **Event system**: Loose coupling through events for non-critical communication
3. **Direct method calls**: For performance-critical operations
4. **Shared state**: Through the main uPlot instance

## Error Handling

### Error Boundaries
Each module will implement error boundaries to:
- Catch and handle module-specific errors
- Provide meaningful error messages with module context
- Prevent cascading failures between modules
- Maintain system stability

### Error Reporting
```javascript
// Standardized error reporting
class UPlotError extends Error {
  constructor(message, module, context) {
    super(`[${module}] ${message}`)
    this.module = module
    this.context = context
  }
}
```

## Testing Strategy

### Unit Testing Approach
1. **Module Isolation**: Each module tested independently with mocked dependencies
2. **Interface Testing**: Public interfaces tested for contract compliance
3. **Integration Testing**: Module interactions tested with real dependencies
4. **Regression Testing**: Existing functionality verified through comprehensive test suite

### Test Structure
```
tests/
├── unit/
│   ├── scales.test.js
│   ├── axes.test.js
│   ├── series.test.js
│   └── ...
├── integration/
│   ├── uplot-core.test.js
│   └── module-interactions.test.js
└── regression/
    └── api-compatibility.test.js
```

### Performance Testing
- Benchmark initialization time
- Measure rendering performance
- Monitor memory usage
- Compare against original implementation

## Migration Strategy

### Phase-by-Phase Implementation

**Phase 1: Foundation Setup**
- Create `src/core/` directory structure
- Set up module templates with basic exports
- Establish build process integration

**Phase 2: Utility Extraction**
- Extract scale-related utilities to `scales.js`
- Extract layout utilities to `layout.js`
- Extract event utilities to `events.js`

**Phase 3: System Extraction**
- Extract cursor system to `cursor.js`
- Extract legend system to `legend.js`
- Extract series management to `series.js`

**Phase 4: Core Components**
- Extract axis system to `axes.js`
- Extract renderer to `renderer.js`
- Create `uplot-core.js` with remaining logic

**Phase 5: Integration**
- Refactor main `uPlot.js` to orchestrate modules
- Implement comprehensive testing
- Verify API compatibility

### Rollback Strategy
- Maintain original `uPlot.js` as backup
- Implement feature flags for gradual rollout
- Comprehensive testing at each phase
- Clear rollback procedures documented

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load modules only when needed
2. **Caching**: Cache expensive calculations across modules
3. **Batching**: Batch operations to reduce overhead
4. **Memory Management**: Proper cleanup and garbage collection

### Performance Monitoring
- Initialization time benchmarks
- Rendering performance metrics
- Memory usage tracking
- Regression detection

## Security Considerations

### Module Isolation
- Prevent cross-module data leakage
- Validate inputs at module boundaries
- Implement proper access controls

### Build Security
- Ensure no malicious code injection during build
- Validate module integrity
- Secure dependency management