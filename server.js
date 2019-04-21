const os = require('os');
const cluster = require('cluster');
const Promise = require('bluebird');
const Resolver = require('./lib/resolver.js');
const ListImporter = require('./import.js');
const WebServer = require('./lib/web.js');

// Start DNS service
if (cluster.isMaster) {
	// Start importer and update list before DNS starts
	console.log("[System] Initializing...");

	function updateList() {
		console.log("[List Updater] Start");

		Promise.all([
			new Promise(function (resolve, reject) {
				const urlhaus = new ListImporter("https://urlhaus.abuse.ch/downloads/csv/", "urlhaus");
				urlhaus.on("end", function () { resolve(); });
				urlhaus.process();
			}),
			new Promise(function (resolve, reject) {
				const ransombl = new ListImporter("https://ransomwaretracker.abuse.ch/downloads/RW_DOMBL.txt", "generic");
				ransombl.on("end", function () { resolve(); });
				ransombl.process();
			}),
			new Promise(function (resolve, reject) {
				const ransombl = new ListImporter("http://mirror1.malwaredomains.com/files/domains.txt", "malwaredomains");
				ransombl.on("end", function () { resolve(); });
				ransombl.process();
			})
		]).then(function () {
			console.log("[List Updater] Completed!");
		});

		// Regular Updates every 5 minutes
		setTimeout(function () {
			updateList();
		}, 300000);
	}

	updateList();

	console.log("[System] Spawning %d threads...", os.cpus().length);

	if (os.platform() == 'win32') {
		// Windows does not support sharing UDP sockets, just kickstart everything
		var configChannel = new (require('./lib/config.js'))();
		new Resolver(configChannel);
		new WebServer();
	} else {
		for (var i = 0; i < os.cpus().length; i++) {
			cluster.fork();
		}
	}

	cluster.on('exit', (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
	});
} else {
	// Initiate Config Channel
	var configChannel = new (require('./lib/config.js'))();
	// Start DNS server
	new Resolver(configChannel);
	// Start Web server
	new WebServer();
}