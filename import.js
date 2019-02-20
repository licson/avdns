const Promise = require("bluebird");
const request = require("request");
const csv = require("fast-csv");
const urllib = require("url");
const db = require("./lib/db");

const ListImporter = function (url, handlerType) {
	var self = this;

	this.listUrl = url;
	this.ttl = 300; // 5-minute timeout on Redis instance
	this.bulkSize = 1000; // Import 100 records at a time
	this.bulkCount = 0;
	this.recordCount = 0;
	this.currentBatch = db.multi(); // Holds the command queue

	this.handlers = {
		urlhaus: function (data) {
			// CSV format of abuse.ch:
			// data[0]: Item ID
			// data[1]: Item Date
			// data[2]: URL
			// data[3]: Status
			// data[4]: Threat Type

			if (data.length != 7) return null;
			var host = urllib.parse(data[2]).hostname;

			return {
				source: "urlhaus",
				host: host,
				status: data[3],
				type: data[4]
			};
		},
		generic: function (data) {
			return {
				host: data[0]
			};
		}
	};

	this.excludeHosts = [ "github.com" ];
	this.listHandler = this.handlers[handlerType] || function () { };

	this.csvStream = csv({ comment: "#" });

	this.csvStream.on("data", function (data) {
		self.insert(data);
	});

	this.csvStream.on("end", function () {
		// Submit the last batch just in case
		self.submitBatch();

		self.emit("end");
	});
}

ListImporter.prototype = Object.create(require('events').EventEmitter.prototype);

ListImporter.prototype.process = function () {
	this.listStream = request(this.listUrl);

	this.listStream.on("error", function (e) {
		console.error("[List Import] Error occured when fetching list! %s", e);
	});

	// Kickstart the CSV processor
	this.listStream.pipe(this.csvStream);
	this.emit("start");
}

ListImporter.prototype.insert = function (data) {
	var record = this.listHandler(data);

	if (record !== null && typeof record === "object" && this.excludeHosts.indexOf(record.host) < 0) {
		this.currentBatch.set(["blacklist:" + record.host, JSON.stringify(record), "EX", this.ttl], function (e, res) {
			if (res != null) {
				// Successful
				// console.log("[List Importer] Imported record %s", host);
			}
		});

		this.recordCount++;
	}

	if (this.recordCount % this.bulkSize == 0) {
		this.submitBatch();
	}
}

ListImporter.prototype.submitBatch = function () {
	var self = this;
	this.currentBatch.exec(function (e, replies) {
		self.bulkCount++;
		console.log("[List Importer] Batch %d", self.bulkCount);

		if (e) {
			console.error("[List Importer] Import error: %s", e);
		}
	});

	this.currentBatch = db.multi(); // Creates a new batch
}

if (process.argv0 == "node" && process.argv[1].indexOf("import.js") > -1) {
	// Called from shell directly
	// Malware list kindly provided from abuse.ch,
	// updated every 5 minutes
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
		})
	]).then(function () {
		console.log("[List Updater] Completed!");
		db.quit();
	});
} else {
	module.exports = ListImporter;
}