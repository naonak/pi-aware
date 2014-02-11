
/*

@TODO

- Test ne fonctionne qu'avec les événements, il faudrait qu'il puisse fonctionner
- Les tests après THEN sont instanciés seulement après le succès des tests precedents, une option pour les instanciés au new Condition ?
- cascader les conditions
- accepter un test déja instancié comme argument de and, or, etc

new Condition()
    .test('rdc-chambre.contact-1.state').eq('on').during('3 seconds')
    .and()
    .test('rdc-chambre.contact-1.state').eq('on').during('3 seconds')

var condition1 = new Condition()
    .then('rdc-garage.contact-1.state').eq('on')
    .then('rdc-cellier.contact-2.state').eq('on')

condition1.start()
condition1.on('occur', function() {

})

var condition2 = new Condition()
    .then('rdc-garage.contlightact-1.state').eq('on').during('3 seconds')
    .and('rdc-cellier.contact-2.state').eq('on')

var condition2 = new Condition()
    .then('rdc-switch.state').eq('on').during(50, 300)
    .then('rdc-switch.state').eq('off').during(50, 300)
    .then('rdc-switch.state').eq('on').during(50, 300)

*/

var
  util   = require("util"),
  events = require("events"),
  _      = require("underscore")

module.exports = Condition;

function Condition(options) {

  this.tests = []

  events.EventEmitter.call(this)

  var that = this;

  this.on('success', function() {
    that.stop()
  })

  this.on('fail', function() {
    that.stop()
  })

}

util.inherits(Condition, events.EventEmitter)

Condition.prototype._start = function(configs) {

  var
    that = this,
    y = 0,
    i,
    nextTests,
    delay,
    testConf,
    groups = [{tests: [], options: {}}],
    newTest = function (args) {
      function F() {
        return Test.apply(this, args)
      }
      F.prototype = Test.prototype
      return new F()
    }

  for (i = 0; i < configs.length; i++) {
    testConf = configs[i]

    if (testConf.operator === 'wait') {
      delay = testConf.time
      nextTests = configs.slice(i + 1)
      break;
    }

    if (testConf.operator === 'timeout') {
      groups[y].options.timeout = testConf.time
      continue
    }

    if (testConf.operator === 'then') {
      nextTests = configs.slice(i)
      configs[0].operator = null
      break;
    }

    if (testConf.operator === 'or') {
      y++
      groups[y] = {tests: [], options: {}}
    }

    groups[y].tests.push(newTest(testConf.args))
  }

  var deleteGroups = function() {
    delete groups
  }

  that.once('stop', deleteGroups)

  _.each(groups, function(group, y) {
      that._check(group, nextTests, delay, function() {})
  })

}

Condition.prototype._check = function(group, nextTests, delay, callback) {

  var
    test,
    timerTimeout,
    timerDelay,
    checkAgain,
    that = this,
    result = true

  if (!group.initialized) {

    group.initialized = true

    checkAgain = function() {
      that._check(group, nextTests, delay, callback)
    }

    for (i = 0; i < group.tests.length; i++) {
      group.tests[i].on('pass', checkAgain)
    }
/*
    that.once('stop', function() {
      for (i = 0; i < group.tests.length; i++) {
        group.tests[i].removeListener('pass', checkAgain)
      }
    })
*/
  }

  if (group.options.timeout) {
    timerTimeout = setTimeout(function() {
      that.emit('fail')
    }, group.options.timeout)
  }

  for (i = 0; i < group.tests.length; i++) {
    test = group.tests[i]
    if (!test.pass) {
      result = false
      break
    }
  }

  if (!result) {
    return
  }

  if (timerTimeout) {
    clearTimeout(timerTimeout)
  }

  callback();

  for (i = 0; i < group.tests.length; i++) {
    test = group.tests[i]
    test.stop()
  }

  if (!nextTests) {
    that.emit('success')
    return
  }

  if (delay) {

    timerDelay = setTimeout(function() {
      that._start(nextTests)
    }, delay)

    that.once('stop', function() {
      clearTimeout(timerDelay)
    })

    return

  }

 that._start(nextTests)

}

Condition.prototype.test = function(eval, options) {
  var args = Array.prototype.slice.call(arguments)
  this.tests.push({args: args, operator: 'and'})
  return this
}

Condition.prototype.and = function(eval, options) {
  var args = Array.prototype.slice.call(arguments)
  this.tests.push({args: args, operator: 'and'})
  return this
}

Condition.prototype.or = function(eval, options) {
  var args = Array.prototype.slice.call(arguments)
  this.tests.push({args: args, operator: 'or'})
  return this
}

Condition.prototype.then = function(eval, options) {
  var args = Array.prototype.slice.call(arguments)
  this.tests.push({args: args, operator: 'then'})
  return this
}

Condition.prototype.wait = function(time) {
  this.tests.push({time: time, operator: 'wait'})
  return this
}

Condition.prototype.timeout = function(time) {
  this.tests.push({time: time, operator: 'timeout'})
  return this
}
/*
Condition.prototype.on = function() {
  var args = Array.prototype.slice.call(arguments)
  Condition.super_.prototype.on.apply(this, args)
  this.start()
}
*/
Condition.prototype.start = function() {

  if (this.listen) {
    return
  }

  this.listen = true

  this._start(this.tests)

}

Condition.prototype.restart = function() {
  this.stop()
  this.start()
}

Condition.prototype.stop = function() {
  this.emit('stop')
  this.listen = false
}
