import {
	mousemove,
	mousedown,
	mouseup,
	mouseleave,
	mouseenter,
	dblclick,
	resize,
	scroll,
	dppxchange,
} from '../strings';

import {
	domEnv,
	doc,
	win,
	on,
	off,
} from '../dom';

import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	safeExecute,
	errorReporter
} from './errors.js';

/**
 * EventManager handles all mouse and touch event binding, unbinding, and processing
 * for uPlot instances. It manages event listeners, coordinates with cursor system,
 * and handles drag operations.
 */
export class EventManager {
	constructor(uplot) {
		try {
			validateRequired(uplot, 'uplot', 'EventManager', 'constructor');
			
			this.uplot = uplot;
			this.mouseListeners = new Map();
			this.globalListeners = new Set();
			this.dragging = false;
			
			// Mouse position tracking
			this.rawMouseLeft0 = 0;
			this.rawMouseTop0 = 0;
			this.mouseLeft0 = 0;
			this.mouseTop0 = 0;
			this.rawMouseLeft1 = 0;
			this.rawMouseTop1 = 0;
			this.mouseLeft1 = 0;
			this.mouseTop1 = 0;
			
			// Drag state
			this.dragX = false;
			this.dragY = false;
			this.downSelectLeft = 0;
			this.downSelectTop = 0;
			this.downSelectWidth = 0;
			this.downSelectHeight = 0;
			
			// Cached rect for performance
			this.rect = null;
		} catch (error) {
			errorReporter.report(error);
			throw error;
		}
	}

