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
    sources = require("./lib/sources.js"),
    generated = require("./lib/generated.js"),
    rootDir = path.resolve(__dirname, "..");

/**
 * The library and the tests, concatenated. IS_COMPILED_CODE is not set: the
 * tests use runtime.loadClass() on classes that are already there, and the
 * runtime handles it when the code is marked as compiled.
 * @return {string}
 */
function bundle() {
    var parts = [generated.versionSource()];
    sources.libraryFiles().forEach(function (file) {
        parts.push(fs.readFileSync(file, "utf8"));
    });
    parts.push(generated.cssSource());
    parts.push(fs.readFileSync(path.join(sources.libDir, "externs/JSZip.js"), "utf8"));
    sources.testFiles().forEach(function (file) {
        parts.push(fs.readFileSync(file, "utf8"));
    });
    return parts.join("\n").replace("var IS_COMPILED_CODE = false;",
        "var IS_COMPILED_CODE = true;");
}

function main() {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-test-")),
        bundlePath = path.join(dir, "tests.js"),
        result;
    fs.writeFileSync(bundlePath, bundle());
    // The tests read their documents from the current directory, and require()
    // resolves the dependencies from the directory of the bundle.
    fs.symlinkSync(path.join(rootDir, "node_modules"), path.join(dir, "node_modules"));
    result = child.spawnSync(process.execPath, [bundlePath], {
        cwd: sources.testsDir,
        stdio: "inherit"
    });
    fs.rmSync(dir, {recursive: true, force: true});
    process.exit(result.status === null ? 1 : result.status);
}

main();
