const redis = require('db.js');
const dns = require('dns');

var ListChecker = function () {
	this.regexIPv4 = /(([0-9]|[0-9]{2}|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[0-9]{2}|1[0-9]{2}|2[0-4][0-9]|25[0-5])/g;
	this.dnsbl = [
		{ name: "xbl.spamhaus.com", dnsBased: false },
		{ name: "dbl.spamhaus.com", dnsBased: true },
		{ name: "korea.services.net", dnsBased: false }
	];

	this.ratio = 0.3;
	this.threshole = Math.round(this.dnsbl.length * this.ratio);
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
		return;
	}
}

ListChecker.prototype.process = function (ip, domain) {
	var self = this;
	var checkJobs = [];

	this.dnsbl.forEach(function (entry, key) {
		checkJobs.push(new Promise(function (resolve, reject) {
			
			dns.resolve(self.formatDNSBL(ip, key), function (resp, e) {
				if (e) {
					// Not in blacklist
				} else {
					// Blacklisted
				}
			});
		}));
	});
}

module.exports = ListChecker;