	/**
	 * Initialize event handling system
	 */
	initEvents(opts) {
		try {
			return withErrorBoundary('EventManager', 'initEvents', function(opts) {
				validateRequired(opts, 'opts', 'EventManager', 'initEvents');
			
			const { cursor, over, wrap } = this.uplot;
			
			if (!cursor) {
				throw new UPlotError(
					'Cursor configuration not available',
					'EventManager',
					{ method: 'initEvents', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			if (!over) {
				throw new UPlotError(
					'Over element not available for event binding',
					'EventManager',
					{ method: 'initEvents', type: ERROR_TYPES.INITIALIZATION }
				);
			}
			
			if (!cursor.show) {
				return;
			}

			try {
				// Bind main cursor events
				this.onMouse(mousedown, over, this.mouseDown.bind(this));
				this.onMouse(mousemove, over, this.mouseMove.bind(this));
				this.onMouse(mouseenter, over, this.mouseEnter.bind(this));
				this.onMouse(mouseleave, over, this.mouseLeave.bind(this));
				this.onMouse(dblclick, over, this.dblClick.bind(this));

				// Touch event support
				this.initTouchEvents(over);

				// Bind click handler for drag operations
				if (wrap) {
					on("click", wrap, this.handleWrapClick.bind(this), true);
				}

				// Global window events for invalidation
				if (domEnv) {
					this.bindGlobalEvent(resize, win, this.invalidateRects.bind(this));
					this.bindGlobalEvent(scroll, win, this.invalidateRects.bind(this), true);
					this.bindGlobalEvent(dppxchange, win, this.onDppxChange.bind(this));
				}
			} catch (error) {
				throw new UPlotError(
					`Error initializing events: ${error.message}`,
					'EventManager',
					{ method: 'initEvents', type: ERROR_TYPES.EVENT_HANDLING },
					error
				);
			}
			}).call(this, opts);
		} catch (error) {
			errorReporter.reportError(error);
			throw error;
		}
	}

	/**
	 * Initialize touch event support
	 */
	initTouchEvents(target) {
		// Touch events are handled by converting them to mouse events
		// This provides basic touch support for mobile devices
		
		const touchToMouse = (touchEvent, mouseEventType) => {
			if (touchEvent.touches.length === 1) {
				const touch = touchEvent.touches[0];
				const mouseEvent = new MouseEvent(mouseEventType, {
					clientX: touch.clientX,
					clientY: touch.clientY,
					button: 0,
					buttons: 1,
					bubbles: true,
					cancelable: true
				});
				
				// Prevent default touch behavior
				touchEvent.preventDefault();
				
				// Dispatch the synthetic mouse event
				target.dispatchEvent(mouseEvent);
			}
		};

		// Convert touch events to mouse events
		on('touchstart', target, (e) => touchToMouse(e, 'mousedown'));
		on('touchmove', target, (e) => touchToMouse(e, 'mousemove'));
		on('touchend', target, (e) => {
			// For touchend, we need to use changedTouches
			if (e.changedTouches.length === 1) {
				const touch = e.changedTouches[0];
				const mouseEvent = new MouseEvent('mouseup', {
					clientX: touch.clientX,
					clientY: touch.clientY,
					button: 0,
					buttons: 0,
					bubbles: true,
					cancelable: true
				});
				
				e.preventDefault();
				target.dispatchEvent(mouseEvent);
			}
		});
	}

	/**
	 * Bind mouse event with cursor configuration
	 */
	onMouse(ev, targ, fn, onlyTarg = true) {
		const { cursor } = this.uplot;
		const targListeners = this.mouseListeners.get(targ) || {};
		
		// Check if cursor and bind exist
		if (!cursor || !cursor.bind || typeof cursor.bind[ev] !== 'function') {
			// Fallback: bind directly without cursor filtering
			on(ev, targ, targListeners[ev] = fn);
			this.mouseListeners.set(targ, targListeners);
			return;
		}
		
		const listener = cursor.bind[ev](this.uplot, targ, fn, onlyTarg);

		if (listener) {
			on(ev, targ, targListeners[ev] = listener);
			this.mouseListeners.set(targ, targListeners);
		}
	}

	/**
	 * Unbind mouse events
	 */
	offMouse(ev, targ) {
		const targListeners = this.mouseListeners.get(targ) || {};

		for (let k in targListeners) {
			if (ev == null || k == ev) {
				off(k, targ, targListeners[k]);
				delete targListeners[k];
			}
		}

		if (ev == null) {
			this.mouseListeners.delete(targ);
		}
	}

	/**
	 * Bind global window events
	 */
	bindGlobalEvent(event, target, handler, useCapture = false) {
		on(event, target, handler, useCapture);
		this.globalListeners.add({ event, target, handler, useCapture });
	}

	/**
	 * Handle wrap click events for drag operations
	 */
	handleWrapClick(e) {
		const { over, cursor } = this.uplot;
		
		if (e.target === over) {
			let didDrag = this.mouseLeft1 != this.mouseLeft0 || this.mouseTop1 != this.mouseTop0;
			didDrag && cursor.drag.click(this.uplot, e);
		}
	}

	/**
	 * Mouse down event handler
	 */
	mouseDown(e, src, _l, _t, _w, _h, _i) {
		return withErrorBoundary('EventManager', 'mouseDown', function(e, src, _l, _t, _w, _h, _i) {
			const { cursor } = this.uplot;
			
			if (!cursor || !cursor.drag) {
				throw new UPlotError(
					'Cursor or drag configuration not available',
					'EventManager',
					{ method: 'mouseDown', type: ERROR_TYPES.EVENT_HANDLING }
				);
			}
			
			try {
				this.dragging = true;
				this.dragX = this.dragY = cursor.drag._x = cursor.drag._y = false;

				let left = _l ?? this.mouseLeft1;
				let top = _t ?? this.mouseTop1;

				this.rawMouseLeft0 = this.rawMouseLeft1 = this.mouseLeft0 = this.mouseLeft1 = left;
				this.rawMouseTop0 = this.rawMouseTop1 = this.mouseTop0 = this.mouseTop1 = top;

				this.downSelectLeft = left;
				this.downSelectTop = top;
				this.downSelectWidth = 0;
				this.downSelectHeight = 0;

				if (e != null) {
					this.onMouse(mouseup, doc, this.mouseUp.bind(this), false);
					
					if (typeof this.uplot.pubSync === 'function') {
						try {
							this.uplot.pubSync(mousedown, this.uplot, this.mouseLeft0, this.mouseTop0, 
								this.uplot.plotWidCss, this.uplot.plotHgtCss, null);
						} catch (pubSyncError) {
							// Log pubSync errors but don't throw - they shouldn't break mouse handling
							errorReporter.reportError(new UPlotError(
								`PubSync error in mouseDown: ${pubSyncError.message}`,
								'EventManager',
								{ method: 'mouseDown', type: ERROR_TYPES.EVENT_HANDLING },
								pubSyncError
							));
						}
					}
				}
			} catch (error) {
				const uplotError = new UPlotError(
					`Error handling mouse down: ${error.message}`,
					'EventManager',
					{ method: 'mouseDown', type: ERROR_TYPES.EVENT_HANDLING },
					error
				);
				errorReporter.reportError(uplotError);
				throw uplotError;
			}
		}).call(this, e, src, _l, _t, _w, _h, _i);
	}

	/**
	 * Mouse move event handler
	 */
	mouseMove(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		if (cursor._lock) {
			return;
		}

		this.setCursorEvent(e);

		// Ignore phantom mousemove events on touch devices
		if (this.dragging && e != null && e.movementX == 0 && e.movementY == 0) {
			return;
		}

		this.syncRect(false);

		let left, top;

		if (e != null) {
			left = e.clientX - this.rect.left;
			top = e.clientY - this.rect.top;
		} else {
			left = _l;
			top = _t;
			this.syncRect(true);
		}

		if (left < 0 || top < 0) {
			left = -10;
			top = -10;
		}

		this.mouseLeft1 = left;
		this.mouseTop1 = top;

		this.updateCursor(null, src == null, src != null);
	}

	/**
	 * Mouse up event handler
	 */
	mouseUp(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		this.dragging = cursor.drag._x = cursor.drag._y = false;

		let left = _l ?? this.mouseLeft1;
		let top = _t ?? this.mouseTop1;

		this.rawMouseLeft1 = this.mouseLeft1 = left;
		this.rawMouseTop1 = this.mouseTop1 = top;

		// Handle selection
		if (cursor.drag.setScale) {
			let deltaX = this.mouseLeft1 - this.mouseLeft0;
			let deltaY = this.mouseTop1 - this.mouseTop0;

			if (this.dragX && Math.abs(deltaX) >= cursor.drag.dist) {
				this.setSelect({
					left: Math.min(this.mouseLeft0, this.mouseLeft1),
					width: Math.abs(deltaX),
					top: cursor.drag.y ? Math.min(this.mouseTop0, this.mouseTop1) : 0,
					height: cursor.drag.y ? Math.abs(deltaY) : this.uplot.plotHgtCss,
				}, false);
			}
		}

		if (e != null) {
			this.offMouse(mouseup, doc);
			this.uplot.pubSync(mouseup, this.uplot, this.mouseLeft1, this.mouseTop1, 
				this.uplot.plotWidCss, this.uplot.plotHgtCss, null);
		}
	}

	/**
	 * Mouse leave event handler
	 */
	mouseLeave(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		if (cursor._lock) {
			return;
		}

		this.setCursorEvent(e);

		if (!this.dragging) {
			this.rawMouseLeft1 = this.mouseLeft1 = -10;
			this.rawMouseTop1 = this.mouseTop1 = -10;

			// Only fire on actual mouse leave, not programmatic
			this.updateCursor(null, src == null, src != null);
		}
	}

	/**
	 * Mouse enter event handler
	 */
	mouseEnter(e) {
		this.setCursorEvent(e);
		this.syncRect(false);
	}

	/**
	 * Double click event handler
	 */
	dblClick(e, src, _l, _t, _w, _h, _i) {
		const { cursor } = this.uplot;
		
		if (cursor._lock) {
			return;
		}

		this.setCursorEvent(e);

		let left = _l ?? this.mouseLeft1;
		let top = _t ?? this.mouseTop1;

		this.rawMouseLeft1 = this.mouseLeft1 = left;
		this.rawMouseTop1 = this.mouseTop1 = top;

		this.updateCursor(null, src == null, src != null);

		this.uplot.pubSync(dblclick, this.uplot, this.mouseLeft1, this.mouseTop1, 
			this.uplot.plotWidCss, this.uplot.plotHgtCss, null);
	}

	/**
	 * Set cursor event reference
	 */
	setCursorEvent(e) {
		this.uplot.cursor.event = e;
	}

	/**
	 * Update cursor position and trigger cursor update
	 */
	updateCursor(ts, _fire, _pub) {
		this.rawMouseLeft1 = this.mouseLeft1;
		this.rawMouseTop1 = this.mouseTop1;

		[this.mouseLeft1, this.mouseTop1] = this.uplot.cursor.move(
			this.uplot, this.mouseLeft1, this.mouseTop1
		);

		this.uplot.cursor.left = this.mouseLeft1;
		this.uplot.cursor.top = this.mouseTop1;

		// Delegate to uPlot's updateCursor method
		if (this.uplot.updateCursor) {
			this.uplot.updateCursor(ts, _fire, _pub);
		}
	}

	/**
	 * Sync bounding rect cache
	 */
	syncRect(force) {
		if (force || this.rect == null) {
			this.rect = this.uplot.over.getBoundingClientRect();
			this.uplot.fire("syncRect", this.rect);
		}
	}

	/**
	 * Set selection area
	 */
	setSelect(opts, _fire) {
		// Delegate to uPlot's setSelect method
		if (this.uplot.setSelect) {
			this.uplot.setSelect(opts, _fire);
		}
	}

	/**
	 * Handle DPR change events
	 */
	onDppxChange() {
		// Update pixel ratio - this will be handled by main uPlot instance
		if (this.uplot.setPxRatio) {
			this.uplot.setPxRatio();
		}
	}

	/**
	 * Invalidate cached rects for all cursor plots
	 */
	invalidateRects() {
		// This will be handled by the global cursor plots set
		// Individual instances don't need to track this
		if (this.uplot.syncRect) {
			this.uplot.syncRect(true);
		}
	}

	/**
	 * Get current mouse position
	 */
	getMousePos() {
		return {
			left: this.mouseLeft1,
			top: this.mouseTop1,
			rawLeft: this.rawMouseLeft1,
			rawTop: this.rawMouseTop1
		};
	}

	/**
	 * Get drag state
	 */
	getDragState() {
		return {
			dragging: this.dragging,
			dragX: this.dragX,
			dragY: this.dragY,
			startLeft: this.mouseLeft0,
			startTop: this.mouseTop0
		};
	}

	/**
	 * Clean up all event listeners
	 */
	destroy() {
		// Remove all mouse listeners
		for (let [targ] of this.mouseListeners) {
			this.offMouse(null, targ);
		}
		this.mouseListeners.clear();

		// Remove global listeners
		for (let { event, target, handler, useCapture } of this.globalListeners) {
			off(event, target, handler, useCapture);
		}
		this.globalListeners.clear();
	}
}