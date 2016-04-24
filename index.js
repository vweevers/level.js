'use strict';

module.exports = Level

var IDB = require('idb-wrapper')
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
var util = require('util')
var isTyped = require('is-typedarray').strict
var xtend = require('xtend')
var toBuffer = require('./util').toBuffer
var Iterator = require('./iterator')

function Level(location) {
  if (!(this instanceof Level)) return new Level(location)
  if (!location) throw new Error("constructor requires at least a location argument")
  if (typeof location !== 'string') throw new Error('constructor requires a location string argument')
  this.IDBOptions = {}
  this.location = location
}

util.inherits(Level, AbstractLevelDOWN)

Level.prototype._open = function(options, callback) {
  var self = this

  var idbOpts = {
    storeName: this.location,
    autoIncrement: false,
    keyPath: null,
    onStoreReady: function () {
      callback && callback(null, self.idb)
    },
    onError: function(err) {
      callback && callback(err)
    }
  }

  xtend(idbOpts, options)
  this.IDBOptions = idbOpts
  this.idb = new IDB(idbOpts)
}

Level.prototype._get = function (key, options, callback) {
  var self = this
  this.idb.get(key, function (value) {
    if (value === undefined) {
      // 'NotFound' error, consistent with LevelDOWN API
      return callback(new Error('NotFound'))
    }

    callback(null, options.asBuffer ? toBuffer(value) : value)
  }, callback)
}

Level.prototype._del = function(key, options, callback) {
  this.idb.remove(key, callback, callback)
}

Level.prototype._put = function (key, value, options, callback) {
  this.idb.put(key, value, function() { callback() }, callback)
}

// Valid types in IndexedDB Second Edition:
//
// - Number, except NaN. Includes Infinity and -Infinity
// - Date, except invalid (NaN)
// - String
// - ArrayBuffer or a view thereof (typed arrays)
// - Array, except cyclical and empty (e.g. Array(10)). Elements must be valid
//   types themselves.
Level.prototype._serializeKey = function (key) {
  if (typeof key === 'string')
    return key

  if (typeof key === 'number' || key instanceof Date)
    return isNaN(key) ? String(key) : key

  if (key instanceof ArrayBuffer || this._isBuffer(key) || isTyped(key))
    return key

  if (Array.isArray(key))
    return key

  return String(key)
}

Level.prototype._serializeValue = function (value) {
  return value == null ? '' : value
}

Level.prototype._iterator = function (options) {
  return new Iterator(this.idb, options)
}

Level.prototype._batch = function (ops, options, callback) {
  if (ops.length === 0) return setImmediate(callback)

  var copies = Array(ops.length)

  for (var i = 0; i < ops.length; i++) {
    var op = ops[i]
    var copy = copies[i] = { key: this._serializeKey(op.key) }

    if (op.type === 'del') {
      copy.type = 'remove'
    } else {
      copy.type = 'put'
      copy.value = this._serializeValue(op.value)
    }
  }

  return this.idb.batch(copies, function(){ callback() }, callback)
}

Level.prototype._close = function (callback) {
  this.idb.db.close()
  setImmediate(callback)
}

Level.prototype._approximateSize = function (start, end, callback) {
  var err = new Error('Not implemented')
  if (callback)
    return callback(err)

  throw err
}

Level.destroy = function (db, options, callback) {
  if (typeof options === 'function') callback = options, options = {}
  else if (!options) options = {}

  if (typeof db === 'object') {
    var prefix = (db.IDBOptions && db.IDBOptions.storePrefix) || 'IDBWrapper-'
    var dbname = db.location
  } else {
    var prefix = 'IDBWrapper-'
    var dbname = db
  }

  var request = indexedDB.deleteDatabase(prefix + dbname)

  var called = 0
  var cb = function (err) {
    if (!called++) callback(err)
  }

  request.onsuccess = function() {
    cb()
  }

  request.onerror = function(err) {
    cb(err)
  }

  request.onblocked = function() {
    // Wait a max amount of time
    if (options.wait !== undefined) {
      setTimeout(function() {
        if (!called) cb(new Error('Delete request blocked'))
      }, options.wait)
    }
  }
}

AbstractLevelDOWN.prototype._checkKey = function (obj, type) {
  if (obj === null || obj === undefined) {
    return new Error(type + ' cannot be `null` or `undefined`')
  } else if (this._isBuffer(obj)) {
    if (obj.length === 0) return new Error(type + ' cannot be an empty Buffer')
  } else if (obj instanceof ArrayBuffer) {
    if (obj.byteLength === 0) return new Error(type + ' cannot be an empty ArrayBuffer')
  } else if (isTyped(obj)) {
    if (obj.byteLength === 0) return new Error(type + ' cannot be an empty TypedArray')
  } else if (obj.length === 0) {
    return new Error(type + ' cannot be an empty String')
  }
}
