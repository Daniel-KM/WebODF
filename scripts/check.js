"use strict";

/**
 * Check the types of the library with the closure compiler. The library itself
 * is built by scripts/build.js: the compiler is used as a type checker only,
 * and it writes no output.
 *
 * With --tests the tests are checked too, as the target "compiled.js" of the
 * build with cmake does. reportUnknownTypes is then off, since the tests were
 * never written to hold up to it: the mocks they declare are partial on
 * purpose.
 *
 * Usage: node scripts/check.js [--tests]
 */

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    child = require("child_process"),
    sources = require("./lib/sources.js"),
    generated = require("./lib/generated.js"),
    closure = require("./lib/closure.js"),
    rootDir = path.resolve(__dirname, ".."),
    withTests = process.argv.indexOf("--tests") !== -1,
    // Declarations of the interfaces of a browser, in the order of the
    // original build. The file "externs/mediasource.js" is not used.
    externs = [
        "externs/w3c_dom1.js",
        "externs/w3c_dom2.js",
        "externs/w3c_dom3.js",
        "externs/w3c_elementtraversal.js",
        "externs/w3c_anim_timing.js",
        "externs/w3c_range.js",
        "externs/w3c_xml.js",
        "externs/w3c_css.js",
        "externs/w3c_event.js",
        "externs/window.js",
        "externs/gecko_xml.js",
        "externs/gecko_dom.js",
        "externs/ie_dom.js",
        "externs/gecko_event.js",
        "externs/ie_event.js",
        "externs/html5.js",
        "externs/iphone.js",
        "externs/fileapi.js",
        "externs.js"
    ];

/**
 * Write the generated sources in a temporary directory, since the compiler
 * reads files only.
 * @return {!{dir: string, version: string, css: string}}
 */
function writeGeneratedFiles() {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-check-")),
        version = path.join(dir, "webodfversion.js"),
        css = path.join(dir, "webodf.css.js");
    fs.writeFileSync(version, generated.versionSource());
    fs.writeFileSync(css, generated.cssSource());
    return {dir: dir, version: version, css: css};
}

/**
 * Arguments of the compiler, in a flag file: a command line with every source
 * would be too long on some systems.
 * @param {!{version: string, css: string}} files
 * @return {!Array.<string>}
 */
function flags(files) {
    var list = [
        "--warning_level", "VERBOSE",
        // The project ships its own copy of the externs of the browser, so the
        // ones bundled with the compiler are not used, to avoid duplicates.
        "--env", "CUSTOM",
        "--language_in", "ECMASCRIPT3",
        "--language_out", "ECMASCRIPT3",
        "--use_types_for_optimization",
        "--hide_warnings_for=synthetic",
        "--summary_detail_level", "3"
    ];
    closure.errorGroupsFor(closure.version).forEach(function (group) {
        if (!withTests || group !== "reportUnknownTypes") {
            list.push("--jscomp_error", group);
        }
    });
    closure.offGroups.forEach(function (group) {
        list.push("--jscomp_off", group);
    });
    // The order matters: an extern may use a type declared in a previous one.
    externs.forEach(function (name) {
        list.push("--externs", path.join(rootDir, "webodf/tools", name));
    });
    // Declarations of the libraries packaged with webodf.js.
    fs.readdirSync(path.join(rootDir, "webodf/externs")).forEach(function (name) {
        list.push("--externs", path.join(rootDir, "webodf/externs", name));
    });
    list.push("--js", files.version);
    sources.libraryFiles().forEach(function (file) {
        list.push("--js", file);
    });
    list.push("--js", files.css);
    if (withTests) {
        sources.testFiles().forEach(function (file) {
            list.push("--js", file);
        });
    }
    return list;
}

/**
 * Arguments of a second pass, over the libraries packaged with webodf.js, JSZip
 * for now. Their types are not checked, as they are not written for the
 * compiler, but their jsdoc has to parse, as the target "simplecompiled.js" of
 * the build with cmake compiles them: without this pass, a broken annotation is
 * only reported by the build with cmake.
 * @return {!Array.<string>}
 */
function packagedFlags() {
    var list = [
        "--compilation_level", "WHITESPACE_ONLY",
        "--warning_level", "VERBOSE",
        "--env", "CUSTOM",
        "--language_in", "ECMASCRIPT3",
        "--language_out", "ECMASCRIPT3",
        "--js_output_file", "/dev/null"
    ];
    // The same groups as the build with cmake, so that a broken annotation is
    // an error and not a warning. reportUnknownTypes is left out, as are the
    // checks of the types: WHITESPACE_ONLY does not run them.
    closure.errorGroupsFor(closure.version).forEach(function (group) {
        if (group !== "reportUnknownTypes") {
            list.push("--jscomp_error", group);
        }
    });
    closure.offGroups.forEach(function (group) {
        list.push("--jscomp_off", group);
    });
    fs.readdirSync(path.join(rootDir, "webodf/lib/externs")).forEach(function (name) {
        list.push("--js", path.join(rootDir, "webodf/lib/externs", name));
    });
    return list;
}

closure.jar().then(function (jarPath) {
    var files = writeGeneratedFiles(),
        flagFile = path.join(files.dir, "flagfile.txt"),
        args,
        result;
    args = flags(files);
    // The compiler splits a flag file on the white space, so a path holding a
    // space would be read as two arguments.
    args.forEach(function (arg) {
        if (/\s/.test(arg)) {
            throw new Error(`The path "${arg}" holds a space, that the flag`
                + " file of the compiler does not support.");
        }
    });
    fs.writeFileSync(flagFile, args.join("\n"));
    result = child.spawnSync("java", [
        "-jar", jarPath,
        "--flagfile", flagFile,
        "--define", "IS_COMPILED_CODE=true",
        // Only the checks are needed: the library is built by scripts/build.js.
        "--checks_only"
    ], {stdio: "inherit"});
    fs.rmSync(files.dir, {recursive: true, force: true});
    if (result.error) {
        console.error("Unable to run java, that the closure compiler needs: "
            + result.error.message);
        process.exit(1);
    }
    if (result.status === 0 && withTests) {
        result = child.spawnSync("java",
            ["-jar", jarPath].concat(packagedFlags()), {stdio: "inherit"});
    }
    process.exit(result.status === null ? 1 : result.status);
}).catch(function (err) {
    console.error(String(err));
    process.exit(1);
});
