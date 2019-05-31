/**
 * http forward
 */
const http = require('https');
const querystring = require('querystring');

const requests = {};

class HttpClient {
  constructor(service, {host, port, prefix, ssl}) {
    for (let fn in service) {
      const {originalName: name, options, path: p} = service[fn];
      Object.defineProperty(this, name, {
        enumerable: false,
        configurable: false,
        set: () => {},
        get: () => (...args) => {
          const cb = args.pop();
          const payload = args[0];
          const metadata = args[1];
          // request
          try {
            const request = requests[p] || (requests[p] = createRequest(options, {host, port, prefix, ssl}));
            request(payload, metadata, cb);
          } catch (e) {
            cb(e);
          }
        }
      });
    }
  }
}

module.exports = HttpClient;

function createRequest(options, {host, port = 80, prefix = '', ssl}) {
  for (let key in options) {
    const val = options[key];
    key = key.replace(/^\(google\.api\.http\)\./, '').toLowerCase();
    switch (key) {
      case 'get':
        return (json, meta, cb) => {
          json = flat(json);
          const agent = new http.Agent({
            rejectUnauthorized: false,
            ciphers: "ALL",
            secureProtocol: "TLSv1_1_method"
          });
          const req = http.request({
            hostname: host,
            path: `${prefix}${val}?${querystring.stringify(json)}`,
            method: "GET",
            headers: {
              host,
              ...(meta ? meta.getMap() : {})
            },
            agent
          }, res => {
            let body = Buffer.from("");
            res.on('data', chunk => { body = Buffer.concat([body, chunk]); });
            res.on("end", () => {
              try {
                if (res.statusCode !== 200) {
                  const err = new Error(body.toString() || `http request error`);
                  err.code = res.statusCode;
                  err.body = json;
                  err.url = `${prefix}${val}?${querystring.stringify(json)}`;
                  cb(err);
                } else {
                  cb(null, JSON.parse(body));
                }
              } catch (e) {
                cb(e);
              }
            });
          });
          req.on('error', e => {
            cb(e);
          });
          req.end();
        };
      case 'post':
      case 'put':
      case 'delete':
      case 'patch':
        return (json, meta, cb) => {
          json  = JSON.stringify(json);
          const agent = new http.Agent({
            rejectUnauthorized: false,
            ciphers: "ALL",
            secureProtocol: "TLSv1_1_method"
          });
          const req = http.request({
            hostname: host,
            path: `${prefix}${val}`,
            method: key,
            headers: {
              host,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(json),
              ...(meta ? meta.getMap() : {})
            },
            agent
          }, res => {
            let body = Buffer.from("");
            res.on('data', chunk => { body = Buffer.concat([body, chunk]); });
            res.on("end", () => {
              try {
                if (res.statusCode !== 200) {
                  const err = new Error(body.toString() || `http request error`);
                  err.code = res.statusCode;
                  err.body = json;
                  err.url = `${prefix}${val}`;
                  cb(err);
                } else {
                  cb(null, JSON.parse(body));
                }
              } catch (e) {
                cb(e);
              }
            });
          });
          req.on('error', e => {
            cb(e);
          });
          req.end(json);
        };
      case 'body':
        break;
      default:
        console.error(`unsupport google api option: ${key}`);
    }
  }
}

/**
 * querystring 预处理
 * 
 * arr: [1,2] -> arr[0]: 1, arr[1]: 2
 * obj: {a: 1, b: 2} -> obj.a: 1, obj.b: 2
 */
function flat(json, base = '', pool = {}) {
  switch (Object.prototype.toString.call(json)) {
    case '[object Object]':
      for (let key in json) {
        const it = json[key];
        switch (Object.prototype.toString.call(it)) {
          case '[object Object]':
          case '[object Array]':
            flat(it, `${base}${base ? '.' : ''}${key}`, pool);
            break;
          default:
            pool[`${base}${base ? '.' : ''}${key}`] = it;
        }
      }
      break;
    case '[object Array]':
      for (let key = 0, len = json.length; key < len; key++) {
        const it = json[key];
        switch (Object.prototype.toString.call(it)) {
          case '[object Object]':
          case '[object Array]':
            flat(it, `${base}[${key}]`, pool);
            break;
          default:
            pool[`${base}[${key}]`] = it;
        }
      }
      break;
    default:
      pool = json;
  }  
  return pool;
}
