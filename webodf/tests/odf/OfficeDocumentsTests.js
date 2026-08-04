/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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


/*global runtime, webodfcore, odf*/

/**
 * The templates of LibreOffice, read as they are written.
 *
 * A test writes a small document and reads it back, which tells whether the
 * library holds to itself; these are written by an office, and tell whether
 * it still reads what an office writes. They are the templates LibreOffice
 * ships, under the Mozilla Public License, see "README" beside them.
 * @constructor
 * @param {webodfcore.UnitTestRunner} runner
 * @implements {webodfcore.UnitTest}
 */
odf.OfficeDocumentsTests = function OfficeDocumentsTests(runner) {
    "use strict";
    var t, r = runner,
        drawns = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
        tablens = "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
    this.setUp = function () {
        t = {};
    };
    this.tearDown = function () {
        t = {};
    };
    /**
     * Read one document and answer what it holds.
     * @param {!string} path
     * @param {!string} kind the name of the element of the body
     * @param {!function():undefined} callback
     * @return {undefined}
     */
    function readOne(path, kind, callback) {
        t.odf = new odf.OdfContainer(path, function (container) {
            t.odf = container;
            r.shouldBe(t, "t.odf.state", "odf.OdfContainer.DONE");
            t.kind = t.odf.getDocumentType();
            t.expected = kind;
            r.shouldBe(t, "t.kind", "t.expected");
            // Every one of them is a template, which the mimetype says.
            // A template says so in its mimetype; a document of the same
            // kind does not, and is read the same way.
            t.template = t.odf.isTemplate();
            t.expectTemplate = path.indexOf(".ot") !== -1;
            r.shouldBe(t, "t.template", "t.expectTemplate");
            callback();
        });
    }
    function readTheLetterOfAnOffice(callback) {
        readOne("documents/libreoffice-business-letter.ott", "text", function () {
            // The letter is written of frames, that hold the sender and the
            // logo, and of paragraphs.
            t.paragraphs = t.odf.rootElement.body.getElementsByTagNameNS(
                textns,
                "p"
            ).length;
            r.shouldBe(t, "t.paragraphs > 5", "true");
            callback();
        });
    }
    function readTheCurriculumOfAnOffice(callback) {
        readOne("documents/libreoffice-cv.ott", "text", callback);
    }
    /**
     * Answer that the document holds pages, and go on.
     * @param {!function():undefined} callback
     * @return {!function():undefined}
     */
    function hasPages(callback) {
        return function () {
            t.pages = t.odf.rootElement.body.getElementsByTagNameNS(
                drawns,
                "page"
            ).length;
            r.shouldBe(t, "t.pages > 0", "true");
            callback();
        };
    }
    function readThePresentationOfAnOffice(callback) {
        readOne("documents/libreoffice-beehive.otp", "presentation",
            hasPages(callback));
    }
    function readTheDrawingOfAnOffice(callback) {
        // A drawing holds its pages in "office:drawing", which was read as
        // nothing at all before: the document was refused for want of a body
        // it was taken to have none of.
        readOne("documents/libreoffice-bpmn.otg", "drawing",
            hasPages(callback));
    }
    function readTheSpreadsheetOfAnOffice(callback) {
        readOne("documents/libreoffice-formats.ods", "spreadsheet",
            function () {
                // Three sheets of cells, that the numbers of a spreadsheet
                // are written in every format of.
                t.sheets = t.odf.rootElement.body.getElementsByTagNameNS(
                    tablens,
                    "table"
                ).length;
                r.shouldBe(t, "t.sheets", "3");
                callback();
            });
    }
    function readThePagesOfAPresentation(callback) {
        readOne("documents/libreoffice-bullets.odp", "presentation",
            hasPages(callback));
    }
    function readThePagesOfADrawing(callback) {
        readOne("documents/libreoffice-fit-to-frame.odg", "drawing",
            hasPages(callback));
    }
    this.tests = function () {
        return [];
    };
    this.asyncTests = function () {
        return r.name([
            readTheLetterOfAnOffice,
            readTheCurriculumOfAnOffice,
            readThePresentationOfAnOffice,
            readTheDrawingOfAnOffice,
            readTheSpreadsheetOfAnOffice,
            readThePagesOfAPresentation,
            readThePagesOfADrawing
        ]);
    };
};
odf.OfficeDocumentsTests.prototype.description = function () {
    "use strict";
    return "Read the documents an office writes.";
};
