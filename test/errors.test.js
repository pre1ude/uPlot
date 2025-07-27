/**
 * Tests for error handling system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	UPlotError,
	ERROR_TYPES,
	withErrorBoundary,
	validateRequired,
	validateType,
	validateArray,
	safeExecute,
	ErrorReporter,
	errorReporter
} from '../src/core/errors.js';

describe('UPlotError', () => {
	it('should create error with module context', () => {
		const error = new UPlotError('Test message', 'TestModule', { key: 'value' });
		
		expect(error.name).toBe('UPlotError');
		expect(error.message).toBe('[TestModule] Test message');
		expect(error.module).toBe('TestModule');
		expect(error.context).toEqual({ key: 'value' });
		expect(error.originalError).toBeNull();
	});

	it('should wrap original error', () => {
		const originalError = new Error('Original error');
		const error = new UPlotError('Wrapped message', 'TestModule', null, originalError);
		
		expect(error.originalError).toBe(originalError);
	});

	it('should maintain stack trace', () => {
		const error = new UPlotError('Test message', 'TestModule');
		expect(error.stack).toBeDefined();
	});
});

describe('withErrorBoundary', () => {
	it('should execute function normally when no error occurs', () => {
		const testFn = vi.fn(() => 'success');
		const wrappedFn = withErrorBoundary('TestModule', 'testMethod', testFn);
		
		const result = wrappedFn('arg1', 'arg2');
		
		expect(result).toBe('success');
		expect(testFn).toHaveBeenCalledWith('arg1', 'arg2');
	});

	it('should wrap native errors in UPlotError', () => {
		const testFn = vi.fn(() => {
			throw new Error('Native error');
		});
		const wrappedFn = withErrorBoundary('TestModule', 'testMethod', testFn);
		
		expect(() => wrappedFn('arg1')).toThrow(UPlotError);
		
		try {
			wrappedFn('arg1');
		} catch (error) {
			expect(error.module).toBe('TestModule');
			expect(error.message).toContain('Error in testMethod: Native error');
			expect(error.context.method).toBe('testMethod');
			expect(error.context.args).toBe('provided');
			expect(error.originalError.message).toBe('Native error');
		}
	});

	it('should re-throw UPlotError with additional context', () => {
		const originalError = new UPlotError('Original message', 'OriginalModule', { original: true });
		const testFn = vi.fn(() => {
			throw originalError;
		});
		const wrappedFn = withErrorBoundary('TestModule', 'testMethod', testFn);
		
		expect(() => wrappedFn()).toThrow(UPlotError);
		
		try {
			wrappedFn();
		} catch (error) {
			expect(error).toBe(originalError);
			expect(error.context.original).toBe(true);
			expect(error.context.method).toBe('testMethod');
		}
	});

	it('should handle functions with no arguments', () => {
		const testFn = vi.fn(() => {
			throw new Error('No args error');
		});
		const wrappedFn = withErrorBoundary('TestModule', 'testMethod', testFn);
		
		try {
			wrappedFn();
		} catch (error) {
			expect(error.context.args).toBe('none');
		}
	});
});

describe('validateRequired', () => {
	it('should return value when valid', () => {
		const value = 'test';
		const result = validateRequired(value, 'param', 'TestModule', 'testMethod');
		expect(result).toBe(value);
	});

	it('should throw UPlotError when value is null', () => {
		expect(() => {
			validateRequired(null, 'param', 'TestModule', 'testMethod');
		}).toThrow(UPlotError);
		
		try {
			validateRequired(null, 'param', 'TestModule', 'testMethod');
		} catch (error) {
			expect(error.module).toBe('TestModule');
			expect(error.message).toContain("Required parameter 'param' is missing or null");
			expect(error.context.method).toBe('testMethod');
			expect(error.context.parameter).toBe('param');
			expect(error.context.type).toBe(ERROR_TYPES.VALIDATION);
		}
	});

	it('should throw UPlotError when value is undefined', () => {
		expect(() => {
			validateRequired(undefined, 'param', 'TestModule', 'testMethod');
		}).toThrow(UPlotError);
	});

	it('should accept falsy values that are not null/undefined', () => {
		expect(validateRequired(0, 'param', 'TestModule')).toBe(0);
		expect(validateRequired('', 'param', 'TestModule')).toBe('');
		expect(validateRequired(false, 'param', 'TestModule')).toBe(false);
	});
});

describe('validateType', () => {
	it('should return value when type matches', () => {
		const value = 'test';
		const result = validateType(value, 'string', 'param', 'TestModule', 'testMethod');
		expect(result).toBe(value);
	});

	it('should throw UPlotError when type does not match', () => {
		expect(() => {
			validateType(123, 'string', 'param', 'TestModule', 'testMethod');
		}).toThrow(UPlotError);
		
		try {
			validateType(123, 'string', 'param', 'TestModule', 'testMethod');
		} catch (error) {
			expect(error.module).toBe('TestModule');
			expect(error.message).toContain("Parameter 'param' expected string but got number");
			expect(error.context.expectedType).toBe('string');
			expect(error.context.actualType).toBe('number');
		}
	});

	it('should handle all primitive types', () => {
		expect(validateType('test', 'string', 'param', 'TestModule')).toBe('test');
		expect(validateType(123, 'number', 'param', 'TestModule')).toBe(123);
		expect(validateType(true, 'boolean', 'param', 'TestModule')).toBe(true);
		expect(validateType({}, 'object', 'param', 'TestModule')).toEqual({});
		expect(validateType(() => {}, 'function', 'param', 'TestModule')).toBeInstanceOf(Function);
	});
});

describe('validateArray', () => {
	it('should return value when it is an array', () => {
		const value = [1, 2, 3];
		const result = validateArray(value, 'param', 'TestModule', 'testMethod');
		expect(result).toBe(value);
	});

	it('should throw UPlotError when value is not an array', () => {
		expect(() => {
			validateArray('not array', 'param', 'TestModule', 'testMethod');
		}).toThrow(UPlotError);
		
		try {
			validateArray('not array', 'param', 'TestModule', 'testMethod');
		} catch (error) {
			expect(error.module).toBe('TestModule');
			expect(error.message).toContain("Parameter 'param' expected array but got string");
			expect(error.context.expectedType).toBe('array');
			expect(error.context.actualType).toBe('string');
		}
	});

	it('should accept empty arrays', () => {
		expect(validateArray([], 'param', 'TestModule')).toEqual([]);
	});
});

describe('safeExecute', () => {
	it('should return function result when no error occurs', () => {
		const testFn = vi.fn(() => 'success');
		const result = safeExecute('TestModule', 'testMethod', testFn);
		
		expect(result).toBe('success');
		expect(testFn).toHaveBeenCalled();
	});

	it('should return fallback value when error occurs', () => {
		const testFn = vi.fn(() => {
			throw new Error('Test error');
		});
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		
		const result = safeExecute('TestModule', 'testMethod', testFn, 'fallback');
		
		expect(result).toBe('fallback');
		expect(consoleSpy).toHaveBeenCalledWith(
			'[TestModule] Non-critical error in testMethod:',
			expect.any(Error)
		);
		
		consoleSpy.mockRestore();
	});

	it('should return null as default fallback', () => {
		const testFn = vi.fn(() => {
			throw new Error('Test error');
		});
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		
		const result = safeExecute('TestModule', 'testMethod', testFn);
		
		expect(result).toBeNull();
		consoleSpy.mockRestore();
	});
});

describe('ErrorReporter', () => {
	let reporter;

	beforeEach(() => {
		reporter = new ErrorReporter();
	});

	it('should report and store errors', () => {
		const error = new UPlotError('Test error', 'TestModule');
		
		reporter.report(error);
		
		const errors = reporter.getErrors();
		expect(errors).toHaveLength(1);
		expect(errors[0].error).toBe(error);
		expect(errors[0].timestamp).toBeTypeOf('number');
		expect(errors[0].stack).toBeDefined();
	});

	it('should filter errors by module', () => {
		const error1 = new UPlotError('Error 1', 'Module1');
		const error2 = new UPlotError('Error 2', 'Module2');
		const error3 = new UPlotError('Error 3', 'Module1');
		
		reporter.report(error1);
		reporter.report(error2);
		reporter.report(error3);
		
		const module1Errors = reporter.getErrors('Module1');
		expect(module1Errors).toHaveLength(2);
		expect(module1Errors[0].error.message).toContain('Error 1');
		expect(module1Errors[1].error.message).toContain('Error 3');
	});

	it('should maintain maximum error count', () => {
		reporter.maxErrors = 3;
		
		for (let i = 0; i < 5; i++) {
			reporter.report(new UPlotError(`Error ${i}`, 'TestModule'));
		}
		
		const errors = reporter.getErrors();
		expect(errors).toHaveLength(3);
		expect(errors[0].error.message).toContain('Error 2'); // First two should be removed
	});

	it('should clear all errors', () => {
		reporter.report(new UPlotError('Error 1', 'TestModule'));
		reporter.report(new UPlotError('Error 2', 'TestModule'));
		
		expect(reporter.getErrors()).toHaveLength(2);
		
		reporter.clear();
		
		expect(reporter.getErrors()).toHaveLength(0);
	});

	it('should log to console in development', () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'development';
		
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const error = new UPlotError('Test error', 'TestModule');
		
		reporter.report(error);
		
		expect(consoleSpy).toHaveBeenCalledWith('uPlot Error:', error);
		
		consoleSpy.mockRestore();
		process.env.NODE_ENV = originalEnv;
	});
});

describe('Global error reporter', () => {
	beforeEach(() => {
		errorReporter.clear();
	});

	it('should be available as singleton', () => {
		expect(errorReporter).toBeInstanceOf(ErrorReporter);
	});

	it('should persist errors across imports', () => {
		const error = new UPlotError('Global test', 'TestModule');
		errorReporter.report(error);
		
		expect(errorReporter.getErrors()).toHaveLength(1);
	});
});

describe('ERROR_TYPES', () => {
	it('should define all expected error types', () => {
		expect(ERROR_TYPES.INITIALIZATION).toBe('INITIALIZATION');
		expect(ERROR_TYPES.VALIDATION).toBe('VALIDATION');
		expect(ERROR_TYPES.RENDERING).toBe('RENDERING');
		expect(ERROR_TYPES.DATA_PROCESSING).toBe('DATA_PROCESSING');
		expect(ERROR_TYPES.EVENT_HANDLING).toBe('EVENT_HANDLING');
		expect(ERROR_TYPES.SCALE_CALCULATION).toBe('SCALE_CALCULATION');
		expect(ERROR_TYPES.LAYOUT_CALCULATION).toBe('LAYOUT_CALCULATION');
	});
});