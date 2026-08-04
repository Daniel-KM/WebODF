"use strict";

/**
 * Build the library "webodf.js", without cmake and without the closure
 * compiler: the sources are concatenated in the order of their dependencies,
 * as the compiled file of the original build was, then minified with terser.
 *
 * Usage: node scripts/build.js [--no-minify] [--output path]
 */

var fs = require("fs"),
    path = require("path"),
    bundle = require("./lib/bundle.js"),
    sources = require("./lib/sources.js"),
    rootDir = path.resolve(__dirname, ".."),
    distDir = path.join(rootDir, "dist"),
    outputIndex = process.argv.indexOf("--output"),
    // The build with cmake writes it in its own directory, see
    // "webodf/CMakeLists.txt": both builds run this script, so that they
    // produce the same file.
    outputPath = outputIndex === -1
        ? path.join(distDir, "webodf.js")
        : path.resolve(process.argv[outputIndex + 1]),
    headerIndex = process.argv.indexOf("--header"),
    // A release replaces the license of the compiled file, as the build with
    // cmake does with -DHEADERCOMPILED_FILE.
    headerPath = headerIndex === -1
        ? path.join(sources.libDir, "HeaderCompiled.js")
        : path.resolve(process.argv[headerIndex + 1]),
    minify = process.argv.indexOf("--no-minify") === -1;

function main() {
    var code = bundle.library(),
        // License of the compiled file, that keeps the exception of the AGPL
        // for the pages that only call the library.
        header = fs.readFileSync(headerPath, "utf8"),
        terser;
    if (!/var IS_COMPILED_CODE = true;/.test(code)) {
        throw new Error("IS_COMPILED_CODE was not set, the runtime would try to load the classes.");
    }
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    }
    if (!minify) {
        fs.writeFileSync(outputPath, header + code);
        console.log(`Built ${outputPath} (${header.length + code.length} bytes, not minified)`);
        return Promise.resolve();
    }
    terser = require("terser");
    // The declaration is dropped and the value passed as a definition instead:
    // terser only folds an identifier it holds as a constant, and a declared
    // variable is not one. Folding it removes the loader of the classes and the
    // runner of the scripts from the compiled library, that both read a file
    // with eval() and are only used on the sources.
    code = code.replace("var IS_COMPILED_CODE = true;", "");
    // ecma 5 because the sources are still written for ECMAScript 3. Three
    // passes give the same size as the previous closure compiler, that is eight
    // percent smaller than a single pass.
    return terser.minify(code, {
        ecma: 5,
        compress: {passes: 3, global_defs: {IS_COMPILED_CODE: true}},
        mangle: true,
        // The license of each source file is dropped: the header of the
        // compiled file covers the whole result.
        format: {comments: false}
    }).then(function (result) {
        fs.writeFileSync(outputPath, header + result.code);
        console.log(`Built ${outputPath} (${header.length + result.code.length}`
            + ` bytes, from ${code.length} bytes)`);
    });
}

main().catch(function (err) {
    console.error(String(err));
    process.exit(1);
});
