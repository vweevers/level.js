var levelup = require('levelup')

module.exports.all = function(leveljs, test, testCommon) {
  module.exports.setUp(leveljs, test, testCommon)
  module.exports.custom(leveljs, test, testCommon)
  module.exports.tearDown(test, testCommon)
}

module.exports.setUp = function (leveldown, test, testCommon) {
  test('setUp common', testCommon.setUp)
  test('setUp db', function (t) {
    db = leveldown(testCommon.location())
    db.open(t.end.bind(t))
  })
}

module.exports.tearDown = function (test, testCommon) {
  test('tearDown', function (t) {
    db.close(testCommon.tearDown.bind(null, t))
  })
}

module.exports.custom = function(leveljs, test, testCommon) {
  test('put Uint8Array value', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function() {
      db.put('key', new Uint8Array([21,31]), function (err) {
        t.ifError(err, 'no put error')

        db.get('key', function (err, value) {
          t.ifError(err, 'no get error')
          t.ok(value instanceof Buffer, 'is Buffer')
          t.ok(value instanceof Uint8Array, 'Buffer is a Uint8Array')
          t.same(value, new Buffer([21,31]))

          db.get('key', { asBuffer: false }, function (err, value) {
            t.ifError(err, 'no get error')
            t.ok(value instanceof Uint8Array, 'is Uint8Array')
            t.notOk(value instanceof Buffer, 'is not a Buffer')
            t.same(value, new Uint8Array([21,31]))

            db.close(t.end.bind(t))
          })
        })
      })
    })
  })

  test('put Buffer value', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function() {
      db.put('key', Buffer('foo'), function (err) {
        t.ifError(err, 'no put error')

        db.get('key', function (err, value) {
          t.ifError(err, 'no get error')
          t.ok(value instanceof Buffer, 'is Buffer')
          t.same(value, Buffer('foo'))

          db.get('key', { asBuffer: false }, function (err, value) {
            t.ifError(err, 'no get error')
            t.ok(value instanceof Uint8Array, 'is a Uint8Array')
            t.notOk(value instanceof Buffer, 'is not a Buffer')
            t.same(Buffer(value), Buffer('foo'))

            db.close(t.end.bind(t))
          })
        })
      })
    })
  })

  test('put ArrayBuffer value', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function() {
      db.put('key', new Uint8Array([21,31]).buffer, function (err) {
        t.ifError(err, 'no put error')

        db.get('key', function (err, value) {
          t.ifError(err, 'no get error')
          t.ok(value instanceof Buffer, 'is Buffer')
          t.same(value, Buffer([21,31]))

          db.get('key', { asBuffer: false }, function (err, value) {
            t.ifError(err, 'no get error')
            t.ok(value instanceof ArrayBuffer, 'is a ArrayBuffer')
            t.same(value, new Uint8Array([21,31]).buffer)

            db.close(t.end.bind(t))
          })
        })
      })
    })
  })

  test('put ArrayBuffer value (levelup)', function (t) {
    var db = levelup(testCommon.location(), { db: leveljs, valueEncoding: 'id' })

    db.put('key', new Uint8Array([21,31]).buffer, function (err) {
      t.ifError(err, 'no put error')

      db.get('key', { valueEncoding: 'binary' }, function (err, value) {
        t.ifError(err, 'no get error')
        t.ok(value instanceof Buffer, 'is Buffer')
        t.same(value, new Buffer([21,31]))

        db.get('key', function (err, value) {
          t.ifError(err, 'no get error')
          t.ok(value instanceof ArrayBuffer, 'is a ArrayBuffer')
          t.same(value, new Uint8Array([21,31]).buffer)

          db.close(t.end.bind(t))
        })
      })
    })
  })

  test('put ArrayBuffer into binary levelup', function (t) {
    var db = levelup(testCommon.location(), { db: leveljs, valueEncoding: 'binary' })

    db.put('key', new Uint8Array([1,2]).buffer, function (err) {
      t.ifError(err, 'no put error')

      db.get('key', function (err, value) {
        t.ifError(err, 'no get error')
        t.ok(value instanceof Buffer, 'is Buffer')
        t.same(value, new Buffer([1,2]))

        db.get('key', { valueEncoding: 'id' }, function (err, value) {
          t.ifError(err, 'no get error')
          t.ok(value instanceof Uint8Array, 'is a Uint8Array')
          t.same(value, new Uint8Array([1,2]))

          db.close(t.end.bind(t))
        })
      })
    })
  })

  test('put Uint8Array into binary levelup', function (t) {
    var db = levelup(testCommon.location(), { db: leveljs, valueEncoding: 'binary' })

    // This is dumb, because level-codec will copy the buffer
    // doing Buffer(uint8arr). But it works
    db.put('key', new Uint8Array([1,2]), function (err) {
      t.ifError(err, 'no put error')

      db.get('key', function (err, value) {
        t.ifError(err, 'no get error')
        t.ok(value instanceof Buffer, 'is Buffer')
        t.same(value, new Buffer([1,2]))

        db.get('key', { valueEncoding: 'id' }, function (err, value) {
          t.ifError(err, 'no get error')

          t.ok(value instanceof Uint8Array, 'is a Uint8Array')
          t.same(value, new Uint8Array([1,2]))

          db.close(t.end.bind(t))
        })
      })
    })
  })

  test('levelup JSON encoding', function (t) {
    var level = levelup(testCommon.location(), { db: leveljs, valueEncoding: 'json' })

    level.put('key', { a: 2 }, function (err) {
      t.notOk(err, 'no put error')

      level.get('key', function(err, value) {
        t.notOk(err, 'no get error')
        t.same(value, { a: 2 }, 'is object')

        level.get('key', { valueEncoding: 'binary' }, function(err, value) {
          t.notOk(err, 'no get error')
          t.same(value, Buffer(JSON.stringify({ a: 2 })), 'is JSON buffer')

          level.get('key', { valueEncoding: 'utf8' }, function(err, value) {
            t.notOk(err, 'no get error')
            t.same(value, JSON.stringify({ a: 2 }), 'is JSON string')
            t.end()
          })
        })
      })
    })
  })

  test('levelup id encoding', function (t) {
    var level = levelup(testCommon.location(), { db: leveljs, valueEncoding: 'id' })

    level.put('key', { a: 2 }, function (err) {
      t.notOk(err, 'no put error')

      level.get('key', function(err, value) {
        t.notOk(err, 'no get error')
        t.same(value, { a: 2 }, 'is object')
        t.end()
      })
    })
  })

  test('put object key', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function() {
      db.put({a: 2}, 'value', function (err) {
        t.ifError(err, 'no put error')

        db.get(String({}), { asBuffer: false }, function (err, value) {
          t.ifError(err, 'no get error')
          t.is(value, 'value')
          db.close(t.end.bind(t))
        })
      })
    })
  })

  test('put Infinity key', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function () {
      db.put(Infinity, 'value', function (err) {
        t.ifError(err, 'no put error')

        db.get(Infinity, { asBuffer: false }, function (err, value) {
          t.ifError(err, 'no get error')
          t.is(value, 'value')

          db.get(-Infinity, { asBuffer: false }, function (err, value) {
            t.ok(err, 'not found')
            t.is(value, undefined)
            db.close(t.end.bind(t))
          })
        })
      })
    })
  })

  test('put date key', function (t) {
    var db = leveljs(testCommon.location())
    var date = '2016-04-24T15:30:04.689Z'

    db.open(function () {
      db.put(new Date(date), 'value', function (err) {
        t.ifError(err, 'no put error')

        db.get(new Date(date), { asBuffer: false }, function (err, value) {
          t.ifError(err, 'no get error')
          t.is(value, 'value')

          // Test that it's not stored as a string
          db.get(String(new Date(date)), { asBuffer: false }, function (err, value) {
            t.ok(err, 'not found')
            t.is(value, undefined)

            db.close(t.end.bind(t))
          })
        })
      })
    })
  })

  test('put invalid date key', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function () {
      db.put(new Date('foo'), 'value', function (err) {
        t.ifError(err, 'no put error')

        db.get('Invalid Date', { asBuffer: false }, function (err, value) {
          t.ifError(err, 'no get error')
          t.is(value, 'value')

          db.close(t.end.bind(t))
        })
      })
    })
  })

  test('put array key', function (t) {
    var db = leveljs(testCommon.location())

    db.open(function () {
      db.put(['a', 1], 'value', function (err) {
        t.ifError(err, 'no put error')

        db.get(['a', 1], { asBuffer: false }, function (err, value) {
          t.ifError(err, 'no get error')
          t.is(value, 'value')

          db.get(['a', 2], { asBuffer: false }, function (err, value) {
            t.ok(err, 'not found')
            t.is(value, undefined)
            db.close(t.end.bind(t))
          })
        })
      })
    })
  })

  // NOTE: in chrome (at least) indexeddb gets buggy if you try and destroy a db,
  // then create it again, then try and destroy it again. these avoid doing that

  test('test levelup .destroy w/ string', function(t) {
    var level = levelup('destroy-test', {db: leveljs})
    level.put('key', 'value', function (err) {
      t.notOk(err, 'no error')
      level.get('key', function (err, value) {
        t.notOk(err, 'no error')
        t.equal(value, 'value', 'should have value')
        level.close(function (err) {
          t.notOk(err, 'no error')
          leveljs.destroy('destroy-test', function (err) {
            t.notOk(err, 'no error')
            var level2 = levelup('destroy-test', {db: leveljs})
            level2.get('key', function (err, value) {
              t.ok(err, 'key is not there')
              t.end()
            })
          })
        })
      })
    })
  })

  test('test levelup .destroy w/ db instance', function(t) {
    var level = levelup('destroy-test-2', {db: leveljs})
    level.put('key', 'value', function (err) {
      t.notOk(err, 'no error')
      level.get('key', function (err, value) {
        t.notOk(err, 'no error')
        t.equal(value, 'value', 'should have value')
        level.close(function (err) {
          t.notOk(err, 'no error')
          leveljs.destroy(level.db, function (err) {
            t.notOk(err, 'no error')
            var level2 = levelup('destroy-test-2', {db: leveljs})
            level2.get('key', function (err, value) {
              t.ok(err, 'key is not there')
              t.end()
            })
          })
        })
      })
    })
  })

}
