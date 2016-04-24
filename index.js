module.exports = Level

var IDB = require('idb-wrapper')
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
var util = require('util')
var Iterator = require('./iterator')
var isBuffer = require('isbuffer')
var xtend = require('xtend')
var toBuffer = require('./util').toBuffer
var isTyped = require('is-typedarray').strict

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

Level.prototype._batch = function (array, options, callback) {
  var op
  var i
  var k
  var copiedOp
  var currentOp
  var modified = Array(array.length)

  if (array.length === 0) return setTimeout(callback, 0)

  for (i = 0; i < array.length; i++) {
    currentOp = array[i]
    modified[i] = copiedOp = { key: this._serializeKey(currentOp.key) }

    if (currentOp.type === 'del') {
      copiedOp.type = 'remove'
    } else {
      copiedOp.type = 'put'
      copiedOp.value = this._serializeValue(currentOp.value)
    }
  }

  return this.idb.batch(modified, function(){ callback() }, callback)
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

Level.destroy = function (db, callback) {
  if (typeof db === 'object') {
    var prefix = (db.IDBOptions && db.IDBOptions.storePrefix) || 'IDBWrapper-'
    var dbname = db.location
  } else {
    var prefix = 'IDBWrapper-'
    var dbname = db
  }

  var request = indexedDB.deleteDatabase(prefix + dbname)

  var called = 0
  var cb = function(err) {
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
    setTimeout(function() {
      if (!called) cb(new Error('Delete request blocked'))
    }, 500)
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
