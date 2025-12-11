type Success<T> = {
  data: T;
  error: null;
};

type Failure<E> = {
  data: null;
  error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

// Function overloads - order matters! More specific overloads first.
// Overload for Promise
export function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>>;
// Overload for async function (function returning a Promise)
export function tryCatch<T, E = Error>(asyncFn: () => Promise<T>): Promise<Result<T, E>>;
// Overload for sync function
export function tryCatch<T, E = Error>(fn: () => T): Result<T, E>;

// Implementation
export function tryCatch<T, E = Error>(
  promiseOrFn: Promise<T> | (() => T) | (() => Promise<T>)
): Promise<Result<T, E>> | Result<T, E> {
  // Handle Promise directly
  if (promiseOrFn instanceof Promise) {
    return (async () => {
      try {
        const data = await promiseOrFn;
        return { data, error: null };
      } catch (error) {
        return { data: null, error: error as E };
      }
    })();
  }

  // Handle functions (sync or async)
  if (typeof promiseOrFn === 'function') {
    try {
      const result = promiseOrFn();

      // Check if the function returned a Promise (async function)
      if (result instanceof Promise) {
        return (async () => {
          try {
            const data = await result;
            return { data, error: null };
          } catch (error) {
            return { data: null, error: error as E };
          }
        })();
      }

      // Synchronous function - return result directly
      return { data: result as T, error: null };
    } catch (error) {
      return { data: null, error: error as E };
    }
  }

  throw new Error('Invalid argument passed to tryCatch. Expected a Promise or a function.');
}
