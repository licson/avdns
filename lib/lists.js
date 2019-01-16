const redis = require('./db.js');
const Promise = require('bluebird');
const dns = require('dns');

var ListChecker = function () {
	this.regexIPv4 = /(([0-9]|[0-9]{2}|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[0-9]{2}|1[0-9]{2}|2[0-4][0-9]|25[0-5])/g;
	this.dnsbl = [
		{ name: "xbl.spamhaus.com", dnsBased: false },
		{ name: "zen.spamhaus.com", dnsBased: false },
		{ name: "wormrbl.imp.ch", dnsBased: false },
		{ name: "web.dnsbl.sorbs.net", dnsBased: false },
		{ name: "virus.rbl.msrbl.net", dnsBased: false },
		{ name: "virus.rbl.jp", dnsBased: false },
		{ name: "virbl.bit.nl", dnsBased: false },
		{ name: "url.rbl.jp", dnsBased: false },
		{ name: "uribl.swinog.ch", dnsBased: false },
		{ name: "ubl.unsubscore.com", dnsBased: false },
		{ name: "ubl.lashback.com", dnsBased: false },
		{ name: "tor.dan.me.uk", dnsBased: false },
		{ name: "spamrbl.imp.ch", dnsBased: false },
		{ name: "spamlist.or.kr", dnsBased: false },
		{ name: "spamguard.leadmon.net", dnsBased: false },
		{ name: "spam.spamrats.com", dnsBased: false },
		{ name: "spam.rbl.msrbl.net", dnsBased: false },
		{ name: "spam.dnsbl.sorbs.net", dnsBased: false },
		{ name: "short.rbl.jp", dnsBased: false },
		{ name: "sbl.spamhaus.org", dnsBased: false },
		{ name: "spamrbl.imp.ch", dnsBased: false },
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
			})
			.then(function (result) {
				// Performs a complementary check on the IP in the malware DB
				if (result === false) {
					return self.checkName(ip);
				} else {
					return Promise.resolve(result);
				}
			});
	}
}

ListChecker.prototype.checkName = function (name) {
	return redis.getAsync("blacklist:" + name).then(function (res) {
		if (res === null || !!res === false) {
			return Promise.resolve(false);
		} else {
			return Promise.resolve(true);
		}
	});
}

module.exports = ListChecker;
