
var
  util   = require("util"),
  events = require("events"),
  _      = require("underscore")

module.exports = Test;

function Test(eval, options) {

    var defaults = {context: null, listen: null, duration : 0, maxDuration: 0, freshNew: false}

    this.options = options || {};

    _.defaults(this.options, defaults)

    this.evalFn        = eval
    this.pass        = false
    this._passSince  = 0

    events.EventEmitter.call(this)

    this._init();
}

util.inherits(Test, events.EventEmitter)

Test.prototype._init = function() {

    var that = this

    this.on('evalpass', function() {

      var now = +new Date(), newPass = that._passSince <= 0;

      if (newPass) {
        that._passSince = now
      }

      if (that.options.duration <= 0) {
        that._pass(true)
        return
      }

      if (!newPass) {
        return
      }

      if (that.options.duration > 0) {
        var timer1 = setTimeout(function() {

          that.removeListener('evalfail', listener1)
          that._pass(true);

          if (that.options.maxDuration > 0) {

            var timer2 = setTimeout(function() {
              that.removeListener('evalfail', listener2)
              that._pass(false)
            }, that.options.maxDuration - that.options.duration);

            var listener2 = function() {
              that._pass(false)
              clearTimeout(timer2)
            };

            that.once('evalfail', listener2)

          }
        }, that.options.duration)

        var listener1 = function() {
          that._pass(false)
          clearTimeout(timer1)
        }

        that.once('evalfail', listener1)
      }

    })

    this.on('evalfail', function() {
      that._passSince = 0;
      if (that.options.duration <= 0) {
        that._pass(false)
      }
    })

    if (!this.options.freshNew) {
      this.eval()
    }

    this.options.context.on(this.options.listen, _.bind(this.eval, this))

}
/*
Test.prototype._onContextChange = function() {
  this.options.context.removeListener(this.options.listen, this.eval)
}*/

Test.prototype.stop = function() {
  this.options.context.removeListener(this.options.listen, _.bind(this.eval, this))
}

Test.prototype.eval = function() {

  if (this.evalFn.apply(this.options.context)) {
    this.emit('evalpass')
  } else {
    this.emit('evalfail')
  }

}

Test.prototype._pass = function(pass) {

  if (this.pass === pass) {
    return
  }

  this.pass = pass;

  if (pass) {
    this.emit('pass')
  } else {
    this.emit('fail')
  }

}