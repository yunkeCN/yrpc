/**
 * inspect the rpc object
 */
module.exports = function inspect(rpc) {
  const namespaces = {};
  for (let ns in rpc) {
    const {messages, services} = namespaces[ns] || (namespaces[ns] = {
      name: ns,
      messages: {},
      services: {}
    });
    for (let srv in rpc[ns]) {
      const methods = [];
      const {service} = rpc[ns][srv];
      services[srv] = {
        name: srv,
        package: ns,
        methods,
        filename: service.filename
      };
      for (let m in service) {
        const {
          originalName,
          requestStream,
          requestType,
          responseStream,
          responseType
        } = service[m];
        methods.push({
          name: originalName,
          requestStream,
          requestName: requestType.name,
          responseStream,
          responseName: responseType.name
        });
        travMsg(requestType, messages);
        travMsg(responseType, messages);
      }
    }
  }

  return namespaces;
}

function travMsg(type, pool = {}) {
  if (type) {
    const {name, fieldsArray: fields} = type;
    if (!(name in pool)) {
      pool[name] = {
        name,
        fields: fields.map(f => {
          if (f.resolvedType) {
            travMsg(f.resolvedType, pool);
          }
          return {
            defaultValue: f.defaultValue,
            id: f.id,
            long: f.long,
            map: f.map,
            name: f.name,
            optional: f.optional,
            repeated: f.repeated,
            required: f.required,
            type: f.type
          };
        })
      }
    }
  }
  return pool;
}
