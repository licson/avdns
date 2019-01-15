const request = require("request");
const csv = require("fast-csv");
const url = require("url");
const db = require("./lib/db");

const ListImporter = function (url) {
	var self = this;

	this.listUrl = url;
	this.ttl = 300; // 5-minute timeout on Redis instance
	this.bulkSize = 1000; // Import 100 records at a time
	this.bulkCount = 0;
	this.recordCount = 0;
	this.currentBatch = db.multi(); // Holds the command queue

	this.csvStream = csv({ comment: "#" });

	this.csvStream.on("data", function (data) {
		self.insert(data);
	});

	this.csvStream.on("end", function () {
		console.log("[List Import] Completed!");

		// Submit the last batch just in case
		self.submitBatch();

		// Cut the database connection
		db.quit();
	});
}

ListImporter.prototype.process = function () {
	this.listStream = request(this.listUrl);
	
	this.listStream.on("error", function (e) {
		console.error("[List Import] Error occured when fetching list! %s", e);
	});

	// Kickstart the CSV processor
	this.listStream.pipe(this.csvStream);
}

ListImporter.prototype.insert = function (data) {
	// CSV format of abuse.ch:
	// data[0]: Item ID
	// data[1]: Item Date
	// data[2]: URL
	// data[3]: Status
	// data[4]: Threat Type
	
	if (data.length != 7) return;
	var host = url.parse(data[2]).hostname;

	// Only insert when reported online
	// if (data[3] == "online") {
		var record = {
			source: "urlhaus",
			status: data[3],
			type: data[4]
		};

		this.currentBatch.set(["blacklist:" + host, JSON.stringify(record), "EX", this.ttl], function (e, res) {
			if (res != null) {
				// Successful
				// console.log("[List Importer] Imported record %s", host);
			}
		});
	// }

	this.recordCount++;

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
	const inst = new ListImporter("https://urlhaus.abuse.ch/downloads/csv/");
	inst.process();
} else {
	module.exports = ListImporter;
}