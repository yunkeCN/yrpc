const rpc = require('./rpc');

Object.defineProperty(rpc, 'server', {
  enumerable: false,
  configurable: false,
  get: () => require('./server'),
  set: () => {}
});

module.exports = rpc;