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
      this._writeSync = function(label, text) {

      this.output.push(label + ':' + text);
      return this;
    });
    // And asynchronous methods
    this.write = this.async(
      this._write = function(label, text, next) {
      process.nextTick(function () {
        self._writeSync(label, text);
        next();
      });
      return this;
    });
    // An async method that calls another
    this.writeToken = this.async(
      this._writeToken = function(label, text, next) {

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
      .then(function() {
        expect(api.output).to.deep.equal(['fou:foo', 'barre:bar', 'base:baz']);
        done();
      });
  });

  it('executes asynchronous continuations in order', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .then(function(next) {
        api.output.push('bar');
        next();
      })
      .then(function(next) {
        api.output.push('baz');
        next();
      })
      .then(function() {
        expect(api.output).to.deep.equal(['fou:foo', 'bar', 'baz']);
        done();
      });
  });

  it('can nest async calls', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .then(function(next) {
        api
          .writeSync('barre', 'bar')
          .write('base', 'baz')
          .then(function() {
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
      .finally(function() {
        api
          .write('barre', 'bar')
          .then(function(next) {
            expect(api.output).to.deep.equal(['fou:foo', 'barre:bar']);
            next();
          })
          .finally(function() {
            api.finally(done);
          });
      });
  });

  it('lets asynchronous methods call other asynchronous methods', function(done) {
    var api = new Api();

    api
      .write('fou', 'foo')
      .writeToken('barre', 'bar')
      .writeToken('base', 'baz')
      .write('donne', 'done')
      .then(function() {
        expect(api.output).to.deep.equal(['fou:foo', 'barre:[bar]', 'base:[baz]', 'donne:done']);
        done();
      })
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