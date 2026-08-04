/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */
/*global runtime, Node, window, DOMParser, webodfcore, xmldom, NodeFilter, alert,
   FileReader*/
runtime.loadClass("webodfcore.Zip");
runtime.loadClass("webodfcore.Base64");
runtime.loadClass("xmldom.RelaxNG");
runtime.loadClass("xmldom.RelaxNGParser");

/** This code runs a number of tests on an ODF document.
 * Ideally, it would use ODFContainer, but for now, it uses a custome container
 * for loaded odf files.
 */

function conformsToPattern(object, pattern) {
    "use strict";
    var i;
    if (object === undefined || object === null) {
        return pattern === null || (typeof pattern) !== "object";
    }
    for (i in pattern) {
        if (pattern.hasOwnProperty(i)) {
            if (!(object.hasOwnProperty(i) ||
                        (i === "length" && object.length)) ||
                    !conformsToPattern(object[i], pattern[i])) {
                return false;
            }
        }
    }
    return true;
}

function getConformingObjects(object, pattern, name) {
    "use strict";
    var c = [], i;
    name = name || "??";
    // we do not look inside long arrays and strings atm,
    // detection of these types could be better
    function accept(object) {
        return object !== null && object !== undefined &&
            (typeof object) === "object" &&
            (object.length === undefined || object.length < 1000) &&
            !(object instanceof Node) &&
            !(object.constructor && object.constructor === window.Uint8Array);
    }
    for (i in object) {
        if (object.hasOwnProperty(i) && accept(object[i])) {
            c = c.concat(getConformingObjects(object[i], pattern, i));
        }
    }
    if (conformsToPattern(object, pattern)) {
        c.push(object);
    }
    return c;
}
function parseXml(data, errorlog, name) {
    "use strict";
    function getText(e) {
        var str = "", c = e.firstChild;
        while (c) {
            if (c.nodeType === 3) {
                str += c.nodeValue;
            } else {
                str += getText(c);
            }
            c = c.nextSibling;
        }
        return str;
    }
    var str, parser, errorelements;
    try {
        str = runtime.byteArrayToString(data, "utf8");
        parser = new DOMParser();
        str = parser.parseFromString(str, "text/xml");
        if (str.documentElement.localName === "parsererror"
                || str.documentElement.localName === "html") {
            errorelements = str.getElementsByTagName("parsererror");
            if (errorelements.length > 0) {
                errorlog.push("invalid XML in " + name + ": " +
                    getText(errorelements[0]));
                str = null;
            }
        }
    } catch (err) {
        errorlog.push(err);
    }
    return str;
}

/*** the jobs / tests ***/

