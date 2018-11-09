const path = require('path');
const rpc = require('../');

rpc([
  'demo/base.proto'
], {
  root: path.join(__dirname, 'proto'),
  ssl: {
    root: path.join(__dirname, 'pki'),
    ca: 'ca.pem'
  },
  host: ({file}) => {
    const serviceName = (file.split('/').find(dir => /panther_[\w\W]+_proto/.test(dir)) || '')
      .replace(/_proto$/, '')
      .replace(/_/g, '-');
    return {
      remote: '127.0.0.1:50051',
      host: 'localhost',
      port: 80,
      prefix: '/demo'
    };
  },
  inspect: true,
  loader: {
    longs: String
  }
});

rpc.echo({text: 'xxxx'}, {username: 'xxxxx'}).then(res => {
  console.log(res);
}).catch(err => {
  console.error(err);
});

rpc.add({num: [1,2,3]}).then(res => {
  console.log(res);
});