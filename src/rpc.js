/**
 * RPC
 */
const path = require('path');
const fs = require('fs');
const grpc = require('grpc');
const {loadSync} = require('./loader');
const inspect = require('./inspect');
const createCred = require('./cred');
const metadata = require('./meta');
const {PROTO_ROOT_PATH, CERT_ROOT_PATH} = require('./const');

let HttpClient;

function rpc(files, {
  root = PROTO_ROOT_PATH,
  ssl,
  http,
  host = () => DEFAULT_HOST,
  inspect: needInspect
}) {
  const ssls = {};


  if (Object.prototype.toString.call(files) !== '[object Array]') {
    files = [files];
  }
  files = files
    .filter(f => !!(Object.prototype.toString.call(f) === '[object Object]' ? f.file : f))
    .map(f => {
      const filename = f.file || f;

      ssls[filename] = f.ssl || ssl;

      return filename;
    });


  const obj = grpc.loadPackageDefinition(loadSync(files, {
    keepCase: true,
    defaults: true,
    arrays: true,
    objects: true,
    includeDirs: root ? [root] : undefined
  }));


  const fns = {};
  for (let ns in obj) {
    rpc[ns] || (rpc[ns] = {});
    for (let srv in obj[ns]) {
      rpc[ns][srv] || (rpc[ns][srv] = {});
      const {service} = obj[ns][srv];
      for (let fn in service) {
        const {originalName: name} = service[fn];
        fns[name] || (fns[name] = new Set());
        fns[name].add(`${ns}.${srv}`);
      }
    }
  }
  for (let fn in fns) {
    defineFn(fn, Array.from(fns[fn]), {obj, http, ssls, host, root});
  }


  if (needInspect) {
    const desc = inspect(obj);
    Object.defineProperty(obj, 'desc', {
      enumerable: false,
      configurable: false,
      value: desc
    });
  }


  return obj;
}

module.exports = rpc;

function defineFn(name, list = [], opt = {}) {
  const options = {
    enumerable: false,
    configurable: false,
    get: () => () => Promise.reject(new Error(`${name} is not assigned`)),
    set: () => {throw new Error(`${name} is not assignable`);}
  };

  Object.defineProperty(rpc, name, {...options, get: () => {
    if (list.length < 1) {
      return () => Promise.reject(new Error(`rpc func ${name} is not exist`));
    } else if (list.length > 1) {
      return () => Promise.reject(new Error(`rpc func ${name} exist in:\n  ${list.join('\n  ')}`));
    }
    const client = instClient(list[0], {name, ...opt});
    return (...args) => new Promise((resolve, reject) => {
      args[1] && (args[1] = metadata(args[1]));
      client[name](...args, (err, res) => err ? reject(err) : resolve(res));
    });
  }});

  list.forEach(path => {
    const [ns, srv] = path.split('.');
    Object.defineProperty(rpc[ns][srv], name, {...options, get: () => {
      const client = instClient(path, {name, ...opt});
      return (...args) => new Promise((resolve, reject) => {
        args[1] && (args[1] = metadata(args[1]));
        client[name](...args, (err, res) => err ? reject(err) : resolve(res));
      });
    }});
  });
}

function instClient(p, {root, http, obj, host, ssls}) {
  const [ns, srv] = p.split('.');
  const Service = obj[ns][srv];
  if (Service.client) {
    return Service.client;
  }
  if (!http) {
    // over rpc
    const file = path.relative(root, Service.service.filename);
    const {remote} = host({path: p, file});
    const ssl = ssls[file];
    Service.client = new Service(remote, createCred(ssl));
    return Service.client;
  } else {
    // over http
    const file = path.relative(root, Service.service.filename);
    const {host: hostname, port, prefix} = host({path: p, file});
    const ssl = ssls[file];
    HttpClient || (HttpClient = require('./http'));
    Service.client = new HttpClient(Service.service, {
      host: hostname,
      port,
      prefix,
      ssl
    });
    return Service.client;
  }
}