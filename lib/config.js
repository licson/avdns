var db = require('./db.js');
var EventEmitter = require('events').EventEmitter;

var Config = function () {
	EventEmitter.call(this);
	
	var self = this;
	this.conn = db.duplicate();

	conn.on("message", function (channel, message) {
		try {
			self.emit(channel, JSON.parse(message));
		} catch (e) {
			console.error(e);
		}
	});
}

Config.prototype = Object.create(EventEmitter);

Config.prototype.subscribe = function (keys) {
	var self = this;

	if (!Array.isArray(keys)) {
		return;
	}

	keys.forEach(function (key) {
		self.conn.subscribe("config:" + key);
	});
}

module.exports = Config;