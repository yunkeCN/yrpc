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
      },
      add: ({request: req}, cb) => {
        const ret = (req.num || []).reduce((sum, it) => sum + parseInt(it), 0);
        cb(null, {num: ret});
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
  /**
   * port 为数字或字符串时 同 port: {rpc: 50051}
   * http 或 rpc 不存在时，不启动对应的服务器
   */
  port: {
    http: 50052,
    rpc: 50051
  },
  inspect: true,
  loader: {
    longs: String,
    includeDirs: ['/home/nil']
  }
});

console.log(proto);