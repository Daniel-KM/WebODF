"use strict";

/**
 * Ordered list of the source files of the library, from the dependencies
 * declared in "webodf/lib/manifest.json". The files are concatenated in this
 * order, so a file must come after all the files it uses.
 */

var fs = require("fs"),
    path = require("path"),
    libDir = path.resolve(__dirname, "../../webodf/lib"),
    testsDir = path.resolve(__dirname, "../../webodf/tests"),
    manifestPath = path.join(libDir, "manifest.json");

/**
 * Convert a class name of the manifest into the path of its file.
 * @param {string} name  for example "odf.OdfCanvas"
 * @return {string}
 */
function fileOfClass(name) {
    return path.join(libDir, name.replace(/\./g, "/") + ".js");
}

/**
 * Sort the classes of the manifest so that each one comes after the classes it
 * depends on. The dependencies of the manifest are not ordered, so the sort is
 * stable on the names to get the same output on every run.
 * @return {!Array.<string>}
 */
function sortedClasses() {
    var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")),
        names = Object.keys(manifest).sort(),
        done = {},
        visiting = {},
        sorted = [];

    function visit(name, from) {
        if (done[name]) {
            return;
        }
        if (visiting[name]) {
            throw new Error("Circular dependency on " + name + " from " + from);
        }
        if (!manifest.hasOwnProperty(name)) {
            throw new Error("Unknown dependency " + name + " of " + from);
        }
        visiting[name] = true;
        manifest[name].slice().sort().forEach(function (dependency) {
            visit(dependency, name);
        });
        visiting[name] = false;
        done[name] = true;
        sorted.push(name);
    }

    names.forEach(function (name) {
        visit(name, "manifest");
    });
    return sorted;
}

// Classes of the manifest that no other class may use: the command line tools
// run in node only and the Relax NG validator is not used by the viewer.
var unusedClasses = [
    "odf.CommandLineTools",
    "xmldom.RelaxNG",
    "xmldom.RelaxNG2",
    "xmldom.RelaxNGParser"
];

// Classes added by the build itself, after the library: the packaged JSZip is
// used at call time only, so its position does not matter.
var appendedClasses = ["externs.JSZip"];

var excludedClasses = unusedClasses.concat(appendedClasses);

/**
 * Files of the library, in the order they must be concatenated. The runtime
 * comes first, since every other file uses it.
 * @return {!Array.<string>}
 */
function libraryFiles() {
    var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")),
        files = [path.join(libDir, "runtime.js")];
    // An unused class must be used by no other one, else its file would be
    // missing from the library while something needs it.
    Object.keys(manifest).forEach(function (name) {
        if (excludedClasses.indexOf(name) !== -1) {
            return;
        }
        manifest[name].forEach(function (dependency) {
            if (unusedClasses.indexOf(dependency) !== -1) {
                throw new Error(name + " uses " + dependency
                    + ", that is excluded from the library.");
            }
        });
    });
    sortedClasses().forEach(function (name) {
        var file = fileOfClass(name);
        if (excludedClasses.indexOf(name) === -1 && files.indexOf(file) === -1) {
            files.push(file);
        }
    });
    return files;
}

// Tests, in the order of the original build: the helpers come first and
// "tests.js", that runs them all, comes last.
var testFileNames = [
    "webodfcore/UnitTester.js",
    "webodfcore/ZipTests.js",
    "webodfcore/Base64Tests.js",
    "webodfcore/CursorTests.js",
    "webodfcore/DomUtilsTests.js",
    "webodfcore/EventSubscriptionsTests.js",
    "webodfcore/PositionIteratorTests.js",
    "webodfcore/RuntimeTests.js",
    "webodfcore/StepIteratorTests.js",
    "gui/DirectFormattingControllerTests.js",
    "gui/GuiStepUtilsTests.js",
    "gui/MetadataControllerTests.js",
    "gui/SelectionControllerTests.js",
    "gui/StyleSummaryTests.js",
    "gui/TextControllerTests.js",
    "gui/ImageControllerTests.js",
    "gui/TrivialUndoManagerTests.js",
    "gui/UndoStateRulesTests.js",
    "odf/StyleParseUtilsTests.js",
    "odf/StyleCacheTests.js",
    "odf/FormattingTests.js",
    "odf/LayoutTests.js",
    "odf/ListStyleToCssTests.js",
    "odf/ObjectNameGeneratorTests.js",
    "odf/MaliciousDocumentTests.js",
    "odf/OdfContainerTests.js",
    "odf/OdfContainerSafetyTests.js",
    "odf/OdfUtilsTests.js",
    "odf/StyleInfoTests.js",
    "odf/TextStyleApplicatorTests.js",
    "ops/OperationTestHelper.js",
    "ops/OdtDocumentTests.js",
    "ops/OperationTests.js",
    "ops/SessionTests.js",
    "ops/OdtStepsTranslatorTests.js",
    "ops/TransformationTests.js",
    "ops/TransformerTests.js",
    "xmldom/LSSerializerTests.js",
    "xmldom/XPathTests.js",
    "tests.js"
];

/**
 * Files of the tests, in the order they must be concatenated.
 * @return {!Array.<string>}
 */
function testFiles() {
    return testFileNames.map(function (name) {
        return path.join(testsDir, name);
    });
}

exports.libDir = libDir;
exports.testsDir = testsDir;
exports.testFiles = testFiles;
exports.fileOfClass = fileOfClass;
exports.libraryFiles = libraryFiles;
