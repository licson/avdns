const os = require('os');
const cluster = require('cluster');
const Resolver = require('./lib/resolver.js');
const ListImporter = require('./import.js');

// Start DNS service
if (cluster.isMaster) {
    // Start importer and update list before DNS starts
    console.log("[System] Initializing...");

    function updateList() {
        const inst = new ListImporter("https://urlhaus.abuse.ch/downloads/csv/", "urlhaus");

        inst.on("start", function () {
            console.log("[List Updater] Start");
        });

        inst.on("end", function () {
            console.log("[List Updater] Completed!");
        });

        inst.process();

        // Regular Updates every 5 minutes
        setTimeout(function () {
            updateList();
        }, 300000);
    }

    updateList();

    console.log("[System] Spawning %d threads...", os.cpus().length);

    for (var i = 0; i < os.cpus().length; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    // Start DNS server
    new Resolver();
}