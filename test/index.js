// DecentCMS (c) 2014 Bertrand Le Roy, under MIT. See LICENSE.txt for licensing details.
'use strict';
var expect = require('chai').expect;
var flasync = require('../lib/flasync');

describe('Flasync Fluent Async API helper', function() {
  // Build an API using the library
  var Api = function Api(output) {
    var self = this;
    this.output = output || [];
    flasync(this);
    // It has one synchronous method
    this.writeSync = this.asyncify(
      this._writeSync = function writeSync(label, text) {

        this.output.push(label + ':' + text);
        return this;
      }
    );
    // And asynchronous methods
    this.write = this.async(
      this._write = function write(label, text, next) {
        process.nextTick(function () {
          self._writeSync(label, text);
          next();
        });
      return this;
    });
    // An async method that calls another
    this.writeToken = this.async(
      this._writeToken = function writeToken(label, text, next) {

      self._write(label, '[' + text + ']', next);
      return this;
    })
  };

  it('behaves as a synchronous API as long as only synchronous methods are called', function() {
    var api = new Api();

    api
      .writeSync('fou', 'foo')
      .writeSync('barre', 'bar')
      .writeSync('base', 'baz');

    expect(api.output).to.deep.equal(['fou:foo', 'barre:bar', 'base:baz']);
  });

  it('preserves call order even for synchronous methods called after an asynchronous one', function(done) {
    var api = new Api();

    api
      .writeSync('fou', 'foo')
      .write('barre', 'bar')
      .writeSync('base', 'baz')
      .then(function thenAssertAndFinish() {
        expect(api.output).to.deep.equal(['fou:foo', 'barre:bar', 'base:baz']);
        done();
      });
  });

  it('executes asynchronous continuations in order', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .then(function thenWriteBar(next) {
        api.output.push('bar');
        next();
      })
      .then(function thenWriteBaz(next) {
        api.output.push('baz');
        next();
      })
      .then(function thenAssertAndFinish() {
        expect(api.output).to.deep.equal(['fou:foo', 'bar', 'baz']);
        done();
      });
  });

  it('can nest async calls', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .then(function thenMakeNestedCalls(next) {
        api
          .writeSync('barre', 'bar')
          .write('base', 'baz')
          .then(function thenAssertAndFinish() {
            expect(api.output).to.deep.equal(['fou:foo', 'barre:bar', 'base:baz']);
            done();
          });
        next();
      });
  });

  it('can end the chain and restart it later', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .writeSync('base', 'baz')
      .finally(function finallyChainMoreCalls() {
        api
          .write('barre', 'bar')
          .then(function thenAssertAndContinue(next) {
            expect(api.output).to.deep.equal(['fou:foo', 'base:baz', 'barre:bar']);
            next();
          })
          .finally(function finallyMakeAnotherCall() {
            api.finally(function finallyMakeYetAnotherCall() {
              api.finally(done);});
          });
      });
  });

  it('can end the chain after synchronous methods only as well', function(done) {
    var api = new Api();

    api
      .writeSync('fou', 'foo')
      .finally(function finallyAssertAndFinish() {
        expect(api.output).to.deep.equal(['fou:foo']);
        done();
      });
  });

  it.skip('can nest finally inside an async method', function(done) {
    // This is skipped, but left in to demonstrate a subtle case of
    // deadlock: next is never called because the execution of the
    // finally is contingent on the outer then's next callback
    // being called.
    var api = new Api();

    api
      .then(function thenRegisterNextTick(next) {
        process.nextTick(function onTick() {
          api.finally(next);
        });
      })
      .finally(done);
  });

  it('can nest finally inside an async method by using an inner api instance', function(done) {
    // This is a working version of the previous test.
    var api = new Api();

    api
      .then(function thenRegisterNextTick(next) {
        var innerApi = new Api();
        process.nextTick(function onTick() {
          innerApi.finally(next);
        });
      })
      .finally(done);
  });

  it('lets asynchronous methods call other asynchronous methods', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .writeToken('barre', 'bar')
      .writeToken('base', 'baz')
      .write('donne', 'done')
      .then(function thenAssertAndFinish() {
        expect(api.output).to.deep.equal(['fou:foo', 'barre:[bar]', 'base:[baz]', 'donne:done']);
        done();
      })
  });

  it('can handle exceptions and suspend execution', function(done) {
    var api = new Api();
    var hit = false;

    api
      .onError(function onError(err) {
        expect(hit).to.be.false;
        done();
      })
      .then(function thenThrow(next) {
        throw new Error('oops');
      })
      .then(function thenSetHitToTrue(next) {
        hit = true;
      });
  });

  it('lets exceptions through if no error handler is defined', function() {
    var api = new Api();

    expect(function asynchronouslyThrow() {
      api
        .then(function thenThrow(next) {
          throw new Error('oops');
        })
    })
      .to.throw('oops');
  });
});