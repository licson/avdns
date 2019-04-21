const fs = require('fs');
const db = require('./db.js');
const http = require('http');
const https = require('https');
const Config = require('./config.js');
const express = require('express');
const session = require('express-session');
const redisStore = require('connect-redis');
const bodyParser = require('body-parser');

const WebServer = function () {
	var self = this;

	this.http = http.createServer();
	this.https = https.createServer({
		key: fs.readFileSync(__dirname + '/../res/cert/cert.key'),
		cert: fs.readFileSync(__dirname + '/../res/cert/cert.pem')
	});

	this.blockedPage = fs.readFileSync(__dirname + '/../res/blocked.html', 'utf8');

	this.http.on('request', function (req, res) {
		self.handler(req, res);
	});

	this.https.on('request', function (req, res) {
		self.handler(req, res);
	});

	this.prepareAdminPage();

	this.http.listen(80, '::');
	this.https.listen(443, '::');

	console.log('[Web] Web Server on PID #%s ready', process.pid);
}

WebServer.prototype.prepareAdminPage = function () {
	var self = this;
	var loggedIn = function (req, res, next) {
		if (!req.session.authorized || req.session.authorized === false) {
			res.redirect('/admin');
		} else {
			next();
		}
	}

	this.password = this.generateOnetimePass();
	this.config = new Config();
	this.app = express();
	this.sess = session({
		secret: this.generateOnetimePass(),
		store: new (redisStore(session))({ client: db })
	});

	this.app.use(this.sess);
	this.app.use(bodyParser.urlencoded());
	this.app.use(bodyParser.json());

	this.app.get('/admin', function (req, res) {
		if (!req.session.authorized || req.session.authorized === false) {
			return res.sendFile('login.html', { root: './res/admin/' });
		} else {
			res.redirect('/admin/index');
		}
	});

	this.app.post('/admin', function (req, res) {
		if (req.body.pass !== null && typeof req.body.pass === "string") {
			// Check for password
			if (req.body.pass === self.password) {
				req.session.authorized = true;
				res.redirect('/admin/index');
			} else {
				res.send("Password Incorrect!");
			}
		} else {
			res.send("Invalid response!");
		}
	});

	this.app.get('/admin/logout', function (req, res) {
		req.session.authorized = false;
		res.redirect('/admin');
	});

	this.app.get('/admin/index', loggedIn, function (req, res) {
		res.sendFile('dashboard.html', { root: './res/admin/' });
	});

	this.app.get('/admin/settings', loggedIn, function (req, res) {
		function strMapToObj(strMap) {
			let obj = Object.create(null);
			for (let [k, v] of strMap) {
				// We don’t escape the key '__proto__'
				// which can cause problems on older engines
				obj[k] = v;
			}
			return obj;
		}

		res.json(strMapToObj(self.config.config));
	});

	this.app.post('/admin/settings', loggedIn, function (req, res) {

	});

	console.log("[Web] Password for control panel: %s", this.password);
}

WebServer.prototype.generateOnetimePass = function () {
	var chars = [];
	var password = "";

	// Populate the character table
	for (var i = 33; i <= 126; i++) {
		chars.push(String.fromCharCode(i));
	}

	// Generate one-time pass with 12 characters
	for (var i = 0; i < 12; i++) {
		password += chars[~~(Math.random() * chars.length)];
	}

	return password;
}

WebServer.prototype.handler = function (req, res) {
	if (req.url.indexOf('/admin') == 0) {
		// Pass to express for advanced HTTP handling
		return this.app(req, res);
	} else {
		// Show blocked page
		var hostname = req.headers.host;
		res.end(this.blockedPage.replace('{name}', hostname));
	}
}

module.exports = WebServer;