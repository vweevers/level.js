module.exports = Level

var IDB = require('idb-wrapper')
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN
var util = require('util')
var Iterator = require('./iterator')
var isBuffer = require('isbuffer')
var xtend = require('xtend')
var toBuffer = require('typedarray-to-buffer')
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

    if (options.asBuffer) {
      value = isTyped(value) ? toBuffer(value) : Buffer(String(value))
    }

    return callback(null, value)
  }, callback)
}

Level.prototype._del = function(key, options, callback) {
  this.idb.remove(key, callback, callback)
}

Level.prototype._put = function (key, value, options, callback) {
  this.idb.put(key, value, function() { callback() }, callback)
}

Level.prototype._serializeKey = function (key) {
  if (this._isBuffer(key)) return key
  else if (key instanceof ArrayBuffer) return Buffer(key)
  else if (key instanceof Uint8Array) return key
  else return String(key)
}

Level.prototype._serializeValue = function (value) {
  if (value === null || value === undefined) return ''
  if (this._isBuffer(value)) return value
  else if (value instanceof ArrayBuffer) return Buffer(value)
  else if (value instanceof Uint8Array) return value
  else return value
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

var checkKeyValue = Level.prototype._checkKeyValue = function (obj, type) {
  if (obj === null || obj === undefined)
    return new Error(type + ' cannot be `null` or `undefined`')
  if (obj === null || obj === undefined)
    return new Error(type + ' cannot be `null` or `undefined`')
  if (isBuffer(obj) && obj.byteLength === 0)
    return new Error(type + ' cannot be an empty ArrayBuffer')
  if (String(obj) === '')
    return new Error(type + ' cannot be an empty String')
  if (obj.length === 0)
    return new Error(type + ' cannot be an empty Array')
}
