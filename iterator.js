// Wish it was a CommonJS ponyfill
require('setimmediate')

var util = require('util')
var AbstractIterator  = require('abstract-leveldown').AbstractIterator
var ltgt = require('ltgt')
var toBuffer = require('typedarray-to-buffer')
var isTyped = require('is-typedarray').strict

module.exports = Iterator

function Iterator (db, options) {
  this.callback = null
  this.cache    = []
  this.finished = false

  this.options = options
  this.keyAsBuffer = options.keyAsBuffer
  this.valueAsBuffer = options.valueAsBuffer

  AbstractIterator.call(this, db)

  this._order = options.reverse ? 'DESC': 'ASC'
  this._limit = options.limit

  if (this._limit === 0) {
    this._empty = true
  } else {
    var lower = ltgt.lowerBound(options)
    var upper = ltgt.upperBound(options)

    try {
      this._keyRange = lower || upper ? this.db.makeKeyRange({
        lower: lower,
        upper: upper,
        excludeLower: ltgt.lowerBoundExclusive(options),
        excludeUpper: ltgt.upperBoundExclusive(options)
      }) : null
    } catch (e) {
      // The lower key is greater than the upper key.
      // IndexedDB throws an error, but we'll just return 0 results.
      this._empty = true
    }
  }

  if (!this._empty) this.createIterator()
}

util.inherits(Iterator, AbstractIterator)

Iterator.prototype.createIterator = function() {
  var self = this

  self.transaction = self.db.iterate(function () {
    self.onItem.apply(self, arguments)
  }, {
    keyRange: self._keyRange,
    autoContinue: true,
    order: self._order,
    limit: self._limit && self._limit > 0 ? self._limit : Infinity,
    onError: function(event) {
      if (event) {
        var err = new Error((''+self.transaction.error) || 'Unknown error')
        var cb = self.callback

        self.callback = null

        if (cb) cb(err)
        else if (!self.finished) self._error = err
      } else {
        self.finished = true // Called on completion
      }
    }
  })
}

Iterator.prototype.onItem = function (value, cursor) {
  if (cursor && this.cache) this.cache.push(value, cursor.key)
  else this.finished = true

  if (this.callback) {
    var cb = this.callback
    this.callback = null
    this._next(cb)
  }
}

Iterator.prototype._next = function (callback) {
  if (this._empty) {
    setImmediate(callback)
  } else if (this._error) {
    var err = this._error

    setImmediate(function () {
      callback(err)
    })

    this._error = null
  } else if (this.cache && this.cache.length) {
    var value = this.cache.shift()
    var key   = this.cache.shift()

    if (this.keyAsBuffer)
      key = isTyped(key) ? toBuffer(key) : Buffer(String(key))
    if (this.valueAsBuffer)
      value = isTyped(value) ? toBuffer(value) : Buffer(String(value))

    setImmediate(function () {
      callback(null, key, value)
    })
  } else if (this.finished) {
    setImmediate(callback)
  } else {
    this.callback = callback
  }
}

Iterator.prototype._end = function (callback) {
  var err = this._error

  this.finished = true
  this.cache = this.callback = this._error = null

  setImmediate(function () {
    callback(err)
  })
}
