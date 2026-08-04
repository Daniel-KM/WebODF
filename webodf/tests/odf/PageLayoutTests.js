/**
 * Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
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
 * The pages a text is drawn over: their size, their number, and the paragraphs
 * the document asks to be written on a new one.
 * @constructor
 * @param {!webodfcore.UnitTestRunner} runner
 * @implements {webodfcore.UnitTest}
 */
odf.PageLayoutTests = function PageLayoutTests(runner) {
    "use strict";
    var r = runner,
        t,
        officens = odf.Namespaces.officens,
        webodfhelperns = "urn:webodf:names:helper";

    /**
     * Put the styles and the text of a document written as one string of xml in
     * a container, and draw it over pages, one column to a page.
     * @param {!string} xml the children of "office:document-content"
     * @param {!function():undefined} callback
     * @return {undefined}
     */
    function draw(xml, callback) {
        var container = new odf.OdfContainer(
                odf.OdfContainer.DocumentType.TEXT
            ),
            root = container.rootElement,
            parsed = runtime.parseXML(
                "<office:document-content"
                    + " xmlns:office=\"" + officens + "\""
                    + " xmlns:style=\"" + odf.Namespaces.stylens + "\""
                    + " xmlns:fo=\"" + odf.Namespaces.fons + "\""
                    + " xmlns:text=\"" + odf.Namespaces.textns + "\">"
                    + xml
                    + "</office:document-content>"
            ),
            doc = root.ownerDocument;

        /**
         * @param {!Element} into
         * @param {!string} name
         * @return {undefined}
         */
        function fill(into, name) {
            var found = parsed.documentElement.getElementsByTagNameNS(officens,
                    name),
                copy,
                i;
            while (into.firstChild) {
                into.removeChild(into.firstChild);
            }
            for (i = 0; i < found.length; i += 1) {
                copy = doc.importNode(found.item(i), true);
                while (copy.firstChild) {
                    into.appendChild(copy.firstChild);
                }
            }
        }
        fill(root.styles, "styles");
        fill(root.automaticStyles, "automatic-styles");
        fill(root.masterStyles, "master-styles");
        fill(root.body.getElementsByTagNameNS(officens, "text")[0], "text");
        container.saveAs("out/pagelayouttests.odt", function () {
            t.odfCanvas.addListener("statereadychange", function () {
                callback();
            });
            t.odfCanvas.setPaginated(true);
            t.odfCanvas.setPageMode("columns");
            t.odfCanvas.setOdfContainer(container);
        });
    }

    /**
     * The sheets of the pages, from the first page to the last.
     * @return {!Array.<!{left:!number,width:!number,height:!number}>}
     */
    function sheets() {
        var found = t.odfCanvas.odfContainer().rootElement.ownerDocument
                .getElementsByClassName("webodf-pageSheet"),
            boxes = [],
            i;
        for (i = 0; i < found.length; i += 1) {
            boxes.push(found.item(i).getBoundingClientRect());
        }
        boxes.sort(function (a, b) {
            return a.left - b.left;
        });
        return boxes.map(function (box) {
            return {
                left: Math.round(box.left),
                width: Math.round(box.width),
                height: Math.round(box.height)
            };
        });
    }

    /**
     * A document of two page layouts, one upright and one laid on its side.
     * @param {!string} body
     * @return {!string}
     */
    function twoPageLayouts(body) {
        return "<office:styles>"
            + "<style:style style:name=\"Standard\""
            + " style:family=\"paragraph\"/>"
            + "</office:styles>"
            + "<office:automatic-styles>"
            + "<style:page-layout style:name=\"pmUp\">"
            + "<style:page-layout-properties fo:page-width=\"8in\""
            + " fo:page-height=\"10in\" fo:margin-top=\"0.5in\""
            + " fo:margin-bottom=\"0.5in\" fo:margin-left=\"0.5in\""
            + " fo:margin-right=\"0.5in\"/>"
            + "</style:page-layout>"
            + "<style:page-layout style:name=\"pmSide\">"
            + "<style:page-layout-properties fo:page-width=\"10in\""
            + " fo:page-height=\"8in\" fo:margin-top=\"0.5in\""
            + " fo:margin-bottom=\"0.5in\" fo:margin-left=\"0.5in\""
            + " fo:margin-right=\"0.5in\"/>"
            + "</style:page-layout>"
            + "<style:style style:name=\"Turn\" style:family=\"paragraph\""
            + " style:parent-style-name=\"Standard\""
            + " style:master-page-name=\"OnItsSide\"/>"
            + "</office:automatic-styles>"
            + "<office:master-styles>"
            + "<style:master-page style:name=\"Upright\""
            + " style:page-layout-name=\"pmUp\"/>"
            + "<style:master-page style:name=\"OnItsSide\""
            + " style:page-layout-name=\"pmSide\"/>"
            + "</office:master-styles>"
            + "<office:body><office:text>" + body
            + "</office:text></office:body>";
    }

    /**
     * A document whose headings of the second rank lean on those of the first,
     * which are written on a page of their own while they are not.
     * @param {!string} body
     * @return {!string}
     */
    function headingsThatLean(body) {
        return "<office:styles>"
            + "<style:style style:name=\"Standard\""
            + " style:family=\"paragraph\"/>"
            + "<style:style style:name=\"Heading1\" style:family=\"paragraph\""
            + " style:parent-style-name=\"Standard\">"
            + "<style:paragraph-properties fo:break-before=\"page\"/>"
            + "</style:style>"
            + "<style:style style:name=\"Heading2\" style:family=\"paragraph\""
            + " style:parent-style-name=\"Heading1\">"
            + "<style:paragraph-properties fo:break-before=\"auto\"/>"
            + "</style:style>"
            + "<style:style style:name=\"Heading3\" style:family=\"paragraph\""
            + " style:parent-style-name=\"Heading2\"/>"
            + "</office:styles>"
            + "<office:automatic-styles>"
            + "<style:page-layout style:name=\"pmUp\">"
            + "<style:page-layout-properties fo:page-width=\"8in\""
            + " fo:page-height=\"10in\" fo:margin-top=\"0.5in\""
            + " fo:margin-bottom=\"0.5in\" fo:margin-left=\"0.5in\""
            + " fo:margin-right=\"0.5in\"/>"
            + "</style:page-layout>"
            + "</office:automatic-styles>"
            + "<office:master-styles>"
            + "<style:master-page style:name=\"Upright\""
            + " style:page-layout-name=\"pmUp\"/>"
            + "</office:master-styles>"
            + "<office:body><office:text>" + body
            + "</office:text></office:body>";
    }

    /**
     * @param {!string} style
     * @param {!number} count
     * @return {!string}
     */
    function paragraphs(style, count) {
        var text = "",
            i;
        for (i = 0; i < count; i += 1) {
            text += "<text:p text:style-name=\"" + style + "\">"
                + "Line " + (i + 1) + " of the text of the test."
                + "</text:p>";
        }
        return text;
    }

    /**
     * @param {!string} name
     * @return {?Element}
     */
    function paragraphOfStyle(name) {
        var text = t.odfCanvas.odfContainer().rootElement.body
                .getElementsByTagNameNS(officens, "text")[0],
            found = text.getElementsByTagNameNS(odf.Namespaces.textns, "p"),
            i;
        for (i = 0; i < found.length; i += 1) {
            if (found.item(i).getAttributeNS(odf.Namespaces.textns,
                    "style-name") === name) {
                return /**@type{!Element}*/(found.item(i));
            }
        }
        return null;
    }

    /**
     * The pages of a run written on another master page are of the size that
     * master page gives them, upright or laid on their side.
     * @param {!function():undefined} callback
     * @return {undefined}
     */
    function pagesTakeTheSizeOfTheirMasterPage(callback) {
        draw(twoPageLayouts(paragraphs("Standard", 40)
                + "<text:p text:style-name=\"Turn\">On its side.</text:p>"
                + paragraphs("Standard", 10)), function () {
            var boxes = sheets(),
                /**@type{!Array.<!string>}*/
                sizes = boxes.map(function (box) {
                    return box.width + "x" + box.height;
                }),
                /**@type{!Array.<!number>}*/
                gaps = boxes.slice(1).map(function (box, index) {
                    return box.left - (boxes[index].left + boxes[index].width);
                });
            // How many pages the text takes is of the machine, as a line of
            // another width holds another number of words: what is asked
            // here is that a page is of the size its master page gives it,
            // upright or laid on its side, and that the pages stand ten
            // pixels apart whatever their size.
            t.upright = sizes.indexOf("768x960") !== -1;
            r.shouldBe(t, "t.upright", "true");
            t.onItsSide = sizes.indexOf("960x768") !== -1;
            r.shouldBe(t, "t.onItsSide", "true");
            t.apart = gaps.length > 0 && gaps.every(function (gap) {
                return gap === 10;
            });
            r.shouldBe(t, "t.apart", "true");
            callback();
        });
    }

    /**
     * A break is read from the first style of the line that speaks of one: a
     * heading that leans on one written on a page of its own, and says for
     * itself that it is not, is not.
     * @param {!function():undefined} callback
     * @return {undefined}
     */
    function aBreakIsReadFromTheNearestStyle(callback) {
        draw(headingsThatLean(paragraphs("Standard", 4)
                + "<text:p text:style-name=\"Heading1\">First rank</text:p>"
                + "<text:p text:style-name=\"Heading2\">Second rank</text:p>"
                + "<text:p text:style-name=\"Heading3\">Third rank</text:p>"),
            function () {
                var first = paragraphOfStyle("Heading1"),
                    second = paragraphOfStyle("Heading2"),
                    third = paragraphOfStyle("Heading3");
                t.first = first
                    ? first.getAttributeNS(webodfhelperns, "breakbefore")
                    : "";
                r.shouldBe(t, "t.first", "'true'");
                t.second = second
                    ? second.getAttributeNS(webodfhelperns, "breakbefore")
                    : "missing";
                r.shouldBe(t, "t.second", "null");
                t.third = third
                    ? third.getAttributeNS(webodfhelperns, "breakbefore")
                    : "missing";
                r.shouldBe(t, "t.third", "null");
                callback();
            });
    }

    this.setUp = function () {
        t = {};
        t.odfCanvas = new odf.OdfCanvas(
            webodfcore.UnitTest.provideTestAreaDiv()
        );
    };
    this.tearDown = function () {
        t.odfCanvas.destroy(function () {
            return;
        });
        t = {};
        webodfcore.UnitTest.cleanupTestAreaDiv();
    };
    this.tests = function () {
        return [];
    };
    this.asyncTests = function () {
        return r.name([
            pagesTakeTheSizeOfTheirMasterPage,
            aBreakIsReadFromTheNearestStyle
        ]);
    };
};
odf.PageLayoutTests.prototype.description = function () {
    "use strict";
    return "Test the pages a text is drawn over, and where a new one begins.";
};
