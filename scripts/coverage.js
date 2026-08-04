"use strict";

/**
 * Run the tests of scripts/test.js under c8 and report the coverage of the
 * library, as the target "instrumented" of the original build did with
 * JSCoverage.
 *
 * c8 does not read nor rewrite the sources: V8 records the coverage while it
 * runs and c8 only converts it, so the version of ECMAScript of the library
 * does not matter. The bundle the tests run is a concatenation, so it is
 * written with a source map that brings the coverage back to the files.
 *
 * Usage: node scripts/coverage.js [--reporter=text|html|lcov ...]
 */

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    child = require("child_process"),
    bundle = require("./lib/bundle.js"),
    sources = require("./lib/sources.js"),
    rootDir = path.resolve(__dirname, ".."),
    reportDir = path.join(rootDir, "coverage");

function main() {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-coverage-")),
        bundlePath = path.join(dir, "tests.js"),
        built = bundle.buildWithMap(true),
        reporters = process.argv.slice(2),
        c8,
        result;

    fs.writeFileSync(bundlePath, built.code
        + "\n//# sourceMappingURL=tests.js.map\n");
    fs.writeFileSync(bundlePath + ".map", JSON.stringify(built.map));
    fs.writeFileSync(path.join(dir, "run.js"),
        "require(" + JSON.stringify(path.join(__dirname, "lib/dom.js"))
        + ").install();\nrequire(" + JSON.stringify(bundlePath) + ");\n");
    fs.symlinkSync(path.join(rootDir, "node_modules"), path.join(dir, "node_modules"));

    try {
        c8 = require.resolve("c8/bin/c8.js");
    } catch (ignore) {
        console.error("c8 was not found: run \"npm install\" first.");
        process.exit(1);
    }

    if (reporters.length === 0) {
        reporters = ["--reporter=text", "--reporter=html"];
    }

    // The tests run from their own directory, as they read their documents from
    // it, so the sources of the library are outside of it: without
    // --allowExternal c8 drops them all. The exclusions are applied once the
    // source map is resolved, as the coverage is recorded on the bundle.
    result = child.spawnSync(process.execPath, [c8].concat(reporters, [
        "--report-dir", reportDir,
        "--allowExternal",
        "--exclude-after-remap",
        "--exclude", "**/webodf/tests/**",
        "--exclude", "**/lib/externs/**",
        process.execPath, path.join(dir, "run.js")
    ]), {
        cwd: sources.testsDir,
        stdio: "inherit"
    });

    fs.rmSync(dir, {recursive: true, force: true});
    if (result.status === 0) {
        console.log("The report is in " + reportDir + ".");
    }
    process.exit(result.status === null ? 1 : result.status);
}

main();
