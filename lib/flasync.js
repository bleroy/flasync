// Flasync Fluent Asynchronous API Helper (c) 2014 Bertrand Le Roy, under MIT. See LICENSE.txt for licensing details.
'use strict';

/**
 * @description
 * This mix-in adds utility methods and infrastructure to an object
 * to help build a fluent and asynchronous API.
 * @param {object} thing The object to flasync.
 */
function flasync(thing) {
  thing._todo = [];
  thing._pendingCount = 0;

  /**
   * @description
   * Adds an asynchronous task to be executed.
   * @param {Function} callback the task to add.
   * It must take a "done" function parameter and call it when it's done.
   * @returns {Object} The fluent object.
   */
  thing.then = function then(callback) {
    // console.log("then... " + callback.name + ' (' + this._pendingCount + ', ' + this._todo.length + ')');
    thing._todo.push(callback);
    // Ask the first task to execute if it doesn't already exist.
    if (!thing._pendingCount) {
      thing._nextTask();
    }
    return thing;
  };

  /**
   * @description
   * Use this rather than "then" when adding a tail callback that
   * you don't intend to follow with anything.
   * It doesn't mean the API can't be used after this has been called,
   * but it shouldn't be used until the callback function has been called.
   * Notice that by design, this method is not fluent.
   * @param {Function} callback The function to call back when all pending
   *                            calls in the to-do list have called back.
   */
  thing.finally = function final(callback) {
    // console.log("finally... " + callback.name + ' (' + this._pendingCount + ', ' + this._todo.length + ')');
    thing._todo.push(function() {
      thing._pendingCount--;
      callback();
    });
    if (thing._pendingCount === 0) {
      thing._nextTask();
    }
  };

  /**
   * @description
   * Triggers the next task to execute.
   */
  thing._nextTask = function nextTask() {
    // console.log('next... (' + this._pendingCount + ', ' + this._todo.length + ')');
    if (thing._todo.length === 0) {
      return;
    }
    var nextTask = thing._todo.shift();
    try {
      thing._pendingCount++;
      nextTask(function (err) {
        if (err && thing._onError) {
          thing._todo = [];
          thing._pendingCount = 0;
          thing._onError(err);
        }
        thing._pendingCount--;
        thing._nextTask();
      });
    }
    catch(err) {
      // If there's an error, we call onError and stop the chain.
      thing._todo = [];
      thing._pendingCount = 0;
      if (thing._onError) {thing._onError(err);}
      else {throw err;}
    }
    // console.log('end of next (' + this._pendingCount + ', ' + this._todo.length + ')');
  };

  /**
   * @description
   * Surround non-asynchronous method declarations with a call to this method,
   * in order to instrument them to behave asynchronously as necessary.
   * @param {Function} method The method to async-ify.
   * @returns {Function} The async-ified method, that can be called exactly
   * like the normal method, but will act nicely with the rest of the
   * asynchronous API.
   */
  thing.asyncify = function asyncify(method) {
    return function asyncified() {
      if (!thing._pendingCount) {
        // If not async yet, just do it.
        return method.apply(thing, arguments);
      }
      // Otherwise, bind it and enqueue it
      var args = Array.prototype.slice.call(arguments);
      args.unshift(thing);
      var bound = Function.prototype.bind.apply(method, args);
      thing.then(function callAsyncifiedMethod(done) {
        bound.apply(thing);
        done();
      });
      return thing;
    };
  };

  /**
   * @description
   * Surround asynchronous method declarations with a call to this method,
   * in order to instrument them to behave well with the rest of the API.
   * @param {Function} method The asynchronous method to instrument.
   *   It must take a 'done' callback parameter as its last parameter.
   *   The user will never pass that parameter, instead it will be generated.
   * @returns {Function} The public method that users of the API will call.
   */
  thing.async = function async(method) {
    return function asyncMethod() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(thing);
      var bound = Function.prototype.bind.apply(method, args);
      return thing.then(bound);
    };
  };

  /**
   * @description
   * Sets-up an error handler for API calls.
   * @param {Function} errorHandler The function that will handle errors.
   *   The function must take the error object as its parameter.
   */
  thing.onError = function(errorHandler) {
    thing._onError = errorHandler;
    return thing;
  };

  return thing;
}

module.exports = flasync;