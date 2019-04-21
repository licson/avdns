var db = require('./db.js');
var EventEmitter = require('events').EventEmitter;

var Config = function () {
	EventEmitter.call(this);

	var self = this;
	this.conn = db.duplicate();
	this.config = new Map();

	this.conn.on("pmessage", function (pat, channel, message) {
		try {
			console.log("[Configuration] Settings %s has updated to '%s'.", channel.replace('config:', ''), message);
			self.emit(channel, JSON.parse(message));
			self.config.set(channel, JSON.parse(message));
		} catch (e) {
			console.error(e);
		}
	});

	this.conn.psubscribe("config:*")
}

Config.prototype = Object.create(EventEmitter.prototype);

Config.prototype.subscribe = function (keys) {
	// Set default values for the settings
	var self = this;
	keys.forEach(function (opt) {
		self.config.set(opt.name, opt.value);
	});
}

Config.prototype.update = function (config, value) {
	var conn = this.conn.duplicate();

	conn
		.publishAsync(config, JSON.stringify(value))
		.then(function () {
			conn.quit();
		});
}

module.exports = Config;