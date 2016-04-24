// Wish it was a CommonJS ponyfill
require('setimmediate')

var util = require('util')
var AbstractIterator  = require('abstract-leveldown').AbstractIterator
var ltgt = require('ltgt')
var toBuffer = require('./util').toBuffer

module.exports = Iterator

function Iterator (db, options) {
  this._callback = null
  this._cache    = []
  this._finished = false
  this._keyAsBuffer = options.keyAsBuffer
  this._valueAsBuffer = options.valueAsBuffer

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

  if (!this._empty) this._openTransaction()
}

util.inherits(Iterator, AbstractIterator)

Iterator.prototype._openTransaction = function() {
  var self = this

  self.transaction = self.db.iterate(function () {
    self._onItem.apply(self, arguments)
  }, {
    keyRange: self._keyRange,
    autoContinue: true,
    order: self._order,
    limit: self._limit && self._limit > 0 ? self._limit : Infinity,
    onError: function(event) {
      if (event) {
        var err = new Error(''+self.transaction.error)
        var callback = self._callback

        self._callback = null

        if (callback) callback(err)
        else if (!self._finished) self._error = err
      } else {
        self._finished = true // Called on completion
      }
    }
  })
}

Iterator.prototype._onItem = function (value, cursor) {
  if (cursor && this._cache) this._cache.push(value, cursor.key)
  else this._finished = true

  if (this._callback) {
    this._next(this._callback)
    this._callback = null
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
  } else if (this._cache && this._cache.length) {
    var value = this._cache.shift()
    var key   = this._cache.shift()

    if (this._keyAsBuffer) key = toBuffer(key)
    if (this._valueAsBuffer) value = toBuffer(value)

    setImmediate(function () {
      callback(null, key, value)
    })
  } else if (this._finished) {
    setImmediate(callback)
  } else {
    this._callback = callback
  }
}

Iterator.prototype._end = function (callback) {
  var err = this._error
  this._cache = this._callback = this._error = null

  setImmediate(function () {
    callback(err)
  })
}
