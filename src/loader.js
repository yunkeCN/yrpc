/**
 * @grpc/proto-loader | 为 createMethodDefinition 补充输入输出 TYPE 的引用
 */
var Protobuf = require("protobufjs");
var fs = require("fs");
var path = require("path");
var _ = require("lodash");

exports.load = load;
exports.loadSync = loadSync;

function load(filename, options) {
  var root = new Protobuf.Root();
  options = options || {};
  if (!!options.includeDirs) {
    if (!(options.includeDirs instanceof Array)) {
      return Promise.reject(new Error('The includeDirs option must be an array'));
    }
    addIncludePathResolver(root, options.includeDirs);
  }
  return root.load(filename, options).then(function (loadedRoot) {
    loadedRoot.resolveAll();
    return createPackageDefinition(root, options);
  });
}
function loadSync(filename, options) {
  var root = new Protobuf.Root();
  options = options || {};
  if (!!options.includeDirs) {
    if (!(options.includeDirs instanceof Array)) {
      throw new Error('The include option must be an array');
    }
    addIncludePathResolver(root, options.includeDirs);
  }
  var loadedRoot = root.loadSync(filename, options);
  loadedRoot.resolveAll();
  return createPackageDefinition(root, options);
}
function joinName(baseName, name) {
  if (baseName === '') {
    return name;
  }
  else {
    return baseName + '.' + name;
  }
}
function getAllServices(obj, parentName) {
  var objName = joinName(parentName, obj.name);
  if (obj.hasOwnProperty('methods')) {
    return [[objName, obj]];
  }
  else {
    return obj.nestedArray.map(function (child) {
      if (child.hasOwnProperty('nested')) {
        return getAllServices(child, objName);
      }
      else {
        return [];
      }
    }).reduce(function (accumulator, currentValue) { return accumulator.concat(currentValue); }, []);
  }
}
function createDeserializer(cls, options) {
  return function deserialize(argBuf) {
    return cls.toObject(cls.decode(argBuf), options);
  };
}
function createSerializer(cls) {
  return function serialize(arg) {
    var message = cls.fromObject(arg);
    return cls.encode(message).finish();
  };
}
function createMethodDefinition(method, serviceName, options) {
  return {
    path: '/' + serviceName + '/' + method.name,
    options: method.options,
    requestStream: !!method.requestStream,
    responseStream: !!method.responseStream,
    requestType: method.resolvedRequestType,
    responseType: method.resolvedResponseType,
    requestSerialize: createSerializer(method.resolvedRequestType),
    requestDeserialize: createDeserializer(method.resolvedRequestType, options),
    responseSerialize: createSerializer(method.resolvedResponseType),
    responseDeserialize: createDeserializer(method.resolvedResponseType, options),
    // TODO(murgatroid99): Find a better way to handle this
    originalName: _.camelCase(method.name)
  };
}
function createServiceDefinition(service, name, options) {
  var def = {};
  for (var _i = 0, _a = service.methodsArray; _i < _a.length; _i++) {
    var method = _a[_i];
    def[method.name] = createMethodDefinition(method, name, options);
  }
  return def;
}
function createPackageDefinition(root, options) {
  var def = {};
  for (var _i = 0, _a = getAllServices(root, ''); _i < _a.length; _i++) {
    var _b = _a[_i], name = _b[0], service = _b[1];
    def[name] = createServiceDefinition(service, name, options);
    // 添加不可遍历的属性
    Object.defineProperty(def[name], 'filename', {
      enumerable: false,
      value: service.filename
    });
  }
  Object.defineProperty(def, 'root', {
    enumerable: false,
    value: root
  });
  return def;
}
function addIncludePathResolver(root, includePaths) {
  root.resolvePath = function (origin, target) {
    for (var _i = 0, includePaths_1 = includePaths; _i < includePaths_1.length; _i++) {
      var directory = includePaths_1[_i];
      var fullPath = path.join(directory, target);
      try {
        fs.accessSync(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch (err) {
        var idx = target.lastIndexOf("google/protobuf/");
        if (idx > -1) {
          target = `github.com/google/protobuf/src/${target}`;
          fullPath = path.join(directory, target);
          try {
            fs.accessSync(fullPath, fs.constants.R_OK);
            return fullPath;
          } catch (err) {
            continue;
          }
        } else {
          continue;
        }
      }
    }
    return null;
  };
}
