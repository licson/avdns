const dns = require('dns');
const fs = require('fs');
const ss = require('simple-statistics');
const bar = require('progress-bar');
const Promise = require('bluebird');

const dnsList = fs.readFileSync('./nameservers', 'utf8').split("\r\n").filter(function (item) {
	// Check for comments
	if (item.indexOf('#') == 0) {
		return false;
	} else {
		return true;
	}
});

const top1000Sites = fs.readFileSync('./top1000', 'utf8').split('\r\n');

// Main benchmark function
function benchmark(server, cb) {
	dns.setServers([ server ]);

	var samples = 1000;
	var counter = 0;
	var successful = 0;
	var failed = 0;
	var responseTimes = [];
	var benchStartTime = Date.now();
	var pbar = bar.create(process.stdout);
	
	const bench = function () {
		if (counter == samples) {
			// Generate Statistics
			var benchEndTime = Date.now();
			var stats = {
				avg: ss.average(responseTimes),
				med: ss.median(responseTimes),
				min: ss.min(responseTimes),
				max: ss.max(responseTimes),
				sd: ss.standardDeviation(responseTimes),
				totalTime: benchEndTime - benchStartTime,
				success: successful,
				fail: failed
			};

			pbar.clear();
			pbar = null;

			cb(stats);
			return;
		}

		var startTime = Date.now();
		dns.resolve(top1000Sites[counter], "A", function (err, res) {
			if (err) {
				failed++;
			} else {
				successful++;

				// Only count successful requests
				var endTime = Date.now();
				responseTimes.push(endTime - startTime);
			}

			// Update progressbar
			pbar.update(counter / samples);

			// Start next benchmark
			counter++;
			bench();
		});
	}

	// Start benchmark
	console.log("Benchmarking server %s...", server);
	bench();
}

function kickstart() {
	var counter = 0;
	var bench = function () {
		if (counter >= dnsList.length) {
			return;
		}

		benchmark(dnsList[counter], function (stats) {
			console.log("== Benchmark results for %s:", dnsList[counter]);
			console.log("Successful/Failed requests = %d/%d", stats.success, stats.fail);
			console.log("Request Min/Max/Avg/Med/SDev = %d/%d/%d/%d/%d ms", stats.min, stats.max, stats.avg, stats.med, stats.sd);
			console.log("Total time: %s seconds\n", stats.totalTime / 1000);

			// Start next bench
			counter++;
			bench();
		});
	}

	bench();
}

// Start benching
kickstart();