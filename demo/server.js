/**
 * 远程模块
 */
const path = require('path');
const rpc = require('../');

const proto = rpc.server([
  {
    file: 'demo/base.proto',
    hook: {
      echo: ({request: req, metadata: meta}, cb) => {
        const username = meta.get('username')[0];
        cb(null, req);
      }
    }
  }
], {
  root: path.join(__dirname, 'proto'),
  ssl: {
    root: path.join(__dirname, 'pki'),
    ca: 'ca.pem',
    chain: [
      {
        cert: 'server.pem',
        key: 'server-key.pem'
      }
    ],
    check: false
  },
  port: {
    http: 50052,
    rpc: 50051
  }
});
