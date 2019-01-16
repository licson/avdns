const Resolver = require('./lib/resolver.js');
const ListImporter = require('./import.js');

// Start importer and update list before DNS starts
console.log("[System] Initializing...");
const inst = new ListImporter("https://urlhaus.abuse.ch/downloads/csv/", "urlhaus");

inst.on("start", function () {
    console.log("[List Updater] Start");
});

inst.on("end", function () {
    console.log("[List Updater] Completed!");

    // Start DNS service
    new Resolver();
});

inst.process();


