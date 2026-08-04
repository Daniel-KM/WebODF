"use strict";

/**
 * Run the tests that do not need a browser, as the target "simplenodetest" of
 * the original build did: the library and the tests are concatenated, then the
 * result is run with node from the directory of the tests, that holds the
 * documents they read.
 *
 * Usage: node scripts/test.js
 */

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    child = require("child_process"),
    bundle = require("./lib/bundle.js"),
    sources = require("./lib/sources.js"),
    rootDir = path.resolve(__dirname, "..");

function main() {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-test-")),
        bundlePath = path.join(dir, "tests.js"),
        result;
    // The bundle is loaded by a small script that adds a dom to the globals
    // first, so that the tests walking a document are not skipped.
    fs.writeFileSync(bundlePath, bundle.withTests());
    fs.writeFileSync(path.join(dir, "run.js"),
        `require(${JSON.stringify(path.join(__dirname, "lib/dom.js"))}).install();
require(${JSON.stringify(bundlePath)});
`);
    // The tests read their documents from the current directory, and require()
    // resolves the dependencies from the directory of the bundle.
    fs.symlinkSync(path.join(rootDir, "node_modules"), path.join(dir, "node_modules"));
    result = child.spawnSync(process.execPath, [path.join(dir, "run.js")], {
        cwd: sources.testsDir,
        stdio: "inherit"
    });
    fs.rmSync(dir, {recursive: true, force: true});
    process.exit(result.status === null ? 1 : result.status);
}

main();
