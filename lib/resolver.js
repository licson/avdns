const Config = require('config.js');

var Resolver = function () {
	this.port = Config.get();
}

module.exports = Resolver;
