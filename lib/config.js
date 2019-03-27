var db = require('./db.js');
var EventEmitter = require('events').EventEmitter;

var Config = function () {
	EventEmitter.call(this);

	var self = this;
	this.conn = db.duplicate();

	this.conn.on("pmessage", function (pat, channel, message) {
		try {
			self.emit(channel, JSON.parse(message));
		} catch (e) {
			console.error(e);
		}
	});

	this.conn.psubscribe("config:*")
}

Config.prototype = Object.create(EventEmitter.prototype);

Config.prototype.subscribe = function (keys) {
	// Do nothing
}

Config.prototype.update = function (config, value) {
	var conn = this.conn.duplicate();

	conn.on("subscribe", function () {
		conn
			.publishAsync(config, JSON.stringify(value))
			.then(function () {
				conn.quit();
			});
	});

	conn.psubscribe("config:*");
}

module.exports = Config;