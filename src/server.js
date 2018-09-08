/**
 * rpc server
 */
const path = require('path');
const fs = require('fs');
const grpc = require('grpc');
const http = require('http');
const https = require('https');
const Koa = require('koa');
const Router = require('koa-router');
const bodyparser = require('koa-body');
const {loadSync} = require('./loader');
const meta = require('./meta');

module.exports = (files, {root = PROTO_ROOT_PATH, ssl, port = {rpc: 50051, http: 50052}}) => {
  const ssls = {};
  const ports = {};
  const hooks = {};


  if (Object.prototype.toString.call(files) !== '[object Array]') {
    files = [files];
  }
  files = files
    .filter(f => !!(Object.prototype.toString.call(f) === '[object Object]' ? f.file : f))
    .map(f => {
      const filename = f.file || f;

      ssls[filename] = f.ssl || ssl;
      ports[filename] = f.port || port;
      hooks[filename] = f.hook || {};

      return filename;
    });


  const obj = grpc.loadPackageDefinition(loadSync(files, {
    keepCase: true,
    defaults: true,
    arrays: true,
    objects: true,
    includeDirs: root ? [root] : undefined
  }));


  const servers = {};
  for (let ns in obj) {
    for (let srv in obj[ns]) {
      const {service} = obj[ns][srv];
      const file = path.relative(root, service.filename);
      const ssl = ssls[file];
      const port = ports[file];
      const host = `0.0.0.0:${port.rpc}`;
      const {map} = servers[host] || (servers[host] = {
        ssl,
        port,
        map: {}
      });
      map[file] = {
        service,
        hook: hooks[file]
      };
    }
  }


  for (let host in servers) {
    const {map, ssl, port} = servers[host];
    const server = new grpc.Server();
    const hookSet = {};
    for (let f in map) {
      const {service, hook} = map[f];
      server.addService(service, hook);
      // 
      for (let fn in service) {
        const {originalName: name, options} = service[fn];
        hookSet[name] = hook[name] || (({request: req}, cb) => cb(new Error(`func ${name} is not added`)));
        hookSet[name].options = options;
      }
    }
    server.bind(host, createCred(ssl));
    server.start();
    console.log(`grpc server opened at 0.0.0.0:${port.rpc}`);
    // 
    httpServer({ssl, hook: hookSet, port: port.http}, () => {});
    console.log(`http server opened at 0.0.0.0:${port.http}`);
  }


  return obj;
}

// credentials
let cred;
function createCred(ssl = {}) {
  const {ca, chain = [], root, cred: hostCred, check} = ssl;
  if (hostCred) {
    return hostCred;
  }
  if (!ca && cred) {
    return ssl.cred = cred;
  }
  if (ca) {
    ssl.cred = grpc.ServerCredentials.createSsl(
      /* RootCert   */ readFile(ca, root),
      /* ChainCert  */ chain.map(({key, cert}) => ({
        private_key: readFile(key, root),
        cert_chain: readFile(cert, root)
      })),
      /* CheckClientCert */ !!check
    );
  } else {
    ssl.cred = cred = grpc.ServerCredentials.createInsecure();
  }
  return ssl.cred;
}
const files = {};
function readFile(filepath, root) {
  if (filepath in files) {
    return files[filepath];
  } else if (filepath) {
    return files[filepath] = fs.readFileSync(root ? path.join(root, filepath) : filepath);
  }
}

// rest
function httpServer({ssl, port, hook}, cb) {
  const app = new Koa();
  const router = new Router({prefix: undefined});
  const urls = {};

  for (let name in hook) {
    const fn = hook[name];
    const options = fn.options;
    const body = options['(google.api.http).body'] || options['(google.api.http).additional_bindings.body'];
    for (let rule in options) {
      let info = options[rule];
      rule = rule.replace(/\([\w\W]*?\)\.(additional_bindings\.)?/, '');
      if (/get|put|post|delete|patch/i.test(rule)) {
        if (info in urls) {
          console.warn(`reduplicative URL ${info}`);
        }
        urls[info] = true;
        const handler = async (ctx, next) => {
          const {request: {body: json}, query, headers} = ctx;
          const metadata = meta(headers);
          let request;
          if (/get/i.test(rule)) {
            request = query;
          } else {
            request = json;
          }
          ctx.body = await new Promise((resolve, reject) => {
            try {
              fn({request, metadata}, (err, res) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(res);
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        }
        const p = info.replace(/\{([\w\W]+?)\}/ig, (w, key) => `:${key}`);
        if (body) {
          router[rule](p, bodyparser({multipart: true}), handler);
        } else {
          router[rule](p, handler);
        }
      }
    }
  }

  router.get('*', (ctx, next) => {
    ctx.throw(400, `API：${ctx.url} not exist`);
  });

  app.use(router.routes()).use(router.allowedMethods());

  if (ssl) {
    const {chain, root} = ssl;
    const {key, cert} = chain[0];
    https.createServer({
      key: readFile(key, root),
      cert: readFile(cert, root)
    }, app.callback()).listen(port, cb);
  } else {
    http.createServer(app.callback()).listen(port, cb);
  }
}