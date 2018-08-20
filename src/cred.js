/**
 * credentials
 */
const path = require('path');
const fs = require('fs');
const grpc = require('grpc');

const files = {};
let cred;

module.exports = function createCred(ssl) {
  const {ca, cert, key, cred: hostCred, root} = ssl;
  if (hostCred) {
    return hostCred;
  }
  if (!ca && cred) {
    return ssl.cred = cred;
  }
  if (ca) {
    ssl.cred = grpc.credentials.createSsl(
      /* RootCert     */ readFile(ca, root),
      /* ChainCertKey */ key ? readFile(key, root) : undefined,
      /* ChainCert    */ cert ? readFile(cert, root) : undefined
    );
  } else {
    ssl.cred = cred = grpc.credentials.createInsecure();
  }
  return ssl.cred;
}

function readFile(filepath, root) {
  if (filepath in files) {
    return files[filepath];
  } else if (filepath) {
    return files[filepath] = fs.readFileSync(root ? path.join(root, filepath) : filepath);
  }
}