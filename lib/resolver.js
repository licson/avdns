const Promise = require('bluebird');
const DNS = require('dnsd');
const DNSr = require('dns');
const Checker = require('./lists.js')

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

	this.checker = new Checker();
}

Resolver.prototype.handle = function (req, res) {
	var self = this;
	var query = req.question[0];
	var name = query.name;
	var type = query.type;

	// Only process IPv4 records for now
	if (type != "A") {
		// TODO: Passthrough the request
		res.response = 4; // Function Not Implemented
		res.end();
		return;
	} else {
		// Processing Pipeline
		this.checker.checkName(name).then(function (result) {
			if (result === false) {
				DNSr.resolve(name, type, function (e, resp) {
					if (e) {
						res.answer.response = 2; // Server Failed
						res.end();
						return;
					} else {
						Promise.map(resp, function (item) { return self.checker.processIP(item); })
							.then(function (result) {
								if (result.reduce(function (prev, curr) { return prev || curr; }) === true) {
									res.answer.response = 3; // NXDOMAIN
									res.end();
								} else {
									res.answer = self.formatResponse(resp);
									res.end();
								}
							});
					}
				});
			} else {
				res.answer.response = 3; // NXDOMAIN
				res.end();
			}
		});
	}
}


Resolver.prototype.formatResponse = function (domain, data) {
	var ret = [];
	data.forEach(function (resp) {
		ret.push({
			name: domain,
			type: "A",
			data: resp
		});
	});

	return ret;
}

module.exports = Resolver;
