var db = require('./db.js');
var EventEmitter = require('events').EventEmitter;

var Config = function () {
	EventEmitter.call(this);

	var self = this;
	this.conn = db.duplicate();
	this.config = new Map();

	// Fetch saved config from DB
	db.hgetallAsync('config').then(function (opts) {
		if (Object.keys(opts) > 0) {
			Object.keys(opts).forEach(function (opt) {
				self.emit('config:' + opts, JSON.parse(opts[opt]));
			});
		}
	});

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

		var name = opt.name;
		var val = opt.value;
		db.hget('config', opt.name, function (e, res) {
			if (res === null || e) {
				db.hset('config', name, JSON.stringify(val));
			}
		});
	});
}

Config.prototype.update = function (config, value) {
	var conn = this.conn.duplicate();

	conn
		.publishAsync('config:' + config, JSON.stringify(value))
		.then(function () {
			conn.quit();
		});
	
	db.hset('config', config, JSON.stringify(value));
}

module.exports = Config;