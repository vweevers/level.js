var levelup = require('levelup')

module.exports.all = function(leveljs, tape, testCommon) {
  module.exports.setUp(leveljs, tape, testCommon)
  module.exports.custom(leveljs, tape, testCommon)
  module.exports.tearDown(tape, testCommon)
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

module.exports.custom = function(leveljs, tape, testCommon) {
  tape('levelup JSON encoding', function (t) {
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

  tape('levelup id encoding', function (t) {
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

  // NOTE: in chrome (at least) indexeddb gets buggy if you try and destroy a db,
  // then create it again, then try and destroy it again. these avoid doing that

  tape('test levelup .destroy w/ string', function(t) {
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

  tape('test levelup .destroy w/ db instance', function(t) {
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
