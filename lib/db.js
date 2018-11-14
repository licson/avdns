var redis = require('redis');
var bluebird = require('bluebird');
var conn_info = require('../dbconn.json');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var client = redis.createClient({
    host: conn_info.host,
    port: conn_info.port,
    password: conn_info.pass
});

client.on('error', function (e) {
    console.error(e);
});

module.exports = client;