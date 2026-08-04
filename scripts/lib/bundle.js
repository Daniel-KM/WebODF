"use strict";

/**
 * Concatenation of the sources of the library, with or without its tests. The
 * order of the files comes from their dependencies, see lib/sources.js.
 */

var fs = require("fs"),
    path = require("path"),
    sources = require("./sources.js"),
    generated = require("./generated.js");

var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * The parts of the bundle, in the order they are concatenated. Each one keeps
 * the name of the file it comes from, so that a source map can be built.
 *
 * @param {boolean} withTests
 * @return {!Array.<{name: string, text: string}>}
 */
function parts(withTests) {
    var result = [{name: "webodfversion.js", text: generated.versionSource()}];
    sources.libraryFiles().forEach(function (file) {
        result.push({name: file, text: fs.readFileSync(file, "utf8")});
    });
    result.push({name: "webodf.css.js", text: generated.cssSource()});
    result.push({
        name: path.join(sources.libDir, "externs/JSZip.js"),
        text: fs.readFileSync(path.join(sources.libDir, "externs/JSZip.js"), "utf8")
    });
    if (withTests) {
        sources.testFiles().forEach(function (file) {
            result.push({name: file, text: fs.readFileSync(file, "utf8")});
        });
    }
    return result;
}

/**
 * @param {!Array.<{name: string, text: string}>} list
 * @return {string}
 */
function concatenate(list) {
    // IS_COMPILED_CODE tells the runtime that all the classes are already
    // loaded, so that loadClass() does not fetch them one by one. The
    // replacement keeps the line count, so that the source map stays valid.
    return list.map(function (part) {
        return part.text;
    }).join("\n").replace("var IS_COMPILED_CODE = false;",
        "var IS_COMPILED_CODE = true;");
}

/**
 * @param {number} value
 * @return {string}
 */
function encodeVlq(value) {
    var vlq = value < 0 ? ((-value) << 1) + 1 : (value << 1),
        result = "",
        digit;
    do {
        digit = vlq & 31;
        vlq = vlq >>> 5;
        if (vlq > 0) {
            digit = digit | 32;
        }
        result += BASE64.charAt(digit);
    } while (vlq > 0);
    return result;
}

/**
 * @param {boolean} withTests
 * @return {string}
 */
function build(withTests) {
    return concatenate(parts(withTests));
}

/**
 * Build the bundle and the source map that maps it back to the sources.
 *
 * The bundle is a plain concatenation, so every line of the output comes from
 * exactly one line of one source, at the same column: one segment per line is
 * enough, and the mappings are only the deltas of the index of the source.
 *
 * @param {boolean} withTests
 * @return {{code: string, map: !Object}}
 */
function buildWithMap(withTests) {
    var list = parts(withTests),
        names = [],
        contents = [],
        mappings = [],
        previousIndex = 0,
        previousLine = 0;
    list.forEach(function (part, index) {
        var lines = part.text.split("\n").length,
            line = 1;
        names.push(part.name);
        contents.push(part.text);
        // A segment holds four fields: the column of the output, the index of
        // the source, its line and its column. The index and the line are
        // running values, shared by the whole map: the first line of a part has
        // to bring the line back to zero, the next ones only move it by one.
        mappings.push("A" + encodeVlq(index - previousIndex)
            + encodeVlq(-previousLine) + "A");
        while (line < lines) {
            mappings.push("AACA");
            line += 1;
        }
        previousIndex = index;
        previousLine = lines - 1;
    });
    return {
        code: concatenate(list),
        map: {
            version: 3,
            sources: names,
            sourcesContent: contents,
            names: [],
            mappings: mappings.join(";")
        }
    };
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
exports.buildWithMap = buildWithMap;
