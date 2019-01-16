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
	var query = req.question[0];
	var name = query.name;
	var type = query.type;

	// Only process IPv4 records for now
	switch (type) {
		case "A":
			this.respA(name, res);
			break;

		case "AAAA":
			this.respAAAA(name, res);
			break;

		default:
			this.errorResponse(res, 4); // Function Not Implemented
			break;
	}
}

Resolver.prototype.respA = function (name, res) {
	var self = this;
	this.checker.checkName(name).then(function (result) {
		if (result === false) {
			console.log("[Resolver] Name %s not in blacklist, proceeding check.", name);
			DNSr.resolve(name, "A", function (e, resp) {
				if (e) {
					self.errorResponse(res, 2); // SERVFAIL
					return;
				} else {
					Promise.map(resp, function (item) { return self.checker.processIP(item); })
						.then(function (result) {
							if (result.reduce(function (prev, curr) { return prev || curr; }) === true) {
								console.log("[Resolver] IP %s have negative DNSBL response, rejecting...", resp);
								self.errorResponse(res);
							} else {
								console.log("[Resolver] All test passed.");
								res.answer = self.formatResponse(name, "A", resp);
								res.end();
							}
						});
				}
			});
		} else {
			console.log("[Resolver] Name %s exists in blacklist, rejecting...", name);
			self.errorResponse(res);
		}
	});
}

Resolver.prototype.respAAAA = function (name, res) {
	var self = this;
	this.checker.checkName(name).then(function (result) {
		if (result === false) {
			console.log("[Resolver] Name %s not in blacklist, proceeding check.", name);
			DNSr.resolve(name, "AAAA", function (e, resp) {
				if (e) {
					self.errorResponse(res, 2); // SERVFAIL
					return;
				} else {
					// Skip DNSBL check as they are IPv6 incompatible
					res.answer = self.formatResponse(name, "AAAA", resp);
					res.end();
				}
			});
		} else {
			console.log("[Resolver] Name %s exists in blacklist, rejecting...", name);
			self.errorResponse(res);
		}
	});
}

Resolver.prototype.errorResponse = function (resp, code) {
	if (!code) {
		code = 3; // NXDOMAIN
	}

	resp.response = code;
	resp.end();
}

Resolver.prototype.formatResponse = function (domain, type, data) {
	var ret = [];
	data.forEach(function (resp) {
		ret.push({
			name: domain,
			type: type,
			data: resp
		});
	});

	return ret;
}

module.exports = Resolver;
