flasync
=======

A simple helper mix-in for authors of fluent asynchronous APIs.

Writing an API with flasync
---------------------------

Writing a fluent API with flasync is very close to writing a regular
fluent JavaScript object. The differences are that the flasync library
has to be mixed-in by doing a `flasync(this)` in your constructor.

All synchronous methods have to be wrapped in a call to `this.asyncify`,
and all asynchronous methods must be wrapped with `this.async`.
There's no constraint on the signature of synchronous methods
(except that they must return `this`, being fluent).
Asynchronous methods must take a callback as their last parameter.

Here's an example of a simple API that can write to the console a text
literal using the `write` method, and dump the contents of a file to
the console:

```javascript
'use strict';
var flasync = require('flasync');
var fs = require('fs');

var Dump = function Dump() {
  flasync(this);
  var self = this;

  this.write = this.asyncify(
    this._write = function(text) {

    Console.log(text);
    return this;
  });

  this.fromFile = this.async(
    this._fromFile = function(path, next) {
    
    fs.readFile(path, function (err, text) {
      if (err) {
        next(err);
        return;
      }
      self._write(text);
      next();
    });
    return this;
  });
};
```

Notice how the `fromFile` method calls the non-asynchronified private
version of write, to avoid wasteful and unclear asynchronous calls to a
method that does not require to be called asynchronously.
Methods that need to call other methods should do the same.
Internally, methods should always call the private versions of other
methods.

The `then` and `finally` methods are added to the object when applying
the mix-in.

Using an API built with flasync
-------------------------------

Here's some sample code using the API defined in the previous section:

```javascript
var Dump = require('./lib/dump');

var dump = new Dump();

dump
  .write('The file readme.txt contains:')
  .fromFile('readme.txt')
  .write('End of file...')
  .then(function(next) {
    // do something else
    next();
  })
  .finally(function() {
    // do one final thing
  });
```

The output of this program looks like this:

```
The file readme.txt contains:
Lorem ipsum dolor sit amet
End of file...
```

As you can see, the output order is the same as the calling order,
despite the fact that fromFile is asynchronous, and write is not.
That means that the second write call has been transformed into an
asynchronous method call, so that it can happen after the file
read has called back.

Also notice that no callback function is present, as the method
chaining gives enough information about the desired outcome.

The `then` method has been provided by flasync.
Then blocks can be inserted at any stage of the call chain.

The `finally` method should be used when terminating a chain
of calls.
It doesn't mean the API can't be used after this has been called,
but it shouldn't be used until the callback function has been called.
By design, the `finally` method is not fluent.

Error handling
--------------

Errors should be thrown from methods like usual. If the user of
your API provided an `onError` handler, that handler will receive
the error as its parameter. If no error handler is specified,
the error will bubble up the stack. Because of asynchrony however,
the API user should not count on being able to try/catch those exceptions,
and should use an error handler instead, unless the desired behavior
is for the errors to bubble up the stack to a global error handler
for the application.

```javascript
dump.onError(function(err) {
  // Do something with the error
})
```

The error handler has to be added before the throwing method is called.

Blog posts about this library
-----------------------------

For more info...

1. [API Requirements](https://weblogs.asp.net/bleroy/fluent-asynchronous-api-1-api-requirements)
2. [Building an API](https://weblogs.asp.net/bleroy/fluent-asynchronous-api-2-building-an-api)
3. [The helper library](https://weblogs.asp.net/bleroy/fluent-asynchronous-api-3-the-helper-library)
4. [Nope, Q won't work](https://weblogs.asp.net/bleroy/fluent-asynchronous-api-4-nope-q-won%E2%80%99t-work)
5. [Internally calling methods](https://weblogs.asp.net/bleroy/fluent-asynchronous-api-5-internally-calling-methods)
6. [Recursive calls](https://weblogs.asp.net/bleroy/fluent-asynchronous-api-6-recursive-tail-calls)