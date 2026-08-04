"use strict";

/**
 * Run the add-on of Chrome and check that it shows a document.
 *
 * The package is built here, from "programs/opendocumentviewer-webext" and the library
 * of "dist", then a document is served over http and the browser is asked for
 * it. The add-on has to send it to its viewer, that has to draw it.
 *
 * This catches what neither the linter nor the compiler sees: a rule Chrome
 * refuses is dropped without a word, and the document is downloaded as if the
 * add-on were not installed.
 *
 * Firefox is not driven here: it takes web-ext, that is not a dependency of
 * this project, see "README-Building.md".
 *
 * Usage: node scripts/test-extension.js
 */

var fs = require("fs"),
    os = require("os"),
    http = require("http"),
    path = require("path"),
    rootDir = path.resolve(__dirname, ".."),
    extensionDir = path.join(rootDir, "programs/opendocumentviewer-webext"),
    libraryPath = path.join(rootDir, "dist/webodf.js"),
    // A document that is versioned, so that the test needs no other build.
    documentPath = path.join(rootDir, "programs/benchmark/1page.odt"),
    browserPaths = [
        process.env.WEBODF_BROWSER,
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/opt/google/chrome/chrome"
    ],
    port = 8734;

/**
 * The first browser found among the usual paths.
 * @return {?string}
 */
function findBrowser() {
    var found = null;
    browserPaths.forEach(function (candidate) {
        if (!found && candidate && fs.existsSync(candidate)) {
            found = candidate;
        }
    });
    return found;
}

/**
 * Write the package of Chrome in a directory of its own.
 * @return {string}
 */
function buildPackage() {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "webodf-extension-")),
        manifest = fs.readFileSync(
            path.join(extensionDir, "manifest-chrome.json.in"),
            "utf8"
        );
    fs.mkdirSync(path.join(dir, "skin/default"), {recursive: true});
    fs.writeFileSync(path.join(dir, "manifest.json"),
        manifest.replace("@WEBODF_MANIFEST_VERSION@", "0.0.0"));
    ["background-chrome.js", "viewer.html", "viewer.css", "viewer.js"].forEach(
        function (name) {
            fs.copyFileSync(path.join(extensionDir, name), path.join(dir, name));
        }
    );
    fs.copyFileSync(path.join(extensionDir, "skin/default/icon.png"),
        path.join(dir, "skin/default/icon.png"));
    fs.copyFileSync(libraryPath, path.join(dir, "webodf.js"));
    return dir;
}

/**
 * Serve the document under a type that says nothing, so that the add-on has to
 * read the name of the file, as it does on a server that knows no ODF.
 * @return {!http.Server}
 */
function serve() {
    var body = fs.readFileSync(documentPath);
    return http.createServer(function (request, response) {
        response.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Length": body.length
        });
        response.end(body);
    }).listen(port);
}

function main() {
    var browser = findBrowser(),
        playwright,
        server,
        directory;
    if (!browser) {
        console.error("No browser found. Set WEBODF_BROWSER to the path of a"
            + " chromium, or install one with: npx playwright install chromium");
        process.exit(1);
    }
    if (!fs.existsSync(libraryPath)) {
        console.error("The library is missing: run \"npm run build\" first.");
        process.exit(1);
    }
    playwright = require("playwright-core");
    directory = buildPackage();
    server = serve();
    return playwright.chromium.launchPersistentContext(
        fs.mkdtempSync(path.join(os.tmpdir(), "webodf-profile-")),
        {
            executablePath: browser,
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-gpu",
                "--disable-extensions-except=" + directory,
                "--load-extension=" + directory
            ]
        }
    ).then(function (context) {
        // The rule is written by the service worker once it is installed, so
        // the document is only asked for after it has run. The worker may
        // already be there, and the event would then never come.
        return (context.serviceWorkers().length > 0
            ? Promise.resolve()
            : context.waitForEvent("serviceworker", {timeout: 30000}))
            .then(function () {
                return context.serviceWorkers()[0].evaluate(function () {
                    return chrome.declarativeNetRequest.getDynamicRules();
                });
            })
            .then(function (rules) {
                if (!rules || rules.length === 0) {
                    throw new Error("the add-on wrote no rule to redirect with");
                }
                return context.newPage();
            })
            .then(function (page) {
                return page.goto("http://127.0.0.1:" + port + "/1page.odt", {
                    waitUntil: "load",
                    timeout: 30000
                }).then(function () {
                    return page.waitForSelector("#odf *", {timeout: 30000});
                }).then(function () {
                    return page.url();
                });
            })
            .then(function (url) {
                return context.close().then(function () {
                    return url;
                });
            });
    }).then(function (url) {
        server.close();
        fs.rmSync(directory, {recursive: true, force: true});
        if (url.indexOf("viewer.html") === -1) {
            console.error("The add-on did not send the document to its viewer,"
                + " the page is at " + url);
            process.exit(1);
        }
        console.log("The add-on showed the document: " + url.slice(0, 80));
    }).catch(function (err) {
        server.close();
        console.error("The add-on did not show the document: " + String(err));
        process.exit(1);
    });
}

main();