function ParseXMLJob() {
    "use strict";
    this.inputpattern = { file: { entries: [] } };
    this.outputpattern  = {
        file: { entries: [] },
        errors: { parseXmlErrors: [] },
        content_xml: null,
        manifest_xml: null,
        settings_xml: null,
        meta_xml: null,
        styles_xml: null
    };
    function parseXmlFiles(input, position, callback) {
        var e = input.file.entries,
            filename,
            ext,
            dom;
        if (position >= e.length) {
            return callback();
        }
        filename = e[position].filename;
        ext = filename.substring(filename.length - 4);
        if (ext === ".xml" || ext === ".rdf") {
            dom = parseXml(e[position].data, input.errors.parseXmlErrors,
                    filename);
            if (filename === "content.xml") {
                input.content_xml = dom;
            } else if (filename === "META-INF/manifest.xml") {
                input.manifest_xml = dom;
            } else if (filename === "styles.xml") {
                input.styles_xml = dom;
            } else if (filename === "meta.xml") {
                input.meta_xml = dom;
            } else if (filename === "settings.xml") {
                input.settings_xml = dom;
            }
            e[position].dom = dom;
        }
        window.setTimeout(function () {
            parseXmlFiles(input, position + 1, callback);
        }, 0);
    }
    this.run = function (input, callback) {
        input.errors = input.errors || {};
        input.errors.parseXmlErrors = [];
        input.content_xml = null;
        input.manifest_xml = null;
        input.styles_xml = null;
        input.meta_xml = null;
        input.settings_xml = null;
        parseXmlFiles(input, 0, callback);
    };
}
function UnpackJob() {
    "use strict";
    this.inputpattern = { file: { path: "", data: { length: 0 } } };
    this.outputpattern  = {
        file: { entries: [], dom: null },
        errors: { unpackErrors: [] }
    };
    function loadZipEntries(input, zip, position, callback) {
        if (position >= input.file.entries.length) {
            return callback();
        }
        var e = input.file.entries[position];
        // A name that ends with a slash is a directory of the zip, that holds
        // no bytes: asking for its content answered "not found", which said
        // that a package was broken when it was not.
        if (e.filename.charAt(e.filename.length - 1) === "/") {
            e.directory = true;
            return loadZipEntries(input, zip, position + 1, callback);
        }
        zip.load(e.filename, function (err, data) {
            if (err) {
                input.errors.unpackErrors.push(err);
            }
            e.error = err;
            e.data = data;
            window.setTimeout(function () {
                loadZipEntries(input, zip, position + 1, callback);
            }, 0);
        });
    }
    function loadZip(input, callback) {
        var zip = new webodfcore.Zip(input.file.path, function (err, zip) {
            if (err) {
                input.errors.unpackErrors.push(err);
                callback();
            } else {
                input.file.entries = zip.getEntries();
                loadZipEntries(input, zip, 0, callback);
            }
        });
        // only done to make jslint see the var used
        return zip;
    }
    function loadXml(input, callback) {
        input.file.dom = parseXml(input.file.data, input.errors.unpackErrors,
                input.file.name);
        callback();
    }
    this.run = function (input, callback) {
        input.errors = input.errors || {};
        input.errors.unpackErrors = [];
        input.file.dom = null;
        input.file.entries = [];

        if (input.file.data.length < 1) {
            input.errors.unpackErrors.push("Input data is empty.");
            return;
        }
        if (input.file.data[0] === 80) { // a ZIP file starts with 'P'
            loadZip(input, callback);
        } else {
            loadXml(input, callback);
        }
    };
}
function MimetypeTestJob() {
    "use strict";
    this.inputpattern = {
        file: { entries: [], dom: null },
        manifest_xml: null
    };
    this.outputpattern = { mimetype: "", errors: { mimetypeErrors: [] } };
    var manifestns = "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0";
    function getManifestMimetype(manifest) {
        if (!manifest) {
            return null;
        }
        var path, mimetype, node;
        node = manifest.documentElement.firstChild;
        while (node) {
            if (node.nodeType === 1 && node.localName === "file-entry" &&
                    node.namespaceURI === manifestns) {
                path = node.getAttributeNS(manifestns, "full-path");
                if (path === "/") {
                    mimetype = node.getAttributeNS(manifestns, "media-type");
                    break;
                }
            }
            node = node.nextSibling;
        }
        return mimetype;
    }
    this.run = function (input, callback) {
        input.mimetype = null;
        input.errors.mimetypeErrors = [];
        var mime = null,
            altmime,
            e = input.file.entries,
            i;
        if (input.file.dom) {
            mime = input.file.dom.documentElement.getAttributeNS(
                "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
                "mimetype"
            );
        } else {
            if (e.length < 1 || e[0].filename !== "mimetype") {
                input.errors.mimetypeErrors.push(
                    "First file in zip is not 'mimetype'"
                );
            }
            for (i = 0; i < e.length; i += 1) {
                if (e[i].filename === "mimetype") {
                    mime = runtime.byteArrayToString(e[i].data, "binary");
                    break;
                }
            }
            if (mime) {
                altmime = input.file.data.subarray(38, 38 + mime.length);
                altmime = runtime.byteArrayToString(altmime, "binary");
                if (mime !== altmime) {
                    input.errors.mimetypeErrors.push(
                        "mimetype should start at byte 38 in the zip file."
                    );
                }
            }
            // compare with mimetype from manifest_xml
            altmime = getManifestMimetype(input.manifest_xml);
            if (altmime !== mime) {
                input.errors.mimetypeErrors.push(
                    "manifest.xml has a different mimetype."
                );
            }
        }
        if (!mime) {
            input.errors.mimetypeErrors.push("No mimetype was found.");
        }
        input.mimetype = mime;
        callback();
    };
}
function VersionTestJob() {
    "use strict";
    this.inputpattern = {
        file: { dom: null },
        content_xml: null,
        styles_xml: null,
        meta_xml: null,
        settings_xml: null,
        manifest_xml: null
    };
    this.outputpattern = { version: "", errors: { versionErrors: [] } };
    var officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
    function getVersion(dom, filename, log, vinfo, filerequired) {
        var v, ns = officens;
        if (!dom) {
            if (filerequired) {
                log.push(filename + " is missing, so version cannot be found.");
            }
            return;
        }
        if (filename === "META-INF/manifest.xml") {
            ns = "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0";
        }
        if (!dom.documentElement.hasAttributeNS(ns, "version")) {
            if (vinfo.versionrequired) {
                log.push(filename + " has no version number.");
            }
            return;
        }
        v = dom.documentElement.getAttributeNS(ns, "version");
        if (vinfo.version === undefined) {
            vinfo.version = v;
            // version number is required since ODF 1.2
            vinfo.needversion = vinfo.version === "1.2";
            vinfo.versionSource = filename;
        } else if (v !== vinfo.version) {
            log.push(vinfo.versionSource + " and " + filename + " " +
                    " have  different version number.");
        }
    }
    this.run = function (input, callback) {
        input.errors.versionErrors = [];
        var log = input.errors.versionErrors,
            vinfo = {
                version: undefined,
                needversion: null,
                versionSource: null
            },
            contentxmlhasnoversionnumber;
        if (input.file.dom) {
            getVersion(input.file.dom, input.file.name, log, vinfo, true);
        } else {
            // until we know the version number, we cannot claim that
            // content.xml needs a version number
            getVersion(input.content_xml, "content.xml", log, vinfo, true);
            contentxmlhasnoversionnumber = vinfo.version === undefined;
            getVersion(input.manifest_xml, "META-INF/manifest.xml", log,
                    vinfo, true);
            getVersion(input.styles_xml, "styles.xml", log, vinfo);
            getVersion(input.meta_xml, "meta.xml", log, vinfo);
            getVersion(input.settings_xml, "settings.xml", log, vinfo);
            if (vinfo.needversion && contentxmlhasnoversionnumber) {
                log.push("content.xml has no version number.");
            }
        }
        if (vinfo.version === undefined) {
            log.push("No version of the standard is declared. One is required"
                + " from 1.2 on, so this document is of 1.1 or older, and it is"
                + " read against the schema of 1.1.");
        }
        input.version = vinfo.version;
        callback();
    };
}
function GetThumbnailJob() {
    "use strict";
    var base64 = new webodfcore.Base64();
    this.inputpattern = { file: { entries: [] }, errors: {}, mimetype: "" };
    this.outputpattern = { thumbnail: "", errors: { thumbnailErrors: [] } };
    this.run = function (input, callback) {
        input.thumbnail = null;
        input.errors.thumbnailErrors = [];
        var i, e = input.file.entries, mime = input.mimetype, thumb = null;
        if (/^application\/vnd\.oasis\.opendocument\.text/.test(mime)) {
            thumb = "application-vnd.oasis.opendocument.text.png";
        } else if (/^application\/vnd\.oasis\.opendocument\.spreadsheet/.test(mime)) {
            thumb = "application-vnd.oasis.opendocument.spreadsheet.png";
        } else if (/^application\/vnd\.oasis\.opendocument\.presentation/.test(mime)) {
            thumb = "application-vnd.oasis.opendocument.presentation.png";
        }
        for (i = 0; i < e.length; i += 1) {
            if (e[i].filename === "Thumbnails/thumbnail.png") {
                thumb = "data:image/png;base64," +
                    base64.convertUTF8ArrayToBase64(e[i].data);
                break;
            }
        }
        input.thumbnail = thumb;
        callback();
    };
}
/**
 * Names the namespaces of a document that the standard does not define, and
 * tells how many elements and attributes are written in each.
 *
 * A document is allowed to hold them: the standard says that a program writes
 * its additions under a name of its own, LibreOffice under "loext", and that a
 * reader that does not know them ignores them and reads on. Such a document is
 * of the standard, and it is what LibreOffice writes by default, but it does
 * not fit the schema, which describes what the standard defines and nothing
 * else. Saying so apart from the errors is the whole point: without it, a
 * document that is perfectly readable everywhere is reported as broken.
 */
