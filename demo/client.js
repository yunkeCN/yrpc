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
    return '127.0.0.1:50051';
  },
  inspect: true
});

rpc.echo({text: 'xxxx'}, {username: 'xxxxx'}).then(res => {
  console.log(res);
}).catch(err => {
  console.error(err);
});
