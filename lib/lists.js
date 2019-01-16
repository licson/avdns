const redis = require('./db.js');
const Promise = require('bluebird');
const dns = require('dns');

var ListChecker = function () {
	this.regexIPv4 = /(([0-9]|[0-9]{2}|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[0-9]{2}|1[0-9]{2}|2[0-4][0-9]|25[0-5])/g;
	this.dnsbl = [
		{ name: "xbl.spamhaus.com", dnsBased: false },
		//  name: "dbl.spamhaus.com", dnsBased: true },
		{ name: "korea.services.net", dnsBased: false }
	];

	this.dnsblCache = new Map();

	this.ratio = 0.3;
	this.threshole = Math.ceil(this.dnsbl.length * this.ratio);
}

ListChecker.prototype.formatDNSBL = function (query, i) {
	if (this.regexIPv4.test(query)) {
		var reversed = query.split(".").reverse().join(".");

		if (!this.dnsbl[i].dnsBased) return reversed + "." + this.dnsbl[i].name;
	} else if (this.dnsbl[i].dnsBased) {
		// Assumes DNS 
		return query + "." + this.dnsbl[i].name;
	} else {
		// Probably IPv6 or other garbage input
		return "garbage";
	}
}

ListChecker.prototype.processIP = function (ip) {
	var self = this;
	var checkJobs = [];

	if (this.dnsblCache.has(ip)) {
		return Promise.resolve(this.dnsblCache.get(ip));
	} else {
		this.dnsbl.forEach(function (entry, key) {
			checkJobs.push(new Promise(function (resolve, reject) {
				dns.resolve(self.formatDNSBL(ip, key), "A", function (e, resp) {
					if (e) {
						// Not in blacklist
						resolve(false);
					} else {
						// Blacklisted
						resolve(true);
					}
				});
			}));
		});

		/* checkJobs.push(redis.getAsync("blacklist:" + ip).then(function (e, res) {
			if (res === null || !!res === false) {
				return Promise.resolve(false);
			} else {
				return Promise.resolve(true);
			}
		})); */

		return Promise.all(checkJobs)
			.then(function (result) {
				var countList = new Map();
				result.forEach(function (v) {
					if (countList.has(v)) {
						countList.set(v, countList.get(v) + 1);
					} else {
						countList.set(v, 1);
					}
				});

				if (countList.get(true) > self.threshole) {
					return Promise.resolve(true);
				} else {
					return Promise.resolve(false);
				}
			});
	}
}

ListChecker.prototype.checkName = function (name) {
	return redis.getAsync("blacklist:" + name).then(function (e, res) {
		if (res === null || !!res === false) {
			return Promise.resolve(false);
		} else {
			return Promise.resolve(true);
		}
	});
}

module.exports = ListChecker;