function ExtensionsJob() {
    "use strict";
    this.inputpattern = { file: { entries: [] } };
    this.outputpattern = { extensions: [], errors: { extensionErrors: [] } };
    /**
     * A namespace is of the standard when OASIS defines it, and the standard
     * borrows a few from the w3c and from Dublin Core. Anything else is an
     * addition of a program, "urn:org:documentfoundation:..." for LibreOffice
     * and "urn:openoffice:names:experimental:..." for OpenOffice.
     */
    function isOfTheStandard(ns) {
        return ns === null
            || ns.indexOf("urn:oasis:names:tc:opendocument:") === 0
            || ns.indexOf("http://docs.oasis-open.org/ns/office/") === 0
            || ns.indexOf("http://www.w3.org/") === 0
            || ns.indexOf("http://purl.org/dc/") === 0;
    }
    function count(node, found) {
        var i, attributes;
        if (node.nodeType === 1) {
            if (!isOfTheStandard(node.namespaceURI)) {
                found[node.namespaceURI] = (found[node.namespaceURI] || 0) + 1;
            }
            attributes = node.attributes;
            for (i = 0; i < attributes.length; i += 1) {
                if (!isOfTheStandard(attributes[i].namespaceURI)
                        && attributes[i].namespaceURI !== null) {
                    found[attributes[i].namespaceURI] =
                        (found[attributes[i].namespaceURI] || 0) + 1;
                }
            }
        }
        for (i = 0; i < node.childNodes.length; i += 1) {
            count(node.childNodes[i], found);
        }
    }
    this.run = function (input, callback) {
        var found = {}, named = [], ns, i, entries;
        input.errors = input.errors || {};
        input.errors.extensionErrors = [];
        input.extensions = [];
        // A document is read as one file when it is written as one xml, and as
        // the entries of its package otherwise.
        if (input.file.dom) {
            count(input.file.dom.documentElement, found);
        } else {
            entries = input.file.entries || [];
            for (i = 0; i < entries.length; i += 1) {
                if (entries[i].dom) {
                    count(entries[i].dom.documentElement, found);
                }
            }
        }
        for (ns in found) {
            if (found.hasOwnProperty(ns)) {
                named.push(ns + ": " + found[ns] + " elements or attributes");
            }
        }
        named.sort();
        input.extensions = named;
        if (named.length) {
            input.errors.extensionErrors.push("This document holds additions"
                + " that the standard does not define, which it allows: a"
                + " reader that does not know them ignores them. They are why"
                + " a document of LibreOffice does not fit the schema. "
                + named.join("; ") + ".");
        }
        callback(input);
    };
}

