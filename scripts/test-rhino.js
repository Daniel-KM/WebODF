"use strict";

/**
 * Run the tests that do not need a browser with Rhino, on a java virtual
 * machine, as a second engine besides node.
 *
 * Usage: node scripts/test-rhino.js
 */

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    child = require("child_process"),
    bundle = require("./lib/bundle.js"),
    rhino = require("./lib/rhino.js"),
    sources = require("./lib/sources.js");

rhino.jar().then(function (jarPath) {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-rhino-")),
        bundlePath = path.join(dir, "tests.js"),
        result;
    fs.writeFileSync(bundlePath, bundle.withTests());
    // The tests read their documents from the current directory.
    // The dom of java is implemented by internal classes that the module system
    // does not export since java 9, and Rhino reaches them by reflection.
    result = child.spawnSync("java", [
        "--add-opens", "java.xml/com.sun.org.apache.xerces.internal.dom=ALL-UNNAMED",
        "-jar", jarPath, "-f", bundlePath
    ], {
        cwd: sources.testsDir,
        stdio: "inherit"
    });
    fs.rmSync(dir, {recursive: true, force: true});
    if (result.error) {
        console.error("Unable to run java, that Rhino needs: " + result.error.message);
        process.exit(1);
    }
    process.exit(result.status === null ? 1 : result.status);
}).catch(function (err) {
    console.error(String(err));
    process.exit(1);
});
