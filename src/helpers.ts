import { Arrayable, Callable, Source, Thenable } from "./types";

/**
 * Return true if argument is PromiseLike, false otherwise.
 *
 * @function
 * @param {any} some
 * @returns {Boolean}
 */
export const _isPromiseLike = <T>(some: any): some is PromiseLike<T> => {
	return (
		!!some &&
		(typeof some === "object" || typeof some === "function") &&
		typeof some.then === "function"
	);
};

/**
 * Return true if argument is Array, false otherwise.
 */
export const _isArray = <T>(some: any): some is Array<T> => {
	return Array.isArray(some);
};

/**
 * Converts the supposed Array to an Array.
 *
 * @example
 * <pre><code>
 * _getArrayable(1) // [1]
 * _getArrayable([1, 2]) // [1, 2]
 * </code></pre>
 */
export const _getArrayable = <T>(arrayable: Arrayable<T>): T[] => {
	return _isArray(arrayable) ? arrayable : [arrayable];
};

/**
 * Converts the supposed Promise to a Promise.
 *
 * @example
 * _getThenable(1) // Promise { 1 }
 * _getThenable(Promise.resolve(1)) // Promise { 1 }
 */
export const _getThenable = <T>(thenable: Thenable<T>): Promise<T> => {
	return _isPromiseLike<T>(thenable) ? (thenable as Promise<T>) : Promise.resolve(thenable);
};

/**
 * Converts the supposed Function to a value.
 *
 * @example
 * _getCallable(1) // 1
 * _getCallable(() => 1) // 1
 */
export const _getCallable = <T>(callable: Callable<T>): T => {
	return typeof callable === "function" ? callable() : callable;
};

/**
 * Converts the supposed Function or PromiseLike or value to a Promise.
 *
 * @example
 * _getSource(1) // Promise { 1 }
 * _getSource(() => 1) // Promise { 1 }
 * _getSource(Promise.resolve(1)) // Promise { 1 }
 */
export const _getSource = <T>(source: Source<T>): Promise<T> => {
	return _getThenable(_isPromiseLike(source) ? source : _getCallable(source));
};
