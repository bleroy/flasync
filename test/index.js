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
      this._writeSync = function(text) {

      this.output.push(text);
      return this;
    });
    // And one asynchronous method
    this.write = this.async(function(text, next) {
      process.nextTick(function () {
        self._writeSync(text);
        next();
      });
      return this;
    });
  };

  it('behaves as a synchronous API as long as only synchronous methods are called', function() {
    var api = new Api();

    api
      .writeSync('foo')
      .writeSync('bar')
      .writeSync('baz');

    expect(api.output).to.deep.equal(['foo', 'bar', 'baz']);
  });

  it('preserves call order even for synchronous methods called after an asynchronous one', function(done) {
    var api = new Api();

    api
      .writeSync('foo')
      .write('bar')
      .writeSync('baz')
      .then(function() {
        expect(api.output).to.deep.equal(['foo', 'bar', 'baz']);
        done();
      });
  });

  it('executes asynchronous continuations in order', function(done) {
    var api = new Api();

    api
      .write('foo')
      .then(function(next) {
        api.output.push('bar');
        next();
      })
      .then(function(next) {
        api.output.push('baz');
        next();
      })
      .then(function() {
        expect(api.output).to.deep.equal(['foo', 'bar', 'baz']);
        done();
      });
  });

  it('can nest async calls', function(done) {
    var api = new Api();

    api
      .write('foo')
      .then(function(next) {
        api
          .writeSync('bar')
          .write('baz')
          .then(function() {
            expect(api.output).to.deep.equal(['foo', 'bar', 'baz']);
            done();
          });
        next();
      });
  });

  it('can handle exceptions and suspend execution', function(done) {
    var api = new Api();
    var hit = false;

    api
      .onError(function(err) {
        expect(hit).to.be.false;
        done();
      })
      .then(function(next) {
        throw new Error('oops');
      })
      .then(function(next) {
        hit = true;
      });
  });

  it('lets exceptions through if no error handler is defined', function() {
    var api = new Api();

    expect(function() {
      api
        .then(function(next) {
          throw new Error('oops');
        })
    })
      .to.throw('oops');
  });
});