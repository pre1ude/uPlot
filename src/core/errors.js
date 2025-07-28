/**
 * Standardized error handling system for uPlot modules
 */

/**
 * Base uPlot error class with module context
 */
export class UPlotError extends Error {
	constructor(message, module, context = null, originalError = null) {
		const fullMessage = `[${module}] ${message}`;
		super(fullMessage);
		
		this.name = 'UPlotError';
		this.module = module;
		this.context = context;
		this.originalError = originalError;
		
		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UPlotError);
		}
	}
}

/**
 * Error types for different categories of errors
 */
export const ERROR_TYPES = {
	INITIALIZATION: 'INITIALIZATION',
	VALIDATION: 'VALIDATION',
	RENDERING: 'RENDERING',
	DATA_PROCESSING: 'DATA_PROCESSING',
	EVENT_HANDLING: 'EVENT_HANDLING',
	SCALE_CALCULATION: 'SCALE_CALCULATION',
	LAYOUT_CALCULATION: 'LAYOUT_CALCULATION'
};

/**
 * Error boundary wrapper for module methods
 */
export function withErrorBoundary(moduleName, methodName, fn) {
	return function(...args) {
		try {
			return fn.apply(this, args);
		} catch (error) {
			const context = {
				method: methodName,
				args: args.length > 0 ? 'provided' : 'none',
				timestamp: Date.now()
			};
			
			if (error instanceof UPlotError) {
				// Re-throw uPlot errors with additional context
				error.context = { ...error.context, ...context };
				throw error;
			} else {
				// Wrap native errors
				throw new UPlotError(
					`Error in ${methodName}: ${error.message}`,
					moduleName,
					context,
					error
				);
			}
		}
	};
}

/**
 * Validation helper that throws standardized errors
 */
export function validateRequired(value, paramName, moduleName, methodName = 'unknown') {
	if (value === null || value === undefined) {
		throw new UPlotError(
			`Required parameter '${paramName}' is missing or null`,
			moduleName,
			{ method: methodName, parameter: paramName, type: ERROR_TYPES.VALIDATION }
		);
	}
	return value;
}

/**
 * Type validation helper
 */
export function validateType(value, expectedType, paramName, moduleName, methodName = 'unknown') {
	const actualType = typeof value;
	if (actualType !== expectedType) {
		throw new UPlotError(
			`Parameter '${paramName}' expected ${expectedType} but got ${actualType}`,
			moduleName,
			{ 
				method: methodName, 
				parameter: paramName, 
				expectedType, 
				actualType,
				type: ERROR_TYPES.VALIDATION 
			}
		);
	}
	return value;
}

/**
 * Array validation helper
 */
export function validateArray(value, paramName, moduleName, methodName = 'unknown') {
	if (!Array.isArray(value)) {
		throw new UPlotError(
			`Parameter '${paramName}' expected array but got ${typeof value}`,
			moduleName,
			{ 
				method: methodName, 
				parameter: paramName, 
				expectedType: 'array',
				actualType: typeof value,
				type: ERROR_TYPES.VALIDATION 
			}
		);
	}
	return value;
}

/**
 * Safe execution wrapper that catches and logs errors without throwing
 */
export function safeExecute(moduleName, methodName, fn, fallbackValue = null) {
	try {
		return fn();
	} catch (error) {
		console.warn(`[${moduleName}] Non-critical error in ${methodName}:`, error);
		return fallbackValue;
	}
}

/**
 * Error reporter for debugging and monitoring
 */
export class ErrorReporter {
	constructor() {
		this.errors = [];
		this.maxErrors = 100; // Prevent memory leaks
	}
	
	report(error) {
		// Add to error log
		this.errors.push({
			error,
			timestamp: Date.now(),
			stack: error.stack
		});
		
		// Maintain max size
		if (this.errors.length > this.maxErrors) {
			this.errors.shift();
		}
		
		// Log to console in development
		if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
			console.error('uPlot Error:', error);
		}
	}
	
	// Alias for backward compatibility
	reportError(error) {
		return this.report(error);
	}
	
	getErrors(moduleName = null) {
		if (!moduleName) {
			return this.errors;
		}
		return this.errors.filter(entry => entry.error.module === moduleName);
	}
	
	clear() {
		this.errors = [];
	}
}

// Global error reporter instance
export const errorReporter = new ErrorReporter();