const Config = require('config.js');
const Promise = require('bluebird');
const DNS = require('dnsd');
const DNSr = require('dns');

var Resolver = function () {
	this.init();
}

Resolver.prototype.init = function () {
	var self = this;
	
	this.inst = DNS.createServer(function (req, res) {
		self.handle(req, res);
	});

	this.inst.listen(53, function () {
		console.log("[Resolver] DNS resolver started");
	});
}

Resolver.prototype.handle = function (req, res) {
	Promise.map(req.question, function (q) {
		return new Promise(function (resolve, reject) {
			// TODO: check blacklist
			DNSr.resolve(q.name, q.type, function (e, records) {
				if (e) {
					reject(e);
					return;
				} else {
					resolve(records);
				}
			});
		});
	})
	.then(function (results) {
		results.forEach(function (answer) {
			
		});
	});
}

module.exports = Resolver;
