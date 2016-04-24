'use strict';

var typedToBuffer = require('typedarray-to-buffer')
var isTyped = require('is-typedarray').strict

exports.toBuffer = function(value) {
  return value instanceof ArrayBuffer ? Buffer(value)
    : isTyped(value) ? typedToBuffer(value)
    : Buffer(String(value))
}
