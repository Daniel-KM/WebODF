"use strict";

/**
 * Concatenation of the sources of the library, with or without its tests. The
 * order of the files comes from their dependencies, see lib/sources.js.
 */

var fs = require("fs"),
    path = require("path"),
    sources = require("./sources.js"),
    generated = require("./generated.js");

/**
 * @param {boolean} withTests
 * @return {string}
 */
function build(withTests) {
    var parts = [generated.versionSource()];
    sources.libraryFiles().forEach(function (file) {
        parts.push(fs.readFileSync(file, "utf8"));
    });
    parts.push(generated.cssSource());
    parts.push(fs.readFileSync(path.join(sources.libDir, "externs/JSZip.js"), "utf8"));
    if (withTests) {
        sources.testFiles().forEach(function (file) {
            parts.push(fs.readFileSync(file, "utf8"));
        });
    }
    // IS_COMPILED_CODE tells the runtime that all the classes are already
    // loaded, so that loadClass() does not fetch them one by one.
    return parts.join("\n").replace("var IS_COMPILED_CODE = false;",
        "var IS_COMPILED_CODE = true;");
}

/**
 * @return {string}
 */
function library() {
    return build(false);
}

/**
 * @return {string}
 */
function withTests() {
    return build(true);
}

exports.library = library;
exports.withTests = withTests;
