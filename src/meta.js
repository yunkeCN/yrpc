/**
 * 元数据 组装
 */
const {Metadata} = require('grpc');

module.exports = function metadata(json) {
  const metadata = new Metadata();
  for (let key in json) {
    metadata.set(key, json[key]);
  }
  return metadata;
}