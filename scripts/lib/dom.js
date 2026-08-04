"use strict";

/**
 * A dom close to the one of a browser, from jsdom, added to the globals of
 * node. The package xmldom, that the library uses by default, has no range and
 * no tree walker, so the tests that walk a document are skipped without this.
 */

/**
 * Add the interfaces of a dom to the global object, when jsdom is installed.
 * @return {boolean} true when the dom is available
 */
function install() {
    var JSDOM, window, names;
    try {
        JSDOM = require("jsdom").JSDOM;
    } catch (ignore) {
        return false;
    }
    window = new JSDOM("<html></html>").window;
    names = [
        "DOMParser", "XMLSerializer", "Node", "NodeFilter", "Element", "Attr",
        "Document", "DocumentFragment", "Text", "Range", "NodeIterator",
        "TreeWalker", "XPathResult", "DOMException", "getComputedStyle"
    ];
    names.forEach(function (name) {
        if (window[name] !== undefined) {
            global[name] = window[name];
        }
    });
    // The document and the window of the page, that some tests use to build
    // their fixtures.
    global.document = window.document;
    global.window = window;
    // The packaged libraries, JSZip for now, attach themselves to the window
    // when there is one, while the library reads them as a global. The same
    // object is shared, so that both see the same packages.
    global.externs = {};
    window.externs = global.externs;
    return true;
}

exports.install = install;
