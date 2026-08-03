"use strict";

/**
 * Build the library "webodf.js", without cmake and without the closure
 * compiler: the sources are concatenated in the order of their dependencies,
 * as the compiled file of the original build was, then minified with terser.
 *
 * Usage: node scripts/build.js [--no-minify]
 */

var fs = require("fs"),
    path = require("path"),
    sources = require("./lib/sources.js"),
    generated = require("./lib/generated.js"),
    rootDir = path.resolve(__dirname, ".."),
    distDir = path.join(rootDir, "dist"),
    outputPath = path.join(distDir, "webodf.js"),
    minify = process.argv.indexOf("--no-minify") === -1;

/**
 * Concatenate the header, the generated files, the library and the packaged
 * dependencies. IS_COMPILED_CODE tells the runtime that all the classes are
 * already loaded, so that loadClass() does not fetch them one by one.
 * @return {string}
 */
function bundle() {
    var parts = [generated.versionSource()];
    sources.libraryFiles().forEach(function (file) {
        parts.push(fs.readFileSync(file, "utf8"));
    });
    parts.push(generated.cssSource());
    parts.push(fs.readFileSync(path.join(sources.libDir, "externs/JSZip.js"), "utf8"));
    return parts.join("\n").replace("var IS_COMPILED_CODE = false;",
        "var IS_COMPILED_CODE = true;");
}

function main() {
    var code = bundle(),
        // License of the compiled file, that keeps the exception of the AGPL
        // for the pages that only call the library.
        header = fs.readFileSync(path.join(sources.libDir, "HeaderCompiled.js"), "utf8"),
        terser;
    if (!/var IS_COMPILED_CODE = true;/.test(code)) {
        throw new Error("IS_COMPILED_CODE was not set, the runtime would try to load the classes.");
    }
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }
    if (!minify) {
        fs.writeFileSync(outputPath, header + code);
        console.log("Built " + outputPath + " (" + (header.length + code.length)
            + " bytes, not minified)");
        return Promise.resolve();
    }
    terser = require("terser");
    // ecma 5 because the sources are still written for ECMAScript 3. Three
    // passes give the same size as the previous closure compiler, that is
    // eight percent smaller than a single pass.
    return terser.minify(code, {
        ecma: 5,
        compress: {passes: 3},
        mangle: true,
        // The license of each source file is dropped: the header of the
        // compiled file covers the whole result.
        format: {comments: false}
    }).then(function (result) {
        fs.writeFileSync(outputPath, header + result.code);
        console.log("Built " + outputPath + " (" + (header.length + result.code.length)
            + " bytes, from " + code.length + " bytes)");
    });
}

main().catch(function (err) {
    console.error(String(err));
    process.exit(1);
});
