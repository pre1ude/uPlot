# Split uPlot.js Refactoring Spec

## Overview
The main uPlot.js file is currently 3536 lines long and contains multiple logical components that should be separated into focused modules for better maintainability, readability, and testing.

## Goals
- Split the monolithic uPlot.js into logical, focused modules
- Maintain all existing functionality and API compatibility
- Improve code organization and maintainability
- Enable easier testing of individual components
- Follow existing project structure patterns (like the paths/ directory)

## Current Analysis
The uPlot.js file contains several distinct logical components:
1. **Core uPlot class and initialization**
2. **Scale management and calculations**
3. **Axis rendering and calculations**
4. **Series management and rendering**
5. **Cursor and interaction handling**
6. **Legend functionality**
7. **Drawing and rendering utilities**
8. **Event handling and mouse interactions**
9. **Size calculation and layout management**

## Proposed Module Structure

### 1. Core Module (`src/core/uplot-core.js`)
- Main uPlot class constructor
- Public API methods
- Plugin system integration
- Core initialization logic

### 2. Scale Management (`src/core/scales.js`)
- Scale initialization and management
- Scale type handling (linear, log, asinh, time)
- Value-to-pixel conversion utilities
- Auto-scaling logic

### 3. Axis System (`src/core/axes.js`)
- Axis initialization and configuration
- Axis rendering and drawing
- Tick calculation and formatting
- Grid line rendering

### 4. Series Management (`src/core/series.js`)
- Series initialization and configuration
- Series data handling
- Add/remove series functionality
- Series rendering coordination

### 5. Cursor System (`src/core/cursor.js`)
- Cursor positioning and tracking
- Mouse interaction handling
- Data point highlighting
- Cursor synchronization

### 6. Legend System (`src/core/legend.js`)
- Legend rendering and management
- Legend interaction handling
- Multi-value legend support
- Legend positioning

### 7. Layout Manager (`src/core/layout.js`)
- Size calculations and management
- Plot area calculations
- Padding and margin handling
- Responsive layout logic

### 8. Renderer (`src/core/renderer.js`)
- Canvas drawing operations
- Drawing order management
- Rendering optimization
- Path generation coordination

### 9. Event System (`src/core/events.js`)
- Mouse event handling
- Event binding and unbinding
- Event delegation
- Touch support

## Implementation Plan

### Phase 1: Extract Utility Functions
- Move scale-related utilities to `scales.js`
- Move axis-related utilities to `axes.js`
- Move layout utilities to `layout.js`

### Phase 2: Extract Major Systems
- Extract cursor system to `cursor.js`
- Extract legend system to `legend.js`
- Extract series management to `series.js`

### Phase 3: Extract Core Components
- Extract axis system to `axes.js`
- Extract scale management to `scales.js`
- Extract layout manager to `layout.js`

### Phase 4: Finalize Core
- Create main `uplot-core.js` with remaining logic
- Create `renderer.js` for drawing operations
- Create `events.js` for event handling

### Phase 5: Integration and Testing
- Update main `uPlot.js` to import and coordinate modules
- Ensure all functionality works correctly
- Verify API compatibility

## File Structure After Refactoring

```
src/
├── core/
│   ├── axes.js          # Axis system
│   ├── cursor.js        # Cursor and interaction
│   ├── events.js        # Event handling
│   ├── layout.js        # Size and layout management
│   ├── legend.js        # Legend functionality
│   ├── renderer.js      # Canvas rendering
│   ├── scales.js        # Scale management
│   ├── series.js        # Series management
│   └── uplot-core.js    # Core uPlot class
├── paths/               # Existing path modules
├── uPlot.js            # Main entry point (refactored)
└── [existing files]    # All other existing files
```

## Key Considerations

### API Compatibility
- All public methods must remain unchanged
- Constructor signature must be preserved
- Event firing must work identically
- Plugin system must continue to work

### Dependencies
- Maintain existing import structure
- Ensure proper module dependencies
- Avoid circular dependencies
- Keep external dependencies minimal

### Performance
- Ensure no performance regression
- Maintain efficient rendering
- Preserve memory usage characteristics
- Keep initialization time similar

### Testing Strategy
- Test each module independently
- Verify integration works correctly
- Run existing test suite (if any)
- Test with real-world usage patterns

## Success Criteria
- [x] All existing functionality preserved
- [ ] API compatibility maintained
- [ ] Code is more maintainable and readable
- [ ] Each module has a clear, focused responsibility
- [ ] No performance regression
- [ ] Easier to test individual components
- [ ] Follows existing project patterns

## Risks and Mitigation
- **Risk**: Breaking existing functionality
  - **Mitigation**: Thorough testing and gradual refactoring
- **Risk**: Performance regression
  - **Mitigation**: Performance testing and optimization
- **Risk**: Complex interdependencies
  - **Mitigation**: Careful dependency analysis and design

## Next Steps
1. Create the core/ directory structure
2. Begin with Phase 1: Extract utility functions
3. Implement each phase incrementally
4. Test thoroughly at each step
5. Maintain working state throughout refactoring