function RelaxNGJob() {
    "use strict";
    // The schemas of every version of the standard, as published by OASIS: a
    // document names the one it was written to, and it is read against that
    // one. The versions of 1.2 and after are the approved ones, the "os",
    // where the two that were here before were of a draft, "cos01".
    var parser = new xmldom.RelaxNGParser(),
        validators = {},
        schemas = {
        "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0": {
            "1.0": "OpenDocument-manifest-schema-v1.0-os.rng",
            "1.1": "OpenDocument-manifest-schema-v1.1.rng",
            "1.2": "OpenDocument-v1.2-os-manifest-schema.rng",
            "1.3": "OpenDocument-v1.3-manifest-schema.rng",
            "1.4": "OpenDocument-v1.4-manifest-schema.rng"
        },
        "urn:oasis:names:tc:opendocument:xmlns:office:1.0": {
            "1.0": "OpenDocument-schema-v1.0-os.rng",
            "1.1": "OpenDocument-schema-v1.1.rng",
            "1.2": "OpenDocument-v1.2-os-schema.rng",
            "1.3": "OpenDocument-v1.3-schema.rng",
            "1.4": "OpenDocument-v1.4-schema.rng"
        }
    };
    this.inputpattern = { file: {dom: null}, version: null };
    this.outputpattern = { errors: { relaxngErrors: [] } };
    function loadValidator(ns, version, callback) {
        var rng = schemas.hasOwnProperty(ns)
            ? schemas[ns][version]
            : undefined;
        if (rng) {
            runtime.loadXML(rng, function (err, dom) {
                var relaxng;
                if (err) {
                    runtime.log(err);
                } else {
                    relaxng = new xmldom.RelaxNG();
                    err = parser.parseRelaxNGDOM(dom, relaxng.makePattern);
                    if (err) {
                        runtime.log(err);
                    } else {
                        relaxng.init(parser.rootPattern);
                    }
                }
                validators[ns] = validators[ns] || {};
                validators[ns][version] = relaxng;
                callback(relaxng);
            });
        } else {
            callback(null);
        }
    }
    /**
     * The schema a document is read against, by the version it names. A
     * document that names none is read against 1.1, as one was only required
     * from 1.2 on; the report says so, as the answer depends on it.
     */
    function schemaOf(ns, version) {
        if (!version && (ns === "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                || ns === "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0")) {
            version = "1.1";
        }
        return schemas.hasOwnProperty(ns)
            ? schemas[ns][version]
            : undefined;
    }
    function getValidator(ns, version, callback) {
        if (ns === "urn:oasis:names:tc:opendocument:xmlns:office:1.0" ||
                ns === "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0") {
            if (!version) {
                version = "1.1";
            }
        }
        if (validators[ns] && validators[ns][version]) {
            return callback(validators[ns][version]);
        }
        loadValidator(ns, version, callback);
    }
    function validate(log, dom, filename, version, callback) {
        var ns = dom.documentElement.namespaceURI,
            schema = schemaOf(ns, version);
        getValidator(ns, version, function (relaxng) {
            if (!relaxng) {
                // Nothing to read it against: say so rather than pass in
                // silence, which read as "nothing to report".
                log.push(filename + ": no schema is here for this version of"
                    + " the standard, so it was not read against one.");
                return callback();
            }
            var walker = dom.createTreeWalker(dom.firstChild, 0xFFFFFFFF, {
                    acceptNode: function () {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }, false),
                err;
            err = relaxng.validate(walker, function (err) {
                var i;
                if (err) {
                    for (i = 0; i < err.length; i += 1) {
                        log.push(filename + ", read against " + schema + ": "
                            + err[i]);
                    }
                }
                callback();
            });
            if (err) {
                runtime.log(err);
            }
        });
    }
    function validateEntries(log, entries, position, version, callback) {
        if (position >= entries.length) {
            return callback();
        }
        var e = entries[position];
        if (e.dom) {
            validate(log, e.dom, e.filename, version, function () {
                window.setTimeout(function () {
                    validateEntries(log, entries, position + 1, version,
                            callback);
                }, 0);
            });
        } else {
            validateEntries(log, entries, position + 1, version, callback);
        }
    }
    this.run = function (input, callback) {
        input.errors = input.errors || {};
        input.errors.relaxngErrors = [];
        if (input.file.dom) {
            validate(input.errors.relaxngErrors, input.file.dom,
                input.file.path, input.version, callback);
            return;
        }
        validateEntries(input.errors.relaxngErrors, input.file.entries, 0,
            input.version, callback);
    };
}

function DataRenderer(parentelement) {
    "use strict";
    var doc = parentelement.ownerDocument,
        element = doc.createElement("div"),
        lastrendertime,
        delayedRenderComing,
        renderinterval = 300; // minimal milliseconds between renders
    function clear(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    function addParagraph(div, text) {
        var p = doc.createElement("p");
        p.appendChild(doc.createTextNode(text));
        div.appendChild(p);
    }
    function addErrors(div, e, active) {
        var i, o;
        for (i in e) {
            if (e.hasOwnProperty(i)) {
                o = e[i];
                if (active && ((typeof o) === "string"
                        || o instanceof String)) {
                    addParagraph(div, o);
                } else if (o && (typeof o) === "object" &&
                        !(o instanceof Node) &&
                        !(o.constructor &&
                          o.constructor === window.Uint8Array)) {
                    addErrors(div, o, active || i === "errors");
                }
            }
        }
    }
    function renderFile(data) {
        var div = doc.createElement("div"),
            h1 = doc.createElement("h1"),
            icon = doc.createElement("img");
        div.style.clear = "both";
        div.appendChild(h1);
        div.appendChild(icon);
        h1.appendChild(doc.createTextNode(data.file.path));
        element.appendChild(div);
        if (data.thumbnail) {
            icon.src = data.thumbnail;
        }
        icon.style.width = "128px";
        icon.style.float = "left";
        icon.style.mozBoxShadow = icon.style.webkitBoxShadow =
            icon.style.boxShadow = "3px 3px 4px #000";
        icon.style.marginRight = icon.style.marginBottom = "10px";
        addParagraph(div, "mimetype: " + data.mimetype);
        addParagraph(div, "version: " + data.version);
        addParagraph(div, "document representation: " +
            ((data.file.dom) ? "single XML document" : "package"));
        addErrors(div, data, false);
    }
    function dorender(data) {
        clear(element);
        var i;
        for (i = 0; i < data.length; i += 1) {
            renderFile(data[i]);
        }
    }
    this.render = function render(data) {
        var now = Date.now();
        if (!lastrendertime || now - lastrendertime > renderinterval) {
            lastrendertime = now;
            dorender(data);
        } else if (!delayedRenderComing) {
            delayedRenderComing = true;
            window.setTimeout(function () {
                delayedRenderComing = false;
                lastrendertime = now + renderinterval;
                dorender(data);
            }, renderinterval);
        }
    };
    parentelement.appendChild(element);
}

function JobRunner(datarenderer) {
    "use strict";
    var jobrunner = this,
        jobtypes = [],
        data,
        busy = false,
        todo = [];

    jobtypes.push(new UnpackJob());
    jobtypes.push(new MimetypeTestJob());
    jobtypes.push(new GetThumbnailJob());
    jobtypes.push(new VersionTestJob());
    jobtypes.push(new ParseXMLJob());
    jobtypes.push(new ExtensionsJob());
    jobtypes.push(new RelaxNGJob());

    function run() {
        if (busy) {
            return;
        }
        var job = todo.shift();
        if (job) {
            busy = true;
            job.job.run(job.object, function () {
                busy = false;
                if (!conformsToPattern(job.object, job.job.outputpattern)) {
                    throw "Job does not give correct output.";
                }
                datarenderer.render(data);
                window.setTimeout(run, 0);
            });
        }
    }

    /*jslint unparam: true*/
    function update(ignore, callback) {
        var i, jobtype, j, inobjects, outobjects;
        todo = [];
        for (i = 0; i < jobtypes.length; i += 1) {
            jobtype = jobtypes[i];
            inobjects = getConformingObjects(data, jobtype.inputpattern);
            outobjects = getConformingObjects(data, jobtype.outputpattern);
            for (j = 0; j < inobjects.length; j += 1) {
                if (outobjects.indexOf(inobjects[j]) === -1) {
                    todo.push({job: jobtype, object: inobjects[j]});
                }
            }
        }
        if (todo.length > 0) {
            // run update again after all todos are done
            todo.push({job: jobrunner, object: null});
        }
        if (callback) {
            callback();
        } else {
            run();
        }
    }
    /*jslint unparam: false*/

    this.run = update;

    this.setData = function setData(newdata) {
        data = newdata;
        if (busy) {
            todo = [];
            todo.push({job: jobrunner, object: null});
        } else {
            update();
        }
    };
}
function LoadingFile(file) {
    "use strict";
    var data,
        error,
        readRequests = [];
    function load(callback) {
        var reader = new FileReader();
        reader.onloadend = function (evt) {
            data = runtime.byteArrayFromString(evt.target.result, "binary");
            error = evt.target.error && String(evt.target.error);
            var i = 0;
            for (i = 0; i < readRequests.length; i += 1) {
                readRequests[i]();
            }
            readRequests = undefined;
            reader = undefined;
            callback(error, data);
        };
        reader.readAsBinaryString(file);
    }
    this.file = file;
    this.readFile = function (callback) {
        function readFile() {
            if (error) {
                return callback(error);
            }
            if (data) {
                return callback(error, data);
            }
            readRequests.push(readFile);
        }
        readFile();
    };
    this.load = load;
}
function Docnosis(element) {
    "use strict";
    var doc = element.ownerDocument,
        form,
        diagnoses = doc.createElement("div"),
        openedFiles = {},
        datarenderer = new DataRenderer(diagnoses),
        jobrunner = new JobRunner(datarenderer),
        jobrunnerdata = [];

    function dragHandler(evt) {
        var over = evt.type === "dragover" && evt.target.nodeName !== "INPUT";
        if (over || evt.type === "drop") {
            evt.stopPropagation();
            evt.preventDefault();
        }
        if (evt.target.style) {
            evt.target.style.background = (over ? "#CCCCCC" : "inherit");
        }
    }

    function fileSelectHandler(evt) {
        // cancel event and hover styling
        dragHandler(evt);

        function diagnoseFile(file) {
            var loadingfile, path;
            path = file.name;
            loadingfile = new LoadingFile(file);
            openedFiles[path] = loadingfile;
            loadingfile.load(function (error, data) {
                if (error) {
                    runtime.log(error);
                }
                jobrunnerdata.push({file: {
                    path: path,
                    data: data
                }});
                jobrunner.setData(jobrunnerdata);
            });
        }
        // process all File objects
        var i, files, div;
        files = (evt.target && evt.target.files) ||
            (evt.dataTransfer && evt.dataTransfer.files);
        if (files) {
            for (i = 0; files && i < files.length; i += 1) {
                div = doc.createElement("div");
                diagnoses.appendChild(div);
                diagnoseFile(files[i]);
            }
        } else {
            alert("File(s) could not be opened in this browser.");
        }
    }

    function createForm() {
        var newform = doc.createElement("form"),
            fieldset = doc.createElement("fieldset"),
            legend = doc.createElement("legend"),
            input = doc.createElement("input");

        newform.appendChild(fieldset);
        fieldset.appendChild(legend);
        input.setAttribute("type", "file");
        input.setAttribute("name", "fileselect[]");
        input.setAttribute("multiple", "multiple");
        input.addEventListener("change", fileSelectHandler, false);
        fieldset.appendChild(input);
        fieldset.appendChild(doc.createTextNode("or drop files here"));
        legend.appendChild(doc.createTextNode("docnosis"));
        newform.addEventListener("dragover", dragHandler, false);
        newform.addEventListener("dragleave", dragHandler, false);
        newform.addEventListener("drop", fileSelectHandler, false);
        return newform;
    }

    function enhanceRuntime() {
        var readFile = runtime.readFile;
        runtime.readFile = function (path, encoding, callback) {
            if (openedFiles.hasOwnProperty(path)) {
                return openedFiles[path].readFile(callback);
            }
            return readFile(path, encoding, callback);
        };
    }

    /**
     * Read a document by its address rather than from the one who reads the
     * page: "index.html?file=document.odt". A page that is given a document
     * this way is one a link may lead to, and it is how the tests run it.
     */
    this.diagnose = function (path) {
        var div = doc.createElement("div");
        diagnoses.appendChild(div);
        runtime.readFile(path, "binary", function (error, data) {
            if (error) {
                runtime.log(String(error));
                return;
            }
            jobrunnerdata.push({file: {
                path: path,
                data: data
            }});
            jobrunner.setData(jobrunnerdata);
        });
    };

    form = createForm();
    element.appendChild(form);
    element.appendChild(diagnoses);
    enhanceRuntime();
}
