const fs = require('fs');
const http = require('http');
const https = require('https');

const WebServer = function () {
	var self = this;

	this.http = http.createServer();
	this.https = https.createServer({
		key: fs.readFileSync(__dirname + '/../res/cert/cert.key'),
		cert: fs.readFileSync(__dirname + '/../res/cert/cert.pem')
	});

	this.blockedPage = fs.readFileSync(__dirname + '/../res/blocked.html');

	this.http.on('request', function (req, res) {
		self.handler(req, res);
	});

	this.https.on('request', function (req, res) {
		self.handler(req, res);
	});

	this.http.listen(80);
	this.https.listen(443);
}

WebServer.prototype.handler = function (req, res) {
	if (req.url.indexOf('/administration') == 0) {
		// @TODO: Web GUI
	} else {
		// Show blocked page
		var hostname = req.headers.host;
		res.end(this.blockedPage.replace('{name}', hostname));
	}
}