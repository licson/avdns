const Promise = require('bluebird');
const DNS = require('dnsd');
const DNSr = require('dns');
const Checker = require('./lists.js')
const db = require('./db.js');

var Resolver = function () {
	this.init();
}

Resolver.prototype.init = function () {
	var self = this;

	this.shortLivedCache = new Map();

	// Clear memory cache every 5 minutes
	setInterval(function () {
		self.shortLivedCache.clear();
	}, 300000);

	this.inst = DNS.createServer(function (req, res) {
		self.handle(req, res);
	});

	this.inst.listen(53, function () {
		console.log("[Resolver] DNS resolver started on PID %d", process.pid);
	});

	this.checker = new Checker();
}

Resolver.prototype.handle = function (req, res) {
	var query = req.question[0];
	var name = query.name;
	var type = query.type;

	// Only process IP records for now
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

	this.inCache(name, "A").then(function (addresses) {
		if (Array.isArray(addresses) && addresses.length > 0) {
			console.log("[Resolver] Name %s for type A already in cache.", name);
			res.answer = self.formatResponse(name, "A", addresses);
			res.end();
			return Promise.resolve(true);
		} else {
			return Promise.resolve(false);
		}
	}).then(function (cached) {
		if (cached) return;

		self.checker.checkName(name).then(function (result) {
			if (result === false) {
				console.log("[Resolver] Name %s not in blacklist, proceeding check.", name);
				DNSr.resolve4(name, { ttl: true }, function (e, resp) {
					if (e) {
						self.errorResponse(res, 2); // SERVFAIL
						return;
					} else {
						Promise.map(resp, function (item) { return self.checker.processIP(item.address); })
							.then(function (result) {
								if (result.reduce(function (prev, curr) { return prev || curr; }) === true) {
									console.log("[Resolver] IP %s have negative DNSBL response, rejecting...", resp);
									self.errorResponse(res);
								} else {
									console.log("[Resolver] All test passed.");
									var ttl = resp[0].ttl;

									resp = resp.map(function (item) {
										return item.address;
									});

									res.answer = self.formatResponse(name, "A", resp);
									self.cacheResp(name, "A", resp, ttl);
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
	});
}

Resolver.prototype.respAAAA = function (name, res) {
	var self = this;
	this.inCache(name, "AAAA").then(function (addresses) {
		if (Array.isArray(addresses) && addresses.length > 0) {
			console.log("[Resolver] Name %s for type AAAA already in cache.", name);
			res.answer = self.formatResponse(name, "AAAA", addresses);
			res.end();
			return Promise.resolve(true);
		} else {
			return Promise.resolve(false);
		}
	}).then(function (cached) {
		if (cached) return;
		self.checker.checkName(name).then(function (result) {
			if (result === false) {
				console.log("[Resolver] Name %s not in blacklist, proceeding check.", name);
				DNSr.resolve6(name, { ttl: true }, function (e, resp) {
					if (e) {
						self.errorResponse(res, 2); // SERVFAIL
						return;
					} else {
						// Skip DNSBL check as they are IPv6 incompatible
						// Need to expand the abberviated IPv6 literal to
						// make the representation compatible to the DNS server implemention
						var ttl = resp[0].ttl;
						resp = resp.map(function (addr) {
							return self.expandV6(addr.address);
						});

						console.log("[Resolver] All test passed.");
						res.answer = self.formatResponse(name, "AAAA", resp);
						self.cacheResp(name, "AAAA", resp, ttl);
						res.end();
					}
				});
			} else {
				console.log("[Resolver] Name %s exists in blacklist, rejecting...", name);
				self.errorResponse(res);
			}
		});
	});
}

Resolver.prototype.cacheResp = function (name, type, resp, ttl) {
	var transaction = db.multi();
	var keyName = 'dnscache:' + name + ':' + type;

	this.shortLivedCache.set(keyName, resp);
	resp.forEach(function (address) {
		transaction.sadd([keyName, address]);
	});

	// Add TTL to the key
	transaction.expire(keyName, ttl);

	// Submit the transaction
	transaction.exec();
}

Resolver.prototype.inCache = function (name, type) {
	var keyName = 'dnscache:' + name + ':' + type;

	if (this.shortLivedCache.has(keyName)) {
		return Promise.resolve(this.shortLivedCache.get(keyName));
	} else {
		return db.smembersAsync(keyName);
	}
}

Resolver.prototype.expandV6 = function (address) {
	var fullAddress = "";
	var expandedAddress = "";
	var validGroupCount = 8;
	var validGroupSize = 4;

	var ipv4 = "";
	var extractIpv4 = /([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/;
	var validateIpv4 = /((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})/;

	// look for embedded ipv4
	if (validateIpv4.test(address)) {
		groups = address.match(extractIpv4);
		for (var i = 1; i < groups.length; i++) {
			ipv4 += ("00" + (parseInt(groups[i], 10).toString(16))).slice(-2) + (i == 2 ? ":" : "");
		}
		address = address.replace(extractIpv4, ipv4);
	}

	if (address.indexOf("::") == -1) // All eight groups are present.
		fullAddress = address;
	else // Consecutive groups of zeroes have been collapsed with "::".
	{
		var sides = address.split("::");
		var groupsPresent = 0;
		for (var i = 0; i < sides.length; i++) {
			groupsPresent += sides[i].split(":").length;
		}
		fullAddress += sides[0] + ":";
		for (var i = 0; i < validGroupCount - groupsPresent; i++) {
			fullAddress += "0000:";
		}
		fullAddress += sides[1];
	}
	var groups = fullAddress.split(":");
	for (var i = 0; i < validGroupCount; i++) {
		while (groups[i].length < validGroupSize) {
			groups[i] = "0" + groups[i];
		}
		expandedAddress += (i != validGroupCount - 1) ? groups[i] + ":" : groups[i];
	}
	return expandedAddress;
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
