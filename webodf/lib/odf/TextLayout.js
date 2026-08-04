/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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


/*global odf, runtime, webodfcore, Node*/
/**
 * @constructor
 */
odf.TextLayout = function TextLayout() {
    "use strict";
    var /**@type{?odf.ODFDocumentElement}*/
        styleCacheRoot = null,
        /**@type{!Object.<!string,?Element>}*/
        styleCache = {},
        /**@type{!Object.<!string,!boolean>}*/
        breakCache = {},
        /**
         * The heads and the feet that were drawn, to be copied from page to
         * page: dropped whenever a text is laid out anew.
         * @type{!Array.<!odf.TextLayout.Furniture>}
         */
        furnitureDrawn = [],
        /**
         * The master page a style of a paragraph begins, by the name of the
         * style: read once, and dropped with the styles themselves.
         * @type{!Object.<string,?Element>}
         */
        masterCache = {},
        domUtils = webodfcore.DomUtils,
        odfUtils = odf.OdfUtils,
        fons = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
        stylens = "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        drawns = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
        tablens = "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        webodfhelperns = "urn:webodf:names:helper",
        svgns = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
        dcns = "http://purl.org/dc/elements/1.1/",
        metans = "urn:oasis:names:tc:opendocument:xmlns:meta:1.0",
        /**
         * The fields a header or a footer carries that the metadata of the
         * document answers, and where each one is read from. The rest of the
         * fields keep the text the document was written with, which is what a
         * document says of itself and what an office suite would show as well
         * until it is edited again.
         * @const
         * @type{!Array.<!{field:!string, ns:!string, name:!string}>}
         */
        metaFields = [
            {field: "title", ns: dcns, name: "title"},
            {field: "subject", ns: dcns, name: "subject"},
            {field: "description", ns: dcns, name: "description"},
            {field: "author-name", ns: dcns, name: "creator"},
            {field: "initial-creator", ns: metans, name: "initial-creator"},
            {field: "keywords", ns: metans, name: "keyword"}
        ],
        /**
         * The gap between two pages, in pixels: the one the readers of pdf
         * draw, ten pixels, and the one the slides of a presentation are drawn
         * with here, see "draw|page + draw|page" in "webodf.css". OpenDocument
         * says nothing of it, as it is a matter of the reader and not of the
         * document. A zoom is a transform, so the gap follows it as the page
         * does.
         * @const
         * @type{!number}
         */
        pageSeparation = 10,
        /**
         * The way a text is drawn over pages: "pages" lays them one under
         * another, each page a box of its own that holds what the page
         * holds; "columns" lays them beside one another, each page a column,
         * which is how two pages are read side by side; "flow" writes the
         * text as one run of text with the pages floating beside it, where
         * nothing is ever cut where a page ends.
         * @type{!string}
         */
        pageMode = "pages",
        /**
         * How many pages stand side by side on a row: one for a reader who
         * scrolls a document, two for one who reads it as a book.
         * @type{!number}
         */
        pagesPerRow = 1,
        /**@type{?function():undefined}*/
        drawnHandler = null,
        /**
         * Whether the first page stands on its own, on the right of the
         * first row, as the first page of a book does.
         * @type{!boolean}
         */
        firstPageOnItsOwn = false,

        /**
         * The plan of the pages of the last layout: the pages are set right
         * against it when what is drawn after them makes one of them hold
         * one line less.
         * @type{?PagePlan}
         */
        lastPlan = null,
        /**
         * The breaking of a text into pages that is under way, if any: it is
         * done a few pages at a time, so that a reader is given the first of
         * them at once.
         * @type{?odf.TextLayout.Filling}
         */
        filling = null,
        /**@type{?odf.ODFDocumentElement}*/
        fillingRoot = null,
        /**@type{?HTMLDivElement}*/
        fillingDiv = null,
        /**@type{!number}*/
        fillingRound = 0,
        /**
         * How many pages the text was broken into, when it is broken into
         * columns: there is no chain of boxes to count them there.
         * @type{!number}
         */
        columnPages = 1,
        /**
         * Where each page begins across, when the text is broken into
         * columns: the pages stand beside one another there.
         * @type{!Array.<!number>}
         */
        columnPageOrigins = [],
        /**
         * How wide and how tall a page of the document is, of the first
         * master page it is written on: what a reader is shown at once when
         * the pages stand beside one another.
         * @type{!{width:!number,height:!number}}
         */
        columnPageSize = {width: 0, height: 0},
        /**
         * How wide a lane is left beside each page for the notes of the
         * annotations, when the pages stand beside one another: a note is
         * drawn in it, beside the line it belongs to.
         * @type{!number}
         */
        noteLane = 0,
        /**
         * How many pages are drawn at the most. A document of a thousand pages
         * is already far more than a reader shows at once, and the bound is
         * what keeps a page height read as something absurd, or a text that
         * grows as pages are added to it, from writing pages without end.
         * @const
         * @type{!number}
         */
        maxPages = 2000,
        /**
         * How many nodes are written at once at the most, before what is
         * left of an element is put aside: some pages of a dense text, so
         * that a page is measured against a page and not against a book.
         * @const
         * @type{!number}
         */
        nodesToAPage = 2000,
        /**
         * A4 in pixels at 96 dpi, and the margin LibreOffice writes, for a
         * document that declares no page layout at all.
         * @const
         * @type{!odf.TextLayout.PageDimensions}
         */
        defaultDimensions = {
            pageWidth: 794,
            pageHeight: 1123,
            marginTop: 76,
            marginBottom: 76,
            marginLeft: 76,
            marginRight: 76,
            pageSeparation: pageSeparation,
            header: {height: 0, gap: 0},
            footer: {height: 0, gap: 0},
            firstPage: {shapes: [], header: null, footer: null,
                headerLeft: null, footerLeft: null, headerFirst: null,
                footerFirst: null},
            otherPages: {shapes: [], header: null, footer: null,
                headerLeft: null, footerLeft: null, headerFirst: null,
                footerFirst: null}
        };
    /**
     * Read a length of the page layout, in pixels, and fall back on the given
     * one when the attribute is absent or written in a unit that is not read.
     * @param {!Element} properties
     * @param {!string} name
     * @param {!number} fallback
     * @param {!string=} ns the namespace of the attribute, "fo" by default
     * @return {!number}
     */
    function lengthInPx(properties, name, fallback, ns) {
        var value = properties.getAttributeNS(ns || fons, name),
            px = fallback;
        // A length in a unit that is not read, "em" for one, throws rather
        // than answering, and a page that is drawn at the size of A4 is better
        // than a page that is not drawn at all.
        if (value) {
            try {
                px = odfUtils.convertToPx(value);
            } catch (e) {
                runtime.log("The page layout names a length that is not read: "
                    + value);
                px = fallback;
            }
        }
        if (!isFinite(px) || px <= 0) {
            px = fallback;
        }
        return px;
    }
    /**
     * The place an area of the furniture of a page takes: its own height, and
     * the gap that holds it away from the text. A header is written above the
     * text and a footer below it, and the page layout gives each one a style
     * of its own, "style:header-style" and "style:footer-style".
     * @param {!Element} layout the "style:page-layout"
     * @param {!string} name "header-style" or "footer-style"
     * @param {!string} gap "margin-bottom" for a header, "margin-top" for a footer
     * @return {!odf.TextLayout.PageArea}
     */
    function readPageArea(layout, name, gap) {
        var style = domUtils.getDirectChild(layout, stylens, name),
            box = style && domUtils.getDirectChild(style, stylens,
                "header-footer-properties"),
            area = {height: 0, gap: 0};
        if (box) {
            // A header or a foot is written of the height it is given, and
            // of the height it asks for at the least where it is given
            // none: "svg:height" says the one and "fo:min-height" the
            // other, and a document that writes both is drawn of the
            // greater, as the room the text is left is the room the
            // furniture does not take.
            area.height = Math.max(lengthInPx(box, "height", 0, svgns),
                lengthInPx(box, "min-height", 0));
            // The space between the furniture and the text gives way where
            // the document asks for a dynamic spacing: the furniture grows
            // into it, and the text is left the room all the same. Where it
            // does not, the space is held and the text has that much less.
            area.gap = box.getAttributeNS(stylens, "dynamic-spacing")
                    === "true"
                ? 0
                : lengthInPx(box, gap, 0);
        }
        return area;
    }
    /**
     * The style of a family a name stands for, wherever it is written: the
     * styles of a document and the ones a document writes for one use of one
     * element, "office:automatic-styles".
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!string} name
     * @param {!string} family
     * @return {?Element}
     */
    function styleOf(odfroot, name, family) {
        var /**@type{!Array.<!Element>}*/
            roots = [odfroot.automaticStyles, odfroot.styles],
            /**@type{!string}*/
            key = family + "/" + name,
            /**@type{!NodeList}*/
            styles,
            /**@type{!Element}*/
            candidate,
            /**@type{!number}*/
            i,
            /**@type{!number}*/
            r;
        if (name === "") {
            return null;
        }
        // A page reads the same few styles as every other page does, and a
        // document holds thousands of them: they are read once, and the
        // cache is dropped whenever another document is laid out.
        if (styleCacheRoot !== odfroot) {
            styleCacheRoot = odfroot;
            styleCache = {};
            breakCache = {};
            masterCache = {};
        }
        if (styleCache.hasOwnProperty(key)) {
            return styleCache[key];
        }
        styleCache[key] = null;
        for (r = 0; r < roots.length; r += 1) {
            styles = roots[r].getElementsByTagNameNS(stylens, "style");
            for (i = 0; i < styles.length; i += 1) {
                candidate = /**@type{!Element}*/(styles.item(i));
                if (candidate.getAttributeNS(stylens, "name") === name
                        && candidate.getAttributeNS(stylens, "family")
                            === family) {
                    styleCache[key] = candidate;
                    return candidate;
                }
            }
        }
        return null;
    }
    /**
     * The graphic style of a shape, followed up its parents: a shape names a
     * style of the family "graphic", that may name another one in turn.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} shape
     * @return {?Element}
     */
    function graphicStyleOf(odfroot, shape) {
        var /**@type{!string}*/
            name = shape.getAttributeNS(drawns, "style-name") || "",
            /**@type{!Array.<!Element>}*/
            roots = [odfroot.automaticStyles, odfroot.styles],
            /**@type{?Element}*/
            style,
            /**@type{!Element}*/
            candidate,
            /**@type{!NodeList}*/
            styles,
            /**@type{!number}*/
            depth = 0,
            /**@type{!number}*/
            marker,
            /**@type{!number}*/
            i,
            /**@type{!number}*/
            r;
        while (name !== "" && depth < 10) {
            style = null;
            for (r = 0; r < roots.length && style === null; r += 1) {
                styles = roots[r].getElementsByTagNameNS(stylens, "style");
                for (i = 0; i < styles.length && style === null; i += 1) {
                    candidate = /**@type{!Element}*/(styles.item(i));
                    if (candidate.getAttributeNS(stylens, "name") === name
                            && candidate.getAttributeNS(stylens, "family")
                                === "graphic") {
                        style = candidate;
                    }
                }
            }
            if (style === null) {
                // The container prefixes the automatic styles of "styles.xml"
                // and every reference to them, so that they do not shadow the
                // ones of "content.xml", see "prefixStyleNames": a reference
                // that names no style of its own is read again without it.
                marker = name.indexOf("_webodf_");
                if (marker === -1) {
                    return null;
                }
                name = name.substring(marker + "_webodf_".length);
                depth += 1;
            } else {
                if (domUtils.getDirectChild(style, stylens,
                        "graphic-properties")) {
                    return style;
                }
                name = style.getAttributeNS(stylens, "parent-style-name") || "";
                depth += 1;
            }
        }
        return null;
    }
    /**
     * Whether a shape is drawn behind the text or over it. A watermark is
     * written behind, "style:run-through" being "background", and a stamp over
     * it, which is the default the standard gives.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} shape
     * @return {!boolean}
     */
    function isBehindTheText(odfroot, shape) {
        var style = graphicStyleOf(odfroot, shape),
            props = style && domUtils.getDirectChild(style, stylens,
                "graphic-properties");
        return Boolean(props
            && props.getAttributeNS(stylens, "run-through") === "background");
    }
    /**
     * The shapes a master page draws on every page: a watermark, a banner
     * along an edge, a note in a margin. The standard allows them beside the
     * header and the footer, and it is where they are written, as the margins
     * of a page carry no area of their own.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {?Element} masterPage
     * @return {!Array.<!odf.TextLayout.PageShape>}
     */
    function shapesOf(odfroot, masterPage) {
        var shapes = [],
            node = masterPage && masterPage.firstElementChild;
        while (node) {
            if (node.namespaceURI === drawns) {
                shapes.push({
                    node: node,
                    background: isBehindTheText(odfroot, node),
                    order: parseInt(node.getAttributeNS(drawns, "z-index"), 10)
                        || 0
                });
            }
            node = node.nextElementSibling;
        }
        return shapes;
    }
    /**
     * Draw the shapes of a master page on one page, where the shape itself
     * says where it goes: what a master page draws is placed against the
     * sheet, so the box is the sheet and the offsets are the ones written.
     * @param {!Array.<!odf.TextLayout.PageShape>} shapes
     * @param {!HTMLDivElement} box
     * @return {undefined}
     */
    function fillPageShapes(shapes, box) {
        var doc = box.ownerDocument;
        shapes.forEach(function (shape) {
            var node = shape.node,
                copy = doc.importNode(node, true),
                x = node.getAttributeNS(svgns, "x"),
                y = node.getAttributeNS(svgns, "y"),
                width = node.getAttributeNS(svgns, "width"),
                height = node.getAttributeNS(svgns, "height"),
                /**@type{!HTMLDivElement}*/
                place = /**@type{!HTMLDivElement}*/(doc.createElementNS(
                    box.namespaceURI, "div"));
            // A node of the document is placed by a box of the page around it:
            // an element of another namespace is no HTMLElement, so it carries
            // no style of its own to write into, and the styles of the
            // document are the ones that draw it.
            place.style.position = "absolute";
            place.style.left = x || "0";
            place.style.top = y || "0";
            // A watermark is drawn behind the text and a stamp over it, and
            // "draw:z-index" tells one shape of a layer from the next. The box
            // of the page holds no stacking context of its own, so these are
            // read against the text.
            place.style.zIndex = String(shape.background
                ? -1 - shape.order
                : 10 + shape.order);
            if (width) {
                place.style.width = width;
            }
            if (height) {
                place.style.height = height;
            }
            place.appendChild(copy);
            box.appendChild(place);
        });
    }
    /**
     * What a master page writes at the top and at the bottom of a page.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {?Element} masterPage
     * @return {!odf.TextLayout.PageFurniture}
     */
    function readFurniture(odfroot, masterPage) {
        /**
         * @param {!string} name
         * @return {?Element}
         */
        function child(name) {
            return masterPage
                ? domUtils.getDirectChild(masterPage, stylens, name)
                : null;
        }
        return {
            shapes: shapesOf(odfroot, masterPage),
            header: child("header"),
            footer: child("footer"),
            headerLeft: child("header-left"),
            footerLeft: child("footer-left"),
            headerFirst: child("header-first"),
            footerFirst: child("footer-first")
        };
    }
    /**
     * The master page a document names after the first one: a title page is
     * written with a master page of its own, that hands the pages that follow
     * to another one by "style:next-style-name".
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {?Element} masterPage
     * @return {?Element}
     */
    function nextMasterPage(odfroot, masterPage) {
        var name = masterPage
                && masterPage.getAttributeNS(stylens, "next-style-name"),
            masterPages = odfroot.masterStyles.getElementsByTagNameNS(stylens,
                "master-page"),
            /**@type{!Element}*/
            page,
            i;
        if (!name || name === masterPage.getAttributeNS(stylens, "name")) {
            return null;
        }
        for (i = 0; i < masterPages.length; i += 1) {
            page = /**@type{!Element}*/(masterPages[i]);
            if (page.getAttributeNS(stylens, "name") === name) {
                return page;
            }
        }
        return null;
    }
    /**
     * The size of a page, read from the page layout the first master page
     * names. A text document has one master page in all but the rarest cases,
     * and the pages are all of that size until the layout follows the master
     * page of each paragraph, which it does not do yet.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {?Element} masterPage
     * @return {!odf.TextLayout.PageDimensions}
     */
    function readPageDimensions(odfroot, masterPage) {
        var
            /**@type{!string}*/
            layoutName = "",
            /**@type{!NodeList}*/
            layouts = odfroot.automaticStyles.getElementsByTagNameNS(stylens,
                "page-layout"),
            /**@type{?Element}*/
            properties = null,
            /**@type{!Element}*/
            pageLayout,
            /**@type{!Element}*/
            layout,
            /**@type{!odf.TextLayout.PageDimensions}*/
            dims,
            /**@type{!number}*/
            i;
        if (masterPage) {
            layoutName = masterPage.getAttributeNS(stylens, "page-layout-name")
                || "";
        }
        for (i = 0; i < layouts.length && properties === null; i += 1) {
            layout = /**@type{!Element}*/(layouts.item(i));
            if (layoutName === ""
                    || layout.getAttributeNS(stylens, "name") === layoutName) {
                properties = domUtils.getDirectChild(layout, stylens,
                    "page-layout-properties");
                pageLayout = layout;
            }
        }
        if (properties === null) {
            return defaultDimensions;
        }
        dims = {
            pageHeight: lengthInPx(properties, "page-height",
                defaultDimensions.pageHeight),
            pageWidth: lengthInPx(properties, "page-width",
                defaultDimensions.pageWidth),
            marginTop: defaultDimensions.marginTop,
            marginBottom: defaultDimensions.marginBottom,
            marginLeft: defaultDimensions.marginLeft,
            marginRight: defaultDimensions.marginRight,
            pageSeparation: pageSeparation,
            header: readPageArea(pageLayout, "header-style", "margin-bottom"),
            footer: readPageArea(pageLayout, "footer-style", "margin-top"),
            firstPage: readFurniture(odfroot, masterPage),
            otherPages: readFurniture(odfroot,
                nextMasterPage(odfroot, masterPage) || masterPage)
        };
        // One margin for the four sides, or one by side.
        if (properties.getAttributeNS(fons, "margin")) {
            dims.marginTop = lengthInPx(properties, "margin",
                defaultDimensions.marginTop);
            dims.marginBottom = dims.marginTop;
            dims.marginLeft = dims.marginTop;
            dims.marginRight = dims.marginTop;
        } else {
            dims.marginTop = lengthInPx(properties, "margin-top",
                defaultDimensions.marginTop);
            dims.marginBottom = lengthInPx(properties, "margin-bottom",
                defaultDimensions.marginBottom);
            dims.marginLeft = lengthInPx(properties, "margin-left",
                defaultDimensions.marginLeft);
            dims.marginRight = lengthInPx(properties, "margin-right",
                defaultDimensions.marginRight);
        }
        // The header and the footer are written inside the margins of the
        // page, between its edge and the text: the text has that much less
        // room, and the margins of the layout hold it away from them.
        // The room a header takes is the room it takes on every page: the
        // pages of a document are of one height, and a title page that carries
        // no header is drawn with the same text area as the others.
        return dims;
    }
    this.readPageDimensions = readPageDimensions;
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @return {!number}
     */
    function countPages(pagesDiv) {
        return pageMode !== "flow"
            ? columnPages
            : Math.ceil((pagesDiv.childElementCount - 1) / 2);
    }
    /**
     * What the metadata of the document says of itself, for the fields a
     * header or a footer may carry. A field that the metadata does not answer
     * is left with the text the document was written with.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {!Object.<!string,!string>}
     */
    function readMeta(odfroot) {
        var meta = {},
            node;
        metaFields.forEach(function (entry) {
            node = odfroot.meta
                ? domUtils.getDirectChild(odfroot.meta, entry.ns, entry.name)
                : null;
            if (node && node.textContent) {
                meta[entry.field] = node.textContent;
            }
        });
        return meta;
    }
    /**
     * How many pages the document says it has, from the statistics its
     * metadata carries, or zero where it says nothing. A text is broken into
     * pages one slice at a time, so the number of pages that are drawn is not
     * the number of pages of the document until the last one is broken: the
     * footer of the first page would read "1 of 12" while the rest is still
     * being laid out. The number the writer of the document recorded is the
     * one a reader expects, and it is used until the text is broken whole.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {!number}
     */
    function recordedPageCount(odfroot) {
        var stat = odfroot.meta
                ? domUtils.getDirectChild(odfroot.meta, metans,
                    "document-statistic")
                : null,
            count = stat
                ? parseInt(stat.getAttributeNS(metans, "page-count"), 10)
                : NaN;
        return isNaN(count) || count < 1
            ? 0
            : count;
    }
    /**
     * The paragraphs and the headings a box holds.
     * @param {!Element} box
     * @return {!Array.<!Element>}
     */
    function paragraphsOf(box) {
        var /**@type{!Array.<!Element>}*/
            found = [],
            /**@type{!Array.<!string>}*/
            names = ["p", "h"],
            /**@type{!NodeList}*/
            nodes,
            /**@type{!number}*/
            i,
            /**@type{!number}*/
            n;
        for (n = 0; n < names.length; n += 1) {
            nodes = box.getElementsByTagNameNS(textns, names[n]);
            for (i = 0; i < nodes.length; i += 1) {
                found.push(/**@type{!Element}*/(nodes.item(i)));
            }
        }
        return found;
    }
    /**
     * Read the name a document gives a style behind the stamp of the canvas.
     *
     * A header is drawn twice, once for the page and once for the styles of
     * the canvas, which writes a stamp of its own before the name of each
     * style it draws a second time: "<time>_webodf_Footer" is "Footer".
     * @param {!string} name
     * @return {!string}
     */
    function plainStyleName(name) {
        var mark = name.indexOf("_webodf_");
        return mark === -1
            ? name
            : name.substr(mark + "_webodf_".length);
    }
    /**
     * The tab stops a paragraph is written against, in pixels, each one with
     * the way what follows it is set against it: "left", "center" or "right".
     * A header and a footer are written with them, which is how a document
     * puts a title on the left of a page, a date in the middle and the number
     * of the page on the right, with a tab between each of them.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} paragraph
     * @return {!Array.<!odf.TextLayout.TabStop>}
     */
    function tabStopsOf(odfroot, paragraph) {
        var /**@type{!string}*/
            name = paragraph.getAttributeNS(textns, "style-name") || "",
            /**@type{?Element}*/
            style = null,
            /**@type{?Element}*/
            properties = null,
            /**@type{?Element}*/
            list = null,
            /**@type{!number}*/
            depth = 0,
            /**@type{!Array.<!odf.TextLayout.TabStop>}*/
            stops = [],
            /**@type{?Element}*/
            node;
        // The style of the paragraph is an automatic one that says little
        // and leans on a common one: the stops are taken from the first
        // style of the line that writes them. A name the canvas stamped is
        // read as the document wrote it when nothing answers to the stamp.
        // The depth keeps a style that names itself as its own parent from
        // turning in a circle.
        while (name !== "" && !list && depth < 16) {
            style = styleOf(odfroot, name, "paragraph");
            if (!style && plainStyleName(name) !== name) {
                name = plainStyleName(name);
                style = styleOf(odfroot, name, "paragraph");
            }
            properties = style
                ? domUtils.getDirectChild(style, stylens,
                    "paragraph-properties")
                : null;
            list = properties
                ? domUtils.getDirectChild(properties, stylens, "tab-stops")
                : null;
            if (!list && style) {
                name = style.getAttributeNS(stylens, "parent-style-name")
                    || "";
            } else if (!list && plainStyleName(name) !== name) {
                name = plainStyleName(name);
            } else if (!list) {
                name = "";
            }
            depth += 1;
        }
        node = list
            ? list.firstElementChild
            : null;
        while (node) {
            if (node.namespaceURI === stylens && node.localName === "tab-stop") {
                stops.push({
                    at: lengthInPx(node, "position", 0, stylens),
                    type: node.getAttributeNS(stylens, "type") || "left"
                });
            }
            node = node.nextElementSibling;
        }
        return stops;
    }
    /**
     * Write the runs of spaces of a header as the spaces they stand for.
     *
     * The canvas does that for the text of the document alone, and a header
     * is written in the styles of the document, so a "text:s" is still an
     * element here and nothing of it is seen: "Page 1 of 809" was read
     * "Page 1of 809".
     * @param {!Element} box a header or a footer, drawn for a page
     * @return {undefined}
     */
    function expandSpaces(box) {
        var doc = box.ownerDocument,
            spaces = box.getElementsByTagNameNS(textns, "s"),
            /**@type{!Array.<!Element>}*/
            found = [],
            i;
        for (i = 0; i < spaces.length; i += 1) {
            found.push(/**@type{!Element}*/(spaces.item(i)));
        }
        found.forEach(function (space) {
            var count = parseInt(space.getAttributeNS(textns, "c"), 10),
                run = "";
            if (!(count > 1)) {
                count = 1;
            }
            while (count > 0) {
                run += "\u00a0";
                count -= 1;
            }
            if (space.parentNode) {
                space.parentNode.replaceChild(doc.createTextNode(run), space);
            }
        });
    }
    /**
     * Bring the tabs of a paragraph up to be children of the paragraph.
     *
     * A document may write a tab deep in the spans that carry the styles of
     * a line, and the parts of the line are told apart at the paragraph: the
     * spans around a tab are cut in two, so the tab stands between them and
     * each part keeps the styles it was written with.
     * @param {!Element} paragraph
     * @return {undefined}
     */
    function raiseTabs(paragraph) {
        var tabs = paragraph.getElementsByTagNameNS(textns, "tab"),
            /**@type{!Array.<!Element>}*/
            found = [],
            i;
        for (i = 0; i < tabs.length; i += 1) {
            found.push(/**@type{!Element}*/(tabs.item(i)));
        }
        found.forEach(function (tab) {
            var /**@type{?Node}*/
                parent = tab.parentNode,
                /**@type{!Element}*/
                tail,
                /**@type{?Node}*/
                node;
            while (parent && parent !== paragraph) {
                tail = /**@type{!Element}*/(
                    /**@type{!Element}*/(parent).cloneNode(false)
                );
                node = tab.nextSibling;
                while (node) {
                    tail.appendChild(node);
                    node = tab.nextSibling;
                }
                if (parent.parentNode) {
                    parent.parentNode.insertBefore(tab, parent.nextSibling);
                    if (tail.firstChild) {
                        parent.parentNode.insertBefore(tail,
                            tab.nextSibling);
                    }
                }
                parent = tab.parentNode;
            }
        });
    }
    /**
     * The parts of a paragraph, that is what stands between its tabs.
     *
     * The nodes of the paragraph are taken out of it and put in a span for
     * each part, the first of them holding what stands before the first tab.
     * @param {!Element} paragraph
     * @param {!Document} doc
     * @param {!string} htmlns
     * @return {!Array.<!HTMLElement>}
     */
    function partsOfParagraph(paragraph, doc, htmlns) {
        var /**@type{!Array.<!HTMLElement>}*/
            parts = [],
            /**@type{!HTMLElement}*/
            part = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns,
                "span")),
            /**@type{?Node}*/
            node = paragraph.firstChild,
            /**@type{?Node}*/
            next,
            /**@type{!Array.<!string>}*/
            pieces,
            /**@type{!number}*/
            i;
        parts.push(part);
        while (node) {
            next = node.nextSibling;
            if (node.nodeType === Node.ELEMENT_NODE
                    && /**@type{!Element}*/(node).namespaceURI === textns
                    && /**@type{!Element}*/(node).localName === "tab") {
                paragraph.removeChild(node);
                part = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns,
                    "span"));
                parts.push(part);
            } else if (node.nodeType === Node.TEXT_NODE
                    && String(node.textContent).indexOf("\t") !== -1) {
                // The canvas writes a "text:tab" as a tab of a terminal
                // before a text is drawn, so a tab is a letter here.
                pieces = String(node.textContent).split("\t");
                paragraph.removeChild(node);
                for (i = 0; i < pieces.length; i += 1) {
                    if (i > 0) {
                        part = /**@type{!HTMLElement}*/(doc.createElementNS(
                            htmlns,
                            "span"
                        ));
                        parts.push(part);
                    }
                    if (pieces[i] !== "") {
                        part.appendChild(doc.createTextNode(pieces[i]));
                    }
                }
            } else {
                part.appendChild(node);
            }
            node = next;
        }
        return parts;
    }
    /**
     * Set the parts of a paragraph against the tab stops it is written with.
     *
     * A tab is drawn as a tab of a terminal otherwise, that walks to the next
     * stop of eight letters, so a title, a date and a number of a page ran
     * into one another. Each part is laid where its stop says instead, and
     * against it as its stop asks: the standard calls that "style:type" of a
     * "style:tab-stop".
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} paragraph
     * @return {undefined}
     */
    function layOutTabStops(odfroot, paragraph) {
        var doc = /**@type{!Document}*/(paragraph.ownerDocument),
            htmlns = "http://www.w3.org/1999/xhtml",
            stops = tabStopsOf(odfroot, paragraph),
            /**@type{!Array.<!HTMLElement>}*/
            parts,
            /**@type{!HTMLElement}*/
            line;
        if (stops.length === 0) {
            return;
        }
        raiseTabs(paragraph);
        if (!paragraph.getElementsByTagNameNS(textns, "tab").length
                && String(paragraph.textContent).indexOf("\t") === -1) {
            // A line without a tab is written as it stands: nothing of it is
            // moved, and nothing of it can be lost.
            return;
        }
        parts = partsOfParagraph(paragraph, doc, htmlns);
        if (parts.length < 2) {
            // Nothing was told apart, so what was taken from the paragraph
            // is put back where it was.
            while (parts[0].firstChild) {
                paragraph.appendChild(parts[0].firstChild);
            }
            return;
        }
        // The parts are laid in a box of the page rather than in the
        // paragraph: a style set on an element of the document is not the
        // canvas's to set, and the document is read as broken when it is.
        line = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns, "div"));
        line.style.position = "relative";
        // The stops of the line are written on it: a tab goes to the first
        // stop past what stands before it, which is known once the line is
        // drawn and measured, see "spreadLines".
        line.setAttributeNS(webodfhelperns, "webodfhelper:stops",
            stops.map(function (stop) {
                return String(Math.round(stop.at)) + ":" + stop.type;
            }).join(","));
        paragraph.appendChild(line);
        // The line of the paragraph holds its own height from here on: the
        // zero width space that keeps an empty paragraph from collapsing
        // would add a line of the size of the style of the paragraph, and a
        // footer of eight points would stand ten points apart.
        paragraph.setAttributeNS(webodfhelperns, "webodfhelper:laidout",
            "true");
        parts.forEach(function (piece, index) {
            var /**@type{?odf.TextLayout.TabStop}*/
                stop = index === 0 ? null : stops[index - 1];
            piece.style.position = "absolute";
            piece.style.whiteSpace = "pre";
            if (!stop) {
                piece.style.left = "0";
                line.appendChild(piece);
                return;
            }
            // A stop is written from the left edge of the text of the page,
            // and a document may put one where the page is no longer wide
            // enough for it: the last stop is then the right edge itself.
            piece.style.left = "min(" + stop.at + "px, 100%)";
            if (stop.type === "center") {
                piece.style.transform = "translateX(-50%)";
            } else if (stop.type === "right") {
                piece.style.transform = "translateX(-100%)";
            }
            line.appendChild(piece);
        });

    }
    /**
     * Lay the tabs of a paragraph of the text at their stops.
     *
     * A header is drawn in a box of its own and every part of it is laid at
     * its stop; a paragraph of the text keeps the first of its parts in the
     * flow of the text, so that the line holds its height and its words wrap
     * as they would: an entry of a table of contents is written from the
     * left, and the number of the page it names is laid against the stop on
     * the right.
     *
     * Nothing is measured here: the stops are written where the document
     * says, and the parts are laid there by the browser.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} paragraph
     * @return {undefined}
     */
    function layOutTabsInText(odfroot, paragraph) {
        var doc = /**@type{!Document}*/(paragraph.ownerDocument),
            htmlns = "http://www.w3.org/1999/xhtml",
            stops = tabStopsOf(odfroot, paragraph),
            /**@type{!Array.<!HTMLElement>}*/
            parts,
            /**@type{!HTMLElement}*/
            line;
        if (stops.length === 0
                || paragraph.hasAttributeNS(webodfhelperns, "laidout")) {
            return;
        }
        raiseTabs(paragraph);
        if (!paragraph.getElementsByTagNameNS(textns, "tab").length
                && String(paragraph.textContent).indexOf("\t") === -1) {
            return;
        }
        parts = partsOfParagraph(paragraph, doc, htmlns);
        if (parts.length < 2) {
            while (parts[0].firstChild) {
                paragraph.appendChild(parts[0].firstChild);
            }
            return;
        }
        line = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns, "div"));
        line.style.position = "relative";
        paragraph.appendChild(line);
        paragraph.setAttributeNS(webodfhelperns, "webodfhelper:laidout",
            "true");
        parts.forEach(function (piece, index) {
            var /**@type{?odf.TextLayout.TabStop}*/
                stop = index === 0
                    ? null
                    : stops[Math.min(index, stops.length) - 1],
                /**@type{?odf.TextLayout.TabStop}*/
                before = index > 1
                    ? stops[Math.min(index - 1, stops.length) - 1]
                    : null;
            if (!stop) {
                // The first part is written as the text is: it holds the
                // height of the line and wraps where the page ends.
                line.appendChild(piece);
                return;
            }
            if (stop.type === "left" || stop.type === "char") {
                // A part that begins at a stop on the left is written in the
                // flow of the line, and what stands before it is held to the
                // width of its own slot: a label longer than its slot pushes
                // what follows to the right, as a tab of a text does, where
                // a part laid against the stop would be written over it.
                /**@type{!HTMLElement}*/(parts[index - 1]).style.display =
                    "inline-block";
                /**@type{!HTMLElement}*/(parts[index - 1]).style.minWidth =
                    Math.max(0, stop.at - (before
                        ? before.at
                        : 0)) + "px";
                piece.style.whiteSpace = "pre-wrap";
                line.appendChild(piece);
                return;
            }
            piece.style.position = "absolute";
            piece.style.whiteSpace = "pre";
            piece.style.top = "0";
            piece.style.left = "min(" + stop.at + "px, 100%)";
            if (stop.type === "center") {
                piece.style.transform = "translateX(-50%)";
            } else {
                piece.style.transform = "translateX(-100%)";
            }
            line.appendChild(piece);
        });
    }
    /**
     * The tab stops a line was drawn with, as it carries them.
     * @param {!HTMLElement} line
     * @return {!Array.<!odf.TextLayout.TabStop>}
     */
    function stopsOfLine(line) {
        var written = line.getAttributeNS(webodfhelperns, "stops") || "",
            /**@type{!Array.<!odf.TextLayout.TabStop>}*/
            stops = [];
        if (!written) {
            return stops;
        }
        written.split(",").forEach(function (one) {
            var parts = one.split(":");
            if (parts.length === 2) {
                stops.push({at: parseFloat(parts[0]), type: parts[1]});
            }
        });
        return stops;
    }
    /**
     * Push the parts of the lines apart where they would be written over.
     *
     * A part is laid at its stop, and a part that runs past the next stop
     * would be written over by the one that follows it: the one that follows
     * is pushed to the right, as a tab of a text does, so nothing is hidden.
     * A part is never pushed off the page: a line too full for its stops is
     * drawn tight rather than half of it lost.
     *
     * The parts of every page are read before any of them is moved: a read
     * that follows a write asks the browser to lay the whole page out again,
     * and a document of a hundred pages would be drawn a hundred times over.
     * @param {!Array.<!Element>} boxes the headers and the footers drawn
     * @return {undefined}
     */
    function spreadLines(boxes) {
        var /**@type{!Array.<!Array.<!HTMLElement>>}*/
            lines = [],
            /**@type{!Array.<!Array.<!ClientRect>>}*/
            rects = [],
            /**@type{!Array.<!number>}*/
            room = [],
            /**@type{!Array.<!HTMLElement>}*/
            boxOf = [];
        boxes.forEach(function (box) {
            var found = box.getElementsByTagName("div"),
                l,
                line,
                parts,
                pieces,
                i;
            for (l = 0; l < found.length; l += 1) {
                line = /**@type{!HTMLElement}*/(found.item(l));
                parts = line.children;
                pieces = [];
                for (i = 0; i < parts.length; i += 1) {
                    pieces.push(/**@type{!HTMLElement}*/(parts.item(i)));
                }
                lines.push(pieces);
                boxOf.push(line);
            }
        });
        lines.forEach(function (pieces, l) {
            room.push(boxOf[l].getBoundingClientRect().right);
            rects.push(pieces.map(function (piece) {
                return piece.getBoundingClientRect();
            }));
        });
        // Every part of a line is laid at a place of its own and none of them
        // holds the line open, so the line is given the height of the tallest
        // one: a line of a footer written in eight points is eight points
        // tall, and not the ten points of the style of its paragraph.
        rects.forEach(function (found, l) {
            var /**@type{!number}*/
                tall = 0;
            found.forEach(function (rect) {
                tall = Math.max(tall, rect.height);
            });
            boxOf[l].style.height = tall + "px";
        });
        lines.forEach(function (pieces, l) {
            var /**@type{!number}*/
                edge = 0,
                /**@type{!number}*/
                right = room[l],
                /**@type{!number}*/
                gap = 4,
                /**@type{!number}*/
                left = boxOf[l].getBoundingClientRect().left,
                stops = stopsOfLine(boxOf[l]),
                /**@type{!number}*/
                next = 0;
            pieces.forEach(function (piece, i) {
                var rect = rects[l][i],
                    /**@type{?odf.TextLayout.TabStop}*/
                    stop,
                    /**@type{!number}*/
                    at,
                    push;
                push = 0;
                if (i > 0 && stops.length > 0) {
                    // A tab goes to the first stop past what stands before
                    // it, and not to the stop of its own number: a line whose
                    // words run past the stop in the middle goes on to the
                    // one on the right, as an office writes it.
                    while (next < stops.length
                            && left + stops[next].at < edge + gap) {
                        next += 1;
                    }
                    if (next < stops.length) {
                        stop = stops[next];
                        // The stop is taken by the tab whether anything is
                        // written after it or not: a line that holds two
                        // tabs and nothing between them writes what follows
                        // against the second stop.
                        next += 1;
                        at = left + stop.at;
                        if (stop.type === "right") {
                            at -= rect.width;
                        } else if (stop.type === "center") {
                            at -= rect.width / 2;
                        }
                        // A stop written for a page of another size stands
                        // past the edge of this one: what it holds is drawn
                        // against the edge instead, as an office draws it,
                        // rather than in the margin or off the page.
                        at = Math.min(at, right - rect.width);
                        push = at - rect.left;
                    }
                }
                if (rect.width === 0) {
                    // Nothing is drawn of it, so nothing is moved and
                    // nothing stands in the way of what follows.
                    return;
                }
                if (edge > 0 && rect.left + push < edge + gap) {
                    // A blank is left between two parts that were pushed
                    // together, so the two are still read as two.
                    push = Math.min(edge + gap - rect.left,
                        Math.max(0, right - rect.right));
                }
                if (push !== 0) {
                    // The part is already drawn against a stop, and is only
                    // moved from where it stands.
                    piece.style.transform = piece.style.transform
                        + " translateX(" + push + "px)";
                }
                edge = rect.right + push;
            });
        });
    }
    /**
     * Give back to the copies of a header the names of the styles the
     * document wrote, where the canvas stamped names of its own.
     *
     * A style the canvas draws a second time is named "<time>_webodf_Footer",
     * and no rule of the stylesheet answers to that name: a footer drawn with
     * it is written in the font of nothing, rather than in the one the
     * document asks for. The name of the document is set back wherever the
     * stamped one stands for no style at all.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} box a header or a footer, drawn for a page
     * @return {undefined}
     */
    function unstampStyleNames(odfroot, box) {
        var /**@type{!Object.<!string,!string>}*/
            families = {p: "paragraph", h: "paragraph", span: "text",
                list: "list"},
            nodes = box.getElementsByTagName("*"),
            /**@type{!Array.<!Element>}*/
            found = [],
            i;
        for (i = 0; i < nodes.length; i += 1) {
            found.push(/**@type{!Element}*/(nodes.item(i)));
        }
        found.forEach(function (node) {
            var /**@type{!string}*/
                family = families.hasOwnProperty(node.localName)
                    ? families[node.localName]
                    : "",
                name = node.getAttributeNS(textns, "style-name") || "",
                plain = plainStyleName(name);
            if (node.namespaceURI !== textns || family === ""
                    || plain === name) {
                return;
            }
            if (!styleOf(odfroot, name, family)
                    && styleOf(odfroot, plain, family)) {
                node.setAttributeNS(textns, "text:style-name", plain);
            }
        });
    }
    /**
     * Whether a line holds a field, that is written anew on every page.
     * @param {!Element} paragraph
     * @param {!Object.<string,string>} meta
     * @return {!boolean}
     */
    function holdsAField(paragraph, meta) {
        var names = ["page-number", "page-count"].concat(Object.keys(meta)),
            /**@type{!number}*/
            i;
        for (i = 0; i < names.length; i += 1) {
            if (paragraph.getElementsByTagNameNS(textns, names[i]).length > 0) {
                return true;
            }
        }
        return false;
    }
    /**
     * The head or the foot of a page as it is drawn, ready to be copied.
     *
     * It is drawn once for a source and a width — the tabs of every line
     * taken to their stops, the runs of spaces written out — and kept: the
     * pages of a master page are all written the same but for their fields,
     * see "fillPageArea". The lines that hold a field are named with it, as
     * those are measured again once the field is written.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} source
     * @param {!Element} box
     * @param {!Object.<string,string>} meta
     * @return {!odf.TextLayout.Furniture}
     */
    function furnitureOf(odfroot, source, box, meta) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            width = box.getBoundingClientRect().width,
            /**@type{!number}*/
            i,
            /**@type{!DocumentFragment}*/
            drawn,
            /**@type{!Array.<!number>}*/
            fields = [];
        for (i = 0; i < furnitureDrawn.length; i += 1) {
            if (furnitureDrawn[i].source === source
                    && Math.abs(furnitureDrawn[i].width - width) < 1) {
                return furnitureDrawn[i];
            }
        }
        box.appendChild(doc.importNode(source, true));
        unstampStyleNames(odfroot, box);
        // The name of the style is the one of the document again, so the
        // attribute the rules of that style are written against is written
        // anew: it carried the name the canvas stamped, that names nothing
        // any more, and a header drawn without its style is drawn of the
        // size of a text and no longer of eight points.
        odf.Style2CSS.stampStyleClasses(box);
        expandSpaces(box);
        paragraphsOf(box).forEach(function (paragraph, index) {
            layOutTabStops(odfroot, paragraph);
            if (holdsAField(paragraph, meta)) {
                fields.push(index);
            }
        });
        // What was drawn is taken out of the box and kept whole: the box is
        // filled from a copy of it, here as on every page that follows.
        drawn = doc.createDocumentFragment();
        while (box.firstChild) {
            drawn.appendChild(box.firstChild);
        }
        furnitureDrawn.push({
            source: source,
            width: width,
            drawn: drawn,
            fields: fields
        });
        return furnitureDrawn[furnitureDrawn.length - 1];
    }
    /**
     * Copy what a master page writes in a header or in a footer, and put the
     * number of the page where the document asks for it. The nodes are of the
     * document, so the styles of the document draw them as they draw the text.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} source the "style:header" or the "style:footer"
     * @param {!HTMLDivElement} box
     * @param {!number} page the number of the page, from one
     * @param {!number} pages how many pages there are
     * @param {!Object.<!string,!string>} meta what the document says of itself
     * @return {undefined}
     */
    function fillPageArea(odfroot, source, box, page, pages, meta) {
        var /**@type{!odf.TextLayout.Furniture}*/
            ready = furnitureOf(odfroot, source, box, meta),
            /**@type{!Array.<!Element>}*/
            lines;
        /**
         * @param {!string} name
         * @param {!string} value
         * @return {undefined}
         */
        function fill(name, value) {
            var fields = box.getElementsByTagNameNS(textns, name),
                i;
            for (i = 0; i < fields.length; i += 1) {
                fields[i].textContent = value;
            }
        }
        // The head and the foot of a page are written the same on every
        // page of a master page, but for the fields they hold: what was
        // drawn once is copied, and the lines that hold a field alone are
        // measured again for their tab stops. A foot of three lines where
        // one gives the number of the page is measured once on each page and
        // not three times.
        box.appendChild(ready.drawn.cloneNode(true));
        fill("page-number", String(page));
        fill("page-count", String(pages));
        Object.keys(meta).forEach(function (name) {
            fill(name, meta[name]);
        });
        lines = paragraphsOf(box);
        ready.fields.forEach(function (index) {
            if (lines[index]) {
                layOutTabStops(odfroot, lines[index]);
            }
        });
    }
    /**
     * The header or the footer a page carries. A master page may write one for
     * the pages on the left and another for the pages on the right, which is
     * how a book puts the number of the page on the outer edge: the first page
     * is a right one, so the pages of an even number are the left ones. Where
     * "style:header-left" is not written, the header of the master page is the
     * one of every page, see the part 1 of the standard, "style:header-left".
     *
     * A first page may carry a header of its own, "style:header-first", which
     * the standard added in 1.3 and which the office suites of today write
     * where a title page was written with a master page of its own before.
     * @param {!PagePlan} plan
     * @param {!string} which "header" or "footer"
     * @param {!number} page the number of the page, from one
     * @return {?Element}
     */
    function pageArea(plan, which, page) {
        var furniture = plan.furnitureAt(page - 1),
            first = which === "header" ? furniture.headerFirst : furniture.footerFirst,
            left = which === "header" ? furniture.headerLeft : furniture.footerLeft,
            right = which === "header" ? furniture.header : furniture.footer;
        if (page === 1 && first) {
            return first;
        }
        if (page % 2 === 0 && left) {
            return left;
        }
        return right;
    }
    /**
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!string} name
     * @return {?Element}
     */
    function masterPageNamed(odfroot, name) {
        var pages = odfroot.masterStyles.getElementsByTagNameNS(stylens,
                "master-page"),
            /**@type{!Element}*/
            page,
            /**@type{!number}*/
            i;
        for (i = 0; i < pages.length; i += 1) {
            page = /**@type{!Element}*/(pages.item(i));
            if (page.getAttributeNS(stylens, "name") === name) {
                return page;
            }
        }
        return null;
    }
    /**
     * The text of a document, that a page breaks it over.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {?Element}
     */
    function getOfficeText(odfroot) {
        return domUtils.getDirectChild(odfroot.body, officens, "text");
    }
    /**
     * How far an element is from the top of the page it is drawn in.
     * @param {!Element} element
     * @return {!number}
     */
    function getTop(element) {
        var he = /**@type{!HTMLElement}*/(element),
            top = he.offsetTop || 0;
        if (he.offsetParent) {
            top += getTop(/**@type{!Element}*/(he.offsetParent));
        }
        return top;
    }
    /**
     * Lay the tabs of every paragraph of a text at their stops.
     *
     * It is done once for a document, whatever asks for it: the canvas asks
     * as it draws, and the pages ask before they are broken, as a canvas
     * that draws over pages takes the text out of the document to fill them
     * and there is nothing left to lay out by then.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {undefined}
     */
    function layOutTabsOfText(odfroot) {
        var text = getOfficeText(odfroot);
        if (!text) {
            return;
        }
        paragraphsOf(text).forEach(function (paragraph) {
            layOutTabsInText(odfroot, paragraph);
        });
    }
    /**
     * The master page a paragraph asks for, where it asks for one: a style of
     * the family "paragraph" that names "style:master-page-name" begins a page
     * with that master page, which is how a document lays a landscape page in
     * the middle of a text.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} paragraph
     * @return {?Element}
     */
    function masterPageOfParagraph(odfroot, paragraph) {
        var /**@type{!string}*/
            name = paragraph.getAttributeNS(textns, "style-name") || "",
            /**@type{?Element}*/
            style,
            /**@type{!string}*/
            master = "";
        if (name === "") {
            return null;
        }
        // A document holds a handful of styles for thousands of paragraphs,
        // and each paragraph is read: the style of a name is read once and
        // kept beside the styles themselves, as the breaks are, rather than
        // read again out of all the styles of the document for every
        // paragraph that names it.
        if (styleCacheRoot === odfroot && masterCache.hasOwnProperty(name)) {
            return masterCache[name];
        }
        style = styleOf(odfroot, name, "paragraph");
        if (!style && plainStyleName(name) !== name) {
            style = styleOf(odfroot, plainStyleName(name), "paragraph");
        }
        if (style) {
            master = style.getAttributeNS(stylens, "master-page-name") || "";
        }
        masterCache[name] = master === ""
            ? null
            : masterPageNamed(odfroot, master);
        return masterCache[name];
    }
    /**
     * The master pages a text goes through, in the order it goes through them,
     * and the paragraph each change begins at. The first one is the master
     * page of the document, that "style:next-style-name" hands over after the
     * first page, and every one after it is asked for by a paragraph.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {!Array.<!{master:?Element, paragraph:?Element}>}
     */
    function masterPageSequence(odfroot) {
        var pages = odfroot.masterStyles.getElementsByTagNameNS(stylens,
                "master-page"),
            first = pages.length > 0
                ? /**@type{!Element}*/(pages.item(0))
                : null,
            sequence = [{master: first, paragraph: null}],
            officeText = getOfficeText(odfroot),
            /**@type{?Element}*/
            master,
            /**@type{?Element}*/
            node = officeText && officeText.firstElementChild;
        // The pages that follow the first one, where the document says so.
        if (first && nextMasterPage(odfroot, first)) {
            sequence.push({
                master: nextMasterPage(odfroot, first),
                paragraph: null
            });
        }
        while (node) {
            if (node.namespaceURI === textns
                    && (node.localName === "p" || node.localName === "h")) {
                master = masterPageOfParagraph(odfroot, node);
                if (master) {
                    sequence.push({master: master, paragraph: node});
                }
            }
            node = node.nextElementSibling;
        }
        return sequence;
    }
    /**
     * The room a header or a foot takes once it is written.
     *
     * A document says how tall its furniture is, and writes in it what it
     * writes: a foot of two lines in a box of one is drawn of two all the
     * same, and the text of the page is left that much less room. The
     * height is measured on a copy drawn out of sight, of the width the
     * page gives it.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {?Element} source <style:header/> or <style:footer/>
     * @param {!number} width of the text area, in pixels
     * @return {!number}
     */
    function roomTaken(odfroot, source, width) {
        var doc = /**@type{!Document}*/(odfroot.ownerDocument),
            htmlns = doc.documentElement.namespaceURI,
            /**@type{!Element}*/
            box,
            /**@type{!number}*/
            height;
        if (!source || width <= 0) {
            return 0;
        }
        box = /**@type{!Element}*/(doc.createElementNS(htmlns, "div"));
        /**@type{!HTMLElement}*/(box).style.position = "absolute";
        /**@type{!HTMLElement}*/(box).style.visibility = "hidden";
        /**@type{!HTMLElement}*/(box).style.left = "-10000px";
        /**@type{!HTMLElement}*/(box).style.top = "0";
        /**@type{!HTMLElement}*/(box).style.width = width + "px";
        box.appendChild(doc.importNode(source, true));
        unstampStyleNames(odfroot, box);
        // The name of the style is the one of the document again, so the
        // attribute the rules of that style are written against is written
        // anew: it carried the name the canvas stamped, that names nothing
        // any more, and a header drawn without its style is drawn of the
        // size of a text and no longer of eight points.
        odf.Style2CSS.stampStyleClasses(box);
        expandSpaces(box);
        odfroot.body.appendChild(box);
        height = box.getBoundingClientRect().height;
        odfroot.body.removeChild(box);
        return height;
    }
    /**
     * The margins of a page, once the furniture is written inside them.
     *
     * A header and a foot are written between the edge of the page and its
     * text, so the text is left that much less room: the height the
     * document gives them, or the height what they hold takes where that is
     * the greater, and the space that parts them from the text where it
     * does not give way. The room a header takes is the room it takes on
     * every page: the pages of a document are of one height, and a title
     * page that carries no header is drawn with the same text area as the
     * others.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!odf.TextLayout.PageDimensions} dims
     * @return {!odf.TextLayout.PageDimensions}
     */
    function roomForFurniture(odfroot, dims) {
        var width = dims.pageWidth - dims.marginLeft - dims.marginRight,
            /**@type{?Element}*/
            head = dims.otherPages.header || dims.otherPages.headerLeft
                || dims.otherPages.headerFirst || dims.firstPage.header
                || dims.firstPage.headerLeft || dims.firstPage.headerFirst,
            /**@type{?Element}*/
            foot = dims.otherPages.footer || dims.otherPages.footerLeft
                || dims.otherPages.footerFirst || dims.firstPage.footer
                || dims.firstPage.footerLeft || dims.firstPage.footerFirst;
        if (head) {
            dims.marginTop += Math.max(dims.header.height,
                roomTaken(odfroot, head, width)) + dims.header.gap;
        }
        if (foot) {
            dims.marginBottom += Math.max(dims.footer.height,
                roomTaken(odfroot, foot, width)) + dims.footer.gap;
        }
        return dims;
    }
    /**
     * The plan of the pages: the geometry of each master page a text goes
     * through, and the page each one begins at. A page takes the geometry of
     * the master page in force at it, so a landscape page in the middle of a
     * text is drawn landscape.
     * @constructor
     * @param {!odf.ODFDocumentElement} odfroot
     */
    function PagePlan(odfroot) {
        var self = this,
            sequence = masterPageSequence(odfroot),
            /**@type{!Array.<!odf.TextLayout.PageDimensions>}*/
            geometry = sequence.map(function (entry) {
                return roomForFurniture(odfroot,
                    readPageDimensions(odfroot, entry.master));
            }),
            /**@type{!Array.<!number>}*/
            // Until the pages are drawn, each change is taken to be one page
            // after the one before it: where a change falls is read from the
            // pages once they are drawn, see "follow".
            starts = [];
        while (starts.length < sequence.length) {
            starts.push(starts.length);
        }
        /**
         * The geometry of a page, from zero.
         * @param {!number} page
         * @return {!odf.TextLayout.PageDimensions}
         */
        this.at = function (page) {
            var i = starts.length - 1;
            while (i > 0 && starts[i] > page) {
                i -= 1;
            }
            return geometry[i];
        };
        /**
         * Where a page begins, in pixels from the first one.
         * @param {!number} page
         * @return {!number}
         */
        this.top = function (page) {
            var top = 0,
                n;
            for (n = 0; n < page; n += 1) {
                top += self.at(n).pageHeight + self.at(n).pageSeparation;
            }
            return top;
        };
        /**
         * The furniture of a page, the master page in force at it.
         * @param {!number} page
         * @return {!odf.TextLayout.PageFurniture}
         */
        this.furnitureAt = function (page) {
            var dims = self.at(page);
            return page === 0 ? dims.firstPage : dims.otherPages;
        };
        /**
         * The changes of master page the document writes, each with the
         * paragraph it begins at, or none for the first pages.
         * @return {!Array.<!{master:?Element,paragraph:?Element}>}
         */
        this.sequence = function () {
            return sequence;
        };
        /**
         * Say which page each change of master page begins at, where it is
         * known rather than read from the pages that are drawn.
         * @param {!Array.<!number>} pages
         * @return {undefined}
         */
        this.beginsAt = function (pages) {
            starts = pages;
        };
        /**
         * Read from the pages that are drawn which page each change of master
         * page falls on, and answer whether that moved anything.
         * @param {!number} pages how many pages are drawn
         * @return {!boolean}
         */
        this.follow = function (pages) {
            var moved = false,
                /**@type{!number}*/
                page,
                /**@type{!number}*/
                top,
                i;
            for (i = 1; i < sequence.length; i += 1) {
                if (!sequence[i].paragraph) {
                    page = Math.min(1, pages - 1);
                } else {
                    top = getTop(/**@type{!Element}*/(sequence[i].paragraph))
                        - getTop(/**@type{!Element}*/(getOfficeText(odfroot)));
                    page = 0;
                    while (page + 1 < pages && self.top(page + 1) <= top) {
                        page += 1;
                    }
                }
                page = Math.max(page, starts[i - 1] + (i > 1 ? 1 : 0));
                if (starts[i] !== page) {
                    starts[i] = page;
                    moved = true;
                }
            }
            return moved;
        };
    }
    /**
     * Where a page stands, from the corner of the drawn document.
     *
     * The pages are laid one under another, as a reader scrolls them, and
     * two or more of them stand side by side on a row when a reader asks
     * for that, as a book is read: the page of a row and the row it stands
     * on are read from the number of the page. The pages of a text broken
     * into columns stand where their column stands.
     * @param {!PagePlan} plan
     * @param {!number} page from zero
     * @return {!{left:!number,top:!number}}
     */
    function pagePlace(plan, page) {
        var dims = plan.at(page),
            // The first page of a book stands on the right, with the place
            // of a page on its left left empty, as the first page of a book
            // is a right hand page: a reader who asks for that is given it.
            /**@type{!number}*/
            slot = page + (firstPageOnItsOwn && pagesPerRow > 1
                ? 1
                : 0),
            /**@type{!number}*/
            row = Math.floor(slot / pagesPerRow),
            /**@type{!number}*/
            column = slot % pagesPerRow;
        if (pageMode === "columns") {
            return {left: columnPageOrigins[page] || 0, top: 0};
        }
        return {
            left: column * (dims.pageWidth + dims.pageSeparation),
            top: row * (dims.pageHeight + dims.pageSeparation)
        };
    }
    /**
     * A box that holds the shapes of one page, of the size of the sheet.
     * @param {!Document} doc
     * @param {?string} htmlns
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!number} left where the page begins across
     * @param {!number} top where the page begins
     * @return {!HTMLDivElement}
     */
    function pageShapesBox(doc, htmlns, dims, left, top) {
        var box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
            "div"));
        box.className = "webodf-pageShapes";
        box.style.position = "absolute";
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.width = dims.pageWidth + "px";
        box.style.height = dims.pageHeight + "px";
        return box;
    }
    /**
     * @param {!odf.TextLayout.PageShape} shape
     * @return {!boolean}
     */
    function behindTheText(shape) {
        return shape.background;
    }
    /**
     * @param {!odf.TextLayout.PageShape} shape
     * @return {!boolean}
     */
    function overTheText(shape) {
        return !shape.background;
    }
    /**
     * Take away the boxes of a former layout, wherever they were put.
     * @param {!Element} root
     * @return {undefined}
     */
    function removeBoxes(root) {
        var boxes = root.getElementsByTagName("div"),
            /**@type{!Element}*/
            box,
            /**@type{!number}*/
            i;
        for (i = boxes.length - 1; i >= 0; i -= 1) {
            box = /**@type{!Element}*/(boxes.item(i));
            if (box.className === "webodf-pageShapes"
                    || box.className === "webodf-pageFurniture"
                    || box.className === "webodf-pageSheet") {
                box.parentNode.removeChild(box);
            }
        }
    }
    /**
     * Draw the header and the footer of every page.
     *
     * They are drawn beside the text rather than in it: the boxes of the pages
     * hold the text away from the margins, and these are laid over the room
     * that was left, one for each page. Nothing of the text is touched.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @param {!Object.<!string,!string>} meta what the document says of itself
     * @param {!number=} from the first page to draw, where the pages that
     *        went before it are already drawn
     * @return {undefined}
     */
    function drawPageFurniture(odfroot, plan, pagesDiv, meta, from) {
        var /**@type{!Document}*/
            doc = /**@type{!Document}*/(pagesDiv.ownerDocument),
            /**@type{?string}*/
            htmlns = pagesDiv.namespaceURI,
            /**@type{!Element}*/
            behind = odfroot.body,
            pages = countPages(pagesDiv),
            /**@type{!number}*/
            total = recordedPageCount(odfroot) || countPages(pagesDiv),
            /**@type{!HTMLDivElement}*/
            box,
            /**@type{?Element}*/
            header,
            /**@type{?Element}*/
            footer,
            /**@type{!Array.<!odf.TextLayout.PageShape>}*/
            shapes,
            /**@type{!odf.TextLayout.PageDimensions}*/
            dims,
            /**@type{!Array.<!Element>}*/
            drawn = [],
            /**@type{!number}*/
            left = 0,
            /**@type{!number}*/
            top = 0,
            /**@type{!number}*/
            first = 0,
            /**@type{!{left:!number,top:!number}}*/
            place,
            /**@type{!number}*/
            n;
        first = from || 0;
        if (first === 0) {
            removeBoxes(pagesDiv);
            removeBoxes(behind);
        }
        // The body no longer paints the ground of the whole text: each page
        // is painted on its own, see the rule of "office|body" in
        // "webodf.css". A class would not do, as the engine of the styles
        // reads none on an element of another namespace.
        behind.setAttributeNS(webodfhelperns, "paginated", "true");
        for (n = first; n < pages; n += 1) {
            dims = plan.at(n);
            place = pagePlace(plan, n);
            left = place.left;
            top = place.top;
            header = pageArea(plan, "header", n + 1);
            footer = pageArea(plan, "footer", n + 1);
            // The sheet of the page, that carries its fill: it is drawn
            // first, and everything of the page is drawn over it.
            box = pageShapesBox(doc, htmlns, dims, left, top);
            box.className = "webodf-pageSheet";
            behind.insertBefore(box, behind.firstChild);
            shapes = plan.furnitureAt(n).shapes;
            if (shapes.length > 0) {
                // What is drawn over the text hangs beside it, as the header
                // and the footer do. What is drawn behind it is put in the
                // body of the document instead: the body carries the fill of
                // the page, that would otherwise cover the shape.
                box = pageShapesBox(doc, htmlns, dims, left, top);
                fillPageShapes(shapes.filter(overTheText), box);
                pagesDiv.appendChild(box);
                box = pageShapesBox(doc, htmlns, dims, left, top);
                fillPageShapes(shapes.filter(behindTheText), box);
                behind.insertBefore(box, behind.firstChild);
            }
            if (header) {
                box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
                    "div"));
                box.className = "webodf-pageFurniture";
                box.style.position = "absolute";
                box.style.left = (left + dims.marginLeft) + "px";
                box.style.width = (dims.pageWidth - dims.marginLeft
                    - dims.marginRight) + "px";
                box.style.top = (top + dims.marginTop - dims.header.gap
                    - dims.header.height) + "px";
                // The height of the style is the least it takes: a header of
                // two lines where one was asked for grows into the margin
                // rather than being cut.
                box.style.minHeight = dims.header.height + "px";
                fillPageArea(odfroot, header, box, n + 1, total, meta);
                pagesDiv.appendChild(box);
                drawn.push(box);
            }
            if (footer) {
                box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
                    "div"));
                box.className = "webodf-pageFurniture";
                box.style.position = "absolute";
                box.style.left = (left + dims.marginLeft) + "px";
                box.style.width = (dims.pageWidth - dims.marginLeft
                    - dims.marginRight) + "px";
                box.style.top = (top + dims.pageHeight - dims.marginBottom
                    + dims.footer.gap) + "px";
                box.style.minHeight = dims.footer.height + "px";
                fillPageArea(odfroot, footer, box, n + 1, total, meta);
                pagesDiv.appendChild(box);
                drawn.push(box);
            }
        }
        spreadLines(drawn);
    }
    /**
     * The paragraph a node stands in, if any.
     * @param {!Node} node
     * @return {?Element}
     */
    function paragraphOf(node) {
        var walk = node.parentNode;
        while (walk && walk.nodeType === Node.ELEMENT_NODE) {
            if (walk.namespaceURI === textns
                    && (walk.localName === "p" || walk.localName === "h")) {
                return /**@type{!Element}*/(walk);
            }
            walk = walk.parentNode;
        }
        return null;
    }
    /**
     * Write the number of pages the text was broken into in every header and
     * every foot that asks for it.
     *
     * The pages are broken one slice at a time, so the count is not known
     * until the last slice: the field carries the number the writer of the
     * document recorded until then, and the true one once the text is broken
     * whole. The line the field stands in is laid out again: a foot that
     * writes "page 3 of 785" holds the count against a tab stop at the right
     * margin, and a number of another width leaves the line askew where the
     * stops are not measured anew.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} pages
     * @return {undefined}
     */
    function tellPageCount(odfroot, pagesDiv, pages) {
        var fields = pagesDiv.getElementsByTagNameNS(textns, "page-count"),
            /**@type{!Array.<!Element>}*/
            lines = [],
            /**@type{?Element}*/
            paragraph,
            /**@type{!number}*/
            i;
        for (i = 0; i < fields.length; i += 1) {
            fields.item(i).textContent = String(pages);
        }
        for (i = 0; i < fields.length; i += 1) {
            paragraph = paragraphOf(/**@type{!Node}*/(fields.item(i)));
            if (paragraph && lines.indexOf(paragraph) === -1) {
                lines.push(paragraph);
            }
        }
        lines.forEach(function (paragraph) {
            layOutTabStops(odfroot, paragraph);
        });
    }
    /**
     * Whether a paragraph or a table asks to be written on a new page.
     *
     * The standard says it with "fo:break-before" on the style of the
     * paragraph, and with "fo:break-after" on the style of the one before
     * it, which comes to the same: what follows is written on a page of its
     * own. A style says it for itself or leans on one that says it.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} node
     * @param {!string} which "break-before" or "break-after"
     * @return {!boolean}
     */
    function asksForABreak(odfroot, node, which) {
        var /**@type{!string}*/
            first = node.getAttributeNS(textns, "style-name")
                || node.getAttributeNS(tablens, "style-name")
                || "",
            /**@type{!string}*/
            key = which + "/" + first,
            /**@type{!string}*/
            name = first,
            /**@type{!string}*/
            family = node.namespaceURI === tablens
                ? "table"
                : "paragraph",
            /**@type{?Element}*/
            style,
            /**@type{?Element}*/
            properties,
            /**@type{!string}*/
            said,
            /**@type{!string}*/
            box = family === "table"
                ? "table-properties"
                : "paragraph-properties",
            /**@type{!number}*/
            depth = 0;
        // A document holds a handful of styles for thousands of paragraphs,
        // and each one is read once: the answer is kept beside the styles
        // themselves, and dropped with them.
        if (styleCacheRoot === odfroot && breakCache.hasOwnProperty(key)) {
            return breakCache[key];
        }
        while (name !== "" && depth < 16) {
            style = styleOf(odfroot, name, family);
            if (!style && plainStyleName(name) !== name) {
                name = plainStyleName(name);
                style = styleOf(odfroot, name, family);
            }
            if (!style) {
                break;
            }
            properties = domUtils.getDirectChild(style, stylens, box);
            said = properties
                ? properties.getAttributeNS(fons, which) || ""
                : "";
            if (said !== "") {
                // The first style of the line that says anything says it
                // for the paragraph: a style that asks for no break stands
                // between the paragraph and a style above it that asks for
                // one, as a heading of the second rank does under a heading
                // of the first in the OpenDocument standard.
                breakCache[key] = said === "page";
                return breakCache[key];
            }
            name = style.getAttributeNS(stylens, "parent-style-name") || "";
            depth += 1;
        }
        breakCache[key] = false;
        return false;
    }
    /**
     * The prefixes of the document, written as the head of a sheet of styles.
     * @return {!string}
     */
    function namespaceRules() {
        var /**@type{!string}*/
            text = "";
        odf.Namespaces.forEachPrefix(function (prefix, ns) {
            text += "@namespace " + prefix + " url(" + ns + ");\n";
        });
        return text + "@namespace webodfhelper url(" + webodfhelperns + ");\n";
    }
    /**
     * The sheet of styles the layout writes its own rules in.
     *
     * The text is broken into pages by rules that are of the reader and not
     * of the document, so they are kept in a sheet of their own, made once
     * and written anew at each layout.
     * @param {!Document} doc
     * @return {!CSSStyleSheet}
     */
    function ownStyleSheet(doc) {
        var element = doc.getElementById("webodf-pageStyles");
        if (!element) {
            element = doc.createElementNS(doc.documentElement.namespaceURI,
                "style");
            element.id = "webodf-pageStyles";
            /**@type{!HTMLStyleElement}*/(element).type = "text/css";
            // The prefixes are written in the sheet itself and not put in it
            // by "insertRule": gecko parses a rule that names a prefix
            // against the prefixes the sheet was written with, and threw
            // "SyntaxError" on every selector of the layout, so no page was
            // ever drawn in firefox.
            element.appendChild(doc.createTextNode(namespaceRules()));
            doc.head.appendChild(element);
        }
        return /**@type{!CSSStyleSheet}*/(
            /**@type{!HTMLStyleElement}*/(element).sheet
        );
    }
    /**
     * Drop the rules the layout wrote before, and keep the prefixes the sheet
     * was written with, which are the first rules of it.
     * @param {!CSSStyleSheet} sheet
     * @return {undefined}
     */
    function clearOwnRules(sheet) {
        var /**@type{!number}*/
            i,
            /**@type{!CSSRule}*/
            rule;
        for (i = sheet.cssRules.length - 1; i >= 0; i -= 1) {
            rule = /**@type{!CSSRule}*/(sheet.cssRules.item(i));
            // A rule of a prefix, "CSSRule.NAMESPACE_RULE", is of the sheet
            // itself and is kept: only what a layout wrote is dropped.
            if (rule.type !== 10) {
                sheet.deleteRule(i);
            }
        }
    }
    /**
     * How many columns a box of columns holds.
     *
     * The width of the box says nothing: a box laid out as wide as it likes
     * is as wide as one column, and the columns that follow hang out of it,
     * each as long as what is written in it. A mark is put at the end of
     * what the box holds instead, and the column it falls in is the last
     * one.
     * @param {!Element} box
     * @param {!number} pitch from the left edge of a column to the next
     * @return {!number}
     */
    function columnsIn(box, pitch) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            htmlns = doc.documentElement.namespaceURI,
            mark = doc.createElementNS(htmlns, "span"),
            /**@type{!number}*/
            found;
        mark.className = "webodf-pageEnd";
        mark.appendChild(doc.createTextNode("\u00a0"));
        box.appendChild(mark);
        found = Math.floor((mark.getBoundingClientRect().left
            - box.getBoundingClientRect().left) / pitch) + 1;
        box.removeChild(mark);
        return Math.max(1, found);
    }
    /**
     * Take away the boxes that hold the runs of pages, giving the text back
     * the paragraphs they hold.
     * @param {!Element} text
     * @return {undefined}
     */
    function unwrapColumnRuns(text) {
        var /**@type{!Array.<!Element>}*/
            runs = [],
            /**@type{?Element}*/
            node = text.firstElementChild;
        while (node) {
            if (node.className === "webodf-pageRun") {
                runs.push(node);
            }
            node = node.nextElementSibling;
        }
        runs.forEach(function (run) {
            while (run.firstChild) {
                text.insertBefore(run.firstChild, run);
            }
            text.removeChild(run);
        });
    }
    /**
     * Put each run of pages written on the same master page in a box of its
     * own.
     *
     * A run of columns is of one width and of one height, and a document may
     * write its pages on master pages of several sizes, a page laid on its
     * side among pages laid upright: each run is broken into columns on its
     * own, and the runs stand beside one another, so the pages of the
     * document follow one another whatever their size.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @return {!Array.<!Element>}
     */
    function wrapColumnRuns(odfroot, plan) {
        var text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            doc = /**@type{!Document}*/(text.ownerDocument),
            htmlns = doc.documentElement.namespaceURI,
            sequence = plan.sequence(),
            /**@type{!Array.<!Element>}*/
            runs = [],
            /**@type{!Array.<!Element>}*/
            nodes = [],
            /**@type{!Array.<!Element>}*/
            begins = [],
            /**@type{!Element}*/
            run,
            /**@type{?Element}*/
            node;
        unwrapColumnRuns(text);
        sequence.forEach(function (entry, index) {
            if (index > 0 && entry.paragraph) {
                begins.push(/**@type{!Element}*/(entry.paragraph));
            }
        });
        node = text.firstElementChild;
        while (node) {
            nodes.push(node);
            node = node.nextElementSibling;
        }
        run = doc.createElementNS(htmlns, "div");
        run.className = "webodf-pageRun";
        text.appendChild(run);
        runs.push(run);
        nodes.forEach(function (element) {
            if (begins.indexOf(element) !== -1 && run.firstChild) {
                run = doc.createElementNS(htmlns, "div");
                run.className = "webodf-pageRun";
                text.appendChild(run);
                runs.push(run);
            }
            run.appendChild(element);
        });
        return runs;
    }
    /**
     * Break the text into columns, one column to a page.
     *
     * A page is a column of the size of what a page holds, and the browser
     * breaks the text into them itself: a line, a paragraph and a table are
     * all cut where a page ends, which no box floating beside the text can
     * do. The columns stand beside one another, and each page is drawn over
     * the column that carries it.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @param {!Array.<!Element>} runs
     * @return {!Array.<!number>} how many pages each run was broken into
     */
    function breakIntoColumns(odfroot, plan, runs) {
        var text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            doc = /**@type{!Document}*/(text.ownerDocument),
            sheet = ownStyleSheet(doc),
            /**@type{!Array.<!number>}*/
            pages = [],
            /**@type{!number}*/
            sofar = 0,
            /**@type{!number}*/
            round = 0,
            /**@type{!number}*/
            first = 0;
        clearOwnRules(sheet);
        // The runs stand beside one another, and the text no longer holds
        // the height of a page: each run holds its own.
        // The runs stand beside one another on one line, so neither the
        // body nor the text may hold them to the width of a page, and a run
        // may not be sent to the next line.
        sheet.insertRule("office|body {width:auto;}", sheet.cssRules.length);
        // The margins of the page are set on each run, so the text itself
        // no longer carries them: they would be taken twice, and the last
        // lines of a page would be written in the margin of its foot.
        sheet.insertRule("office|text {height:auto;width:auto;margin:0;"
            + "padding:0;white-space:nowrap;}", sheet.cssRules.length);
        sheet.insertRule(".webodf-pageRun {display:inline-block;"
            + "vertical-align:top;white-space:normal;}",
            sheet.cssRules.length);
        // The notes of the annotations stand in the lane beside each page,
        // so the pane that carries them beside the whole text is not drawn.
        sheet.insertRule("#annotationsPane {display:none;}",
            sheet.cssRules.length);
        // What the document asks to be written on a new page begins a new
        // column, which the browser answers for on its own.
        sheet.insertRule("*[webodfhelper|breakbefore] {break-before:column;}",
            sheet.cssRules.length);
        runs.forEach(function (run, index) {
            var /**@type{!odf.TextLayout.PageDimensions}*/
                dims = plan.at(sofar),
                /**@type{!number}*/
                width = dims.pageWidth - dims.marginLeft - dims.marginRight,
                /**@type{!number}*/
                height = dims.pageHeight - dims.marginTop - dims.marginBottom,
                /**@type{!number}*/
                pitch = dims.pageWidth + dims.pageSeparation + noteLane,
                /**@type{!number}*/
                broken;
            run.setAttributeNS(webodfhelperns, "webodfhelper:run",
                String(index));
            // The gutter between two columns holds the margins of the two
            // pages it parts, and the gap the reader sees between them.
            sheet.insertRule(".webodf-pageRun[webodfhelper|run=\"" + index
                + "\"] {"
                + "column-width:" + width + "px;"
                + "column-gap:" + (pitch - width) + "px;"
                + "column-fill:auto;"
                + "height:" + height + "px;"
                // The margins of the page are the margins of the run, and
                // the gap a reader sees between two pages is put after the
                // last column of it, so that the run that follows begins
                // beyond the edge of the page and not on it.
                + "margin:" + dims.marginTop + "px "
                + (dims.marginRight + dims.pageSeparation + noteLane)
                + "px "
                + dims.marginBottom + "px " + dims.marginLeft + "px;"
                + "}", sheet.cssRules.length);
            broken = columnsIn(run, pitch);
            pages.push(broken);
            sofar += broken;
        });
        // A box of columns is only as wide as one column when the width is
        // left to it, and the columns that follow the first hang out of it:
        // the box is given the width of all its columns, so that the run
        // that comes after it stands beside the last of them and not beside
        // the first. The width is set, read again and set anew: a run that
        // was given too few columns pours what is left into the last one.
        /**
         * @return {undefined}
         */
        function setWidths() {
            var /**@type{!number}*/
                count = 0;
            first = sheet.cssRules.length;
            pages.forEach(function (broken, index) {
                var /**@type{!odf.TextLayout.PageDimensions}*/
                    dims = plan.at(count),
                    /**@type{!number}*/
                    width = dims.pageWidth - dims.marginLeft
                        - dims.marginRight,
                    /**@type{!number}*/
                    pitch = dims.pageWidth + dims.pageSeparation + noteLane;
                sheet.insertRule(".webodf-pageRun[webodfhelper|run=\""
                    + index + "\"] {width:"
                    + (broken * pitch - (pitch - width)) + "px;}",
                    sheet.cssRules.length);
                count += broken;
            });
        }
        /**
         * @return {!boolean} whether every run holds all its columns
         */
        function widthsSettle() {
            var /**@type{!number}*/
                count = 0,
                /**@type{!boolean}*/
                settled = true;
            pages.forEach(function (broken, index) {
                var /**@type{!odf.TextLayout.PageDimensions}*/
                    dims = plan.at(count),
                    /**@type{!number}*/
                    pitch = dims.pageWidth + dims.pageSeparation + noteLane,
                    /**@type{!number}*/
                    asked = columnsIn(runs[index], pitch);
                if (asked > broken) {
                    pages[index] = asked;
                    settled = false;
                }
                count += broken;
            });
            return settled;
        }
        setWidths();
        while (round < 2 && !widthsSettle()) {
            while (sheet.cssRules.length > first) {
                sheet.deleteRule(sheet.cssRules.length - 1);
            }
            setWidths();
            round += 1;
        }
        return pages;
    }
    /**
     * Tell the browser which paragraphs are written on a new page.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {undefined}
     */
    /**
     * The first paragraph a node writes, or the node itself.
     *
     * A document holds its appendixes in a list, one to a list, so what asks
     * for a page of its own is the paragraph inside it and not the list: the
     * style of a list says nothing of the pages, and a break would be looked
     * for where none is ever written.
     * @param {!Element} element
     * @return {!Element}
     */
    function firstWritten(element) {
        var walk = element;
        while (walk.namespaceURI === textns
                && (walk.localName === "list"
                    || walk.localName === "list-item"
                    || walk.localName === "section")
                && walk.firstElementChild) {
            walk = walk.firstElementChild;
        }
        return walk;
    }
    /**
     * The last paragraph a node writes, or the node itself, see
     * "firstWritten".
     * @param {!Element} element
     * @return {!Element}
     */
    function lastWritten(element) {
        var walk = element;
        while (walk.namespaceURI === textns
                && (walk.localName === "list"
                    || walk.localName === "list-item"
                    || walk.localName === "section")
                && walk.lastElementChild) {
            walk = walk.lastElementChild;
        }
        return walk;
    }
    /**
     * Tell the browser which paragraphs are written on a new page.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {undefined}
     */
    function markPageBreaks(odfroot) {
        var text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            /**@type{!Array.<!Element>}*/
            nodes = [],
            /**@type{?Element}*/
            node = text.firstElementChild;
        while (node) {
            nodes.push(node);
            node = node.nextElementSibling;
        }
        nodes.forEach(function (element, index) {
            if (asksForABreak(odfroot, firstWritten(element), "break-before")
                    || (index > 0 && asksForABreak(odfroot,
                        lastWritten(nodes[index - 1]), "break-after"))) {
                element.setAttributeNS(webodfhelperns,
                    "webodfhelper:breakbefore", "true");
            } else {
                element.removeAttributeNS(webodfhelperns, "breakbefore");
            }
        });
    }
    /**
     * How many lines a paragraph is written over.
     *
     * The lines of a paragraph are the rectangles of the text it holds, of
     * which there may be more than one to a line where the line holds text
     * of more than one style: those that begin at the same height are of
     * one line.
     * @param {!Element} element
     * @return {!number}
     */
    function linesOf(element) {
        var doc = /**@type{!Document}*/(element.ownerDocument),
            range = doc.createRange(),
            /**@type{!Object.<string,boolean>}*/
            tops = {},
            /**@type{!ClientRectList}*/
            rects,
            /**@type{!number}*/
            i;
        range.selectNodeContents(element);
        rects = range.getClientRects();
        for (i = 0; i < rects.length; i += 1) {
            tops[String(Math.round(rects.item(i).top))] = true;
        }
        return Object.keys(tops).length;
    }
    /**
     * The number a style asks for, or the one that stands for none.
     * @param {!string} said
     * @param {!number} fallback
     * @return {!number}
     */
    function askedNumber(said, fallback) {
        var read = parseInt(said, 10);
        return isNaN(read) || read < 1
            ? fallback
            : read;
    }
    /**
     * Whether a paragraph that was cut in two is cut where an office would
     * cut it.
     *
     * An office leaves no line of a paragraph alone at the foot of a page,
     * nor alone at the head of the next: "fo:orphans" says how many lines
     * are kept at the foot and "fo:widows" how many at the head, and
     * "fo:keep-together" says that the paragraph is not cut at all. They are
     * read from the style the browser worked out, as the sheet of the
     * document carries them under the names css gives them.
     * @param {!Element} element what is left on the page
     * @param {!number} whole how many lines it held before it was cut
     * @return {!boolean}
     */
    function cutWhereAnOfficeWould(element, whole) {
        var style = runtime.getWindow().getComputedStyle(element),
            /**@type{!number}*/
            head,
            /**@type{!number}*/
            tail;
        if (!style) {
            return true;
        }
        if (style.getPropertyValue("break-inside") === "avoid") {
            return false;
        }
        head = linesOf(element);
        tail = whole - head;
        if (tail < 1) {
            return true;
        }
        return head >= askedNumber(style.getPropertyValue("orphans"), 2)
            && tail >= askedNumber(style.getPropertyValue("widows"), 2);
    }
    /**
     * Whether a paragraph is written on the page of the one that follows it.
     *
     * "fo:keep-with-next" says it of a heading, that an office never leaves
     * alone at the foot of a page. It is read from the style the browser
     * worked out, under the name css gives it.
     * @param {!Element} element
     * @return {!boolean}
     */
    function keepsWithWhatFollows(element) {
        var style = runtime.getWindow().getComputedStyle(element);
        return style
            ? style.getPropertyValue("break-after") === "avoid"
            : false;
    }
    /**
     * Whether anything that is seen is written on a page before a node.
     * @param {!Element} box
     * @param {!Node} node
     * @return {!boolean}
     */
    function anythingBefore(box, node) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            range;
        if (!box.firstChild || box.firstChild === node) {
            return false;
        }
        range = doc.createRange();
        range.setStartBefore(/**@type{!Node}*/(box.firstChild));
        range.setEndBefore(node);
        return range.getBoundingClientRect().height > 1;
    }
    /**
     * Whether a page holds anything that is seen.
     *
     * A page may hold the leftover of what was cut at the end of the page
     * before it and draw nothing of it — an empty table of contents, a
     * section that holds no more text: what asks to be written on a new page
     * is written on this one all the same, as the page is empty to a reader.
     * @param {!Element} box
     * @return {!boolean}
     */
    function holdsSomething(box) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            range;
        if (!box.firstChild) {
            return false;
        }
        range = doc.createRange();
        range.setStartBefore(/**@type{!Node}*/(box.firstChild));
        range.setEndAfter(/**@type{!Node}*/(box.lastChild));
        return range.getBoundingClientRect().height > 1;
    }
    /**
     * Whether a node was marked as beginning a page of its own.
     * @param {!Node} node
     * @return {!boolean}
     */
    function asksForANewPage(node) {
        return node.nodeType === Node.ELEMENT_NODE
            && /**@type{!Element}*/(node).hasAttributeNS(webodfhelperns,
                "breakbefore");
    }
    /**
     * The page a place across the drawn document falls on, from zero.
     * @param {!number} x from the left edge of the body of the document
     * @return {!number}
     */
    function pageOfPlace(x) {
        var found = 0;
        columnPageOrigins.forEach(function (left, index) {
            if (left <= x) {
                found = index;
            }
        });
        return found;
    }
    /**
     * Set the frames the document anchors to a page against that page.
     *
     * A frame anchored to a page stands at a place of the page and not of
     * the text, and the pages stand beside one another here: the frame is
     * set against the page the document names, "text:anchor-page-number", or
     * against the page the line it was written at stands on. It is drawn
     * where the styles of the canvas draw it otherwise, which is a place of
     * the text and would be the same place on every page.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!CSSStyleSheet} sheet
     * @return {undefined}
     */
    function setFramesAgainstTheirPage(odfroot, sheet) {
        var text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            frames = text.getElementsByTagNameNS(drawns, "frame"),
            ground = odfroot.body.getBoundingClientRect(),
            /**@type{!Array.<!Element>}*/
            anchored = [],
            /**@type{!Array.<!{x:!number,y:!number}>}*/
            wanted = [],
            /**@type{!number}*/
            first = sheet.cssRules.length,
            /**@type{!number}*/
            i;
        if (columnPageOrigins.length === 0) {
            return;
        }
        for (i = 0; i < frames.length; i += 1) {
            if (/**@type{!Element}*/(frames.item(i)).getAttributeNS(textns,
                    "anchor-type") === "page"
                    && /**@type{!Element}*/(frames.item(i)).getAttributeNS(
                        webodfhelperns,
                        "styleid"
                    )) {
                anchored.push(/**@type{!Element}*/(frames.item(i)));
            }
        }
        if (anchored.length === 0) {
            return;
        }
        // Where each frame is to stand, from the left edge of the body of the
        // document: the page it belongs to, and the place of the page the
        // document writes.
        anchored.forEach(function (frame) {
            var /**@type{!string}*/
                named = frame.getAttributeNS(textns, "anchor-page-number")
                    || "",
                /**@type{!number}*/
                page = named === ""
                    ? pageOfPlace(frame.getBoundingClientRect().left
                        - ground.left)
                    : Math.min(Math.max(0, parseInt(named, 10) - 1),
                        columnPageOrigins.length - 1);
            wanted.push({
                x: columnPageOrigins[page] + lengthInPx(frame, "x", 0, svgns),
                y: lengthInPx(frame, "y", 0, svgns)
            });
        });
        // A frame is set against the box that holds it, the paragraph it was
        // written in, and not against the body: it is first drawn at the
        // corner of that box, so that where the corner stands can be read,
        // and then set at what is left between the corner and the page.
        anchored.forEach(function (frame) {
            sheet.insertRule("draw|" + frame.localName
                + "[webodfhelper|styleid=\""
                + frame.getAttributeNS(webodfhelperns, "styleid")
                + "\"] {position:absolute;left:0;top:0;}",
                sheet.cssRules.length);
        });
        anchored.forEach(function (frame, index) {
            var box = frame.getBoundingClientRect();
            wanted[index].x -= box.left - ground.left;
            wanted[index].y -= box.top - ground.top;
        });
        while (sheet.cssRules.length > first) {
            sheet.deleteRule(sheet.cssRules.length - 1);
        }
        anchored.forEach(function (frame, index) {
            sheet.insertRule("draw|" + frame.localName
                + "[webodfhelper|styleid=\""
                + frame.getAttributeNS(webodfhelperns, "styleid")
                + "\"] {position:absolute;"
                + "left:" + wanted[index].x + "px;"
                + "top:" + wanted[index].y + "px;}",
                sheet.cssRules.length);
        });
    }
    /**
     * Take away the boxes that hold the pages, giving the text back the
     * paragraphs they hold.
     * @param {!Element} text
     * @return {undefined}
     */
    function unwrapPageBoxes(text) {
        var /**@type{!Array.<!Element>}*/
            boxes = [],
            /**@type{?Element}*/
            node = text.firstElementChild;
        while (node) {
            if (node.className === "webodf-pageBox") {
                boxes.push(node);
            }
            node = node.nextElementSibling;
        }
        boxes.forEach(function (box) {
            while (box.firstChild) {
                text.insertBefore(box.firstChild, box);
            }
            text.removeChild(box);
        });
    }
    /**
     * A range that holds one node.
     * @param {!Document} doc
     * @param {!Node} node
     * @return {!Range}
     */
    function rangeOf(doc, node) {
        var range = doc.createRange();
        range.selectNode(node);
        return range;
    }
    /**
     * The first thing on a page that crosses the end of it, if any.
     *
     * The last thing on a page is not always the lowest of them: a frame set
     * against the page stands where the page says, and it may stand high on
     * a page it was written at the foot of.
     * @param {!Element} box the page
     * @return {?Element}
     */
    function firstOverflowing(box) {
        var edge = box.getBoundingClientRect().bottom,
            /**@type{?Element}*/
            node = box.firstElementChild,
            /**@type{!ClientRect}*/
            rect;
        while (node) {
            rect = node.getBoundingClientRect();
            if ((rect.height > 0 || rect.width > 0)
                    && rect.bottom > edge + 1) {
                return node;
            }
            node = node.nextElementSibling;
        }
        return null;
    }
    /**
     * Whether an element is drawn out of the flow of the text.
     *
     * A frame anchored to the page is set against the page and stands where
     * the page says, so it is not read with what follows the text: the
     * browser is asked, and only of the few elements that may be so.
     * @param {!Element} element
     * @return {!boolean}
     */
    function isOutOfFlow(element) {
        var style;
        if (element.namespaceURI !== drawns) {
            return false;
        }
        style = runtime.getWindow().getComputedStyle(element);
        return style
            ? style.position === "absolute" || style.position === "fixed"
            : false;
    }
    /**
     * How many of the nodes a page was given stand within it.
     *
     * The nodes are read where they stand and none of them is moved, so the
     * page is laid out once for the whole of the reading: what is read after
     * something is written is laid out anew, and taking the nodes back one
     * at a time lays the page out once for each of them.
     * @param {!Element} box
     * @param {!Array.<!Node>} added the nodes that were written on the page
     * @return {!number} how many of them the page holds
     */
    function firstOver(box, added) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            edge = box.getBoundingClientRect().bottom,
            range = doc.createRange(),
            /**@type{!ClientRect}*/
            rect,
            /**@type{!number}*/
            i;
        for (i = 0; i < added.length; i += 1) {
            range.setStartBefore(added[i]);
            range.setEndAfter(added[i]);
            rect = range.getBoundingClientRect();
            if ((rect.height > 0 || rect.width > 0) && rect.bottom > edge + 1) {
                return i;
            }
        }
        return added.length;
    }
    /**
     * Whether what a box holds is taller than the box.
     * @param {!Element} box
     * @param {?Node=} from the first node to read, the head of the box by
     *                 default: what stands before it was read already.
     * @return {!boolean}
     */
    function overflows(box, from) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            /**@type{!number}*/
            edge = box.getBoundingClientRect().bottom,
            /**@type{?Node}*/
            node = from || box.firstChild,
            range = doc.createRange(),
            /**@type{!ClientRect}*/
            rect;
        // Every child is read and not the last of them alone: a frame set
        // against the page stands where the page says, so the last child of
        // a page is not always the lowest of them.
        //
        // What was measured before and held is not measured again: a node
        // that is written after another does not move it, so a page that is
        // filled a few nodes at a time is read from the first of them and
        // not from the head of the page, which would read a page of a
        // hundred nodes a hundred times over.
        if (!node) {
            return false;
        }
        // The nodes are read in one measure and not one by one: a range that
        // holds them all answers with the rectangle that holds what they are
        // drawn as, which is the one the page is read against. A page filled
        // by chunks of sixty-four nodes is measured once for the chunk and
        // not sixty-four times.
        range.setStartBefore(node);
        range.setEndAfter(/**@type{!Node}*/(box.lastChild));
        rect = range.getBoundingClientRect();
        if ((rect.height > 0 || rect.width > 0) && rect.bottom > edge + 1) {
            return true;
        }
        // What is drawn out of the flow of the text — a frame set against the
        // page — stands where the page says and is none of the range: those
        // are read on their own, and there are few of them.
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE
                    && isOutOfFlow(/**@type{!Element}*/(node))) {
                rect = /**@type{!Element}*/(node).getBoundingClientRect();
                if ((rect.height > 0 || rect.width > 0)
                        && rect.bottom > edge + 1) {
                    return true;
                }
            }
            node = node.nextSibling;
        }
        return false;
    }
    /**
     * Cut a text node where the page ends, and answer what is left of it.
     * @param {!Element} box the page
     * @param {!Text} node
     * @param {!boolean} alone whether the page holds nothing else
     * @return {?Text} what did not fit, or nothing if all of it fits
     */
    function cutText(box, node, alone) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            range = doc.createRange(),
            bottom = box.getBoundingClientRect().bottom,
            /**@type{!number}*/
            low = 0,
            /**@type{!number}*/
            high = node.length,
            /**@type{!number}*/
            middle;
        // The letter the page ends at is looked for by halving: the text up
        // to it is measured, and the half that holds the end is kept.
        while (low + 1 < high) {
            middle = Math.floor((low + high) / 2);
            range.setStart(node, 0);
            range.setEnd(node, middle);
            if (range.getBoundingClientRect().bottom <= bottom) {
                low = middle;
            } else {
                high = middle;
            }
        }
        if (low >= node.length) {
            return null;
        }
        if (low === 0 && !alone) {
            // Not a word of it fits on what is left of the page, so all of
            // it is written on the next one: a page that holds nothing else
            // keeps a letter of it all the same, or the text would be sent
            // from page to page for ever.
            return node.splitText(0);
        }
        // The cut is made at the last blank before the letter, so that a
        // word is not written half on one page and half on the next. Where
        // there is no blank to cut at, the whole of it is written on the
        // page that follows: a page that ended with the "A" of "Appendix"
        // and gave "ppendix" to the next is no page of a document. A page
        // that holds nothing else cuts all the same, or the text would be
        // sent from page to page for ever.
        middle = String(node.data).lastIndexOf(" ", low);
        if (middle <= 0) {
            // Nothing of the word fits: the whole of it is written on the
            // page that follows, unless the page holds nothing that is seen
            // before it, where a page would else be left empty and the word
            // sent on for ever.
            return anythingBefore(box, node)
                ? node.splitText(0)
                : node.splitText(Math.max(1, low));
        }
        return node.splitText(middle + 1);
    }
    /**
     * Whether a node is the rows of the head of a table.
     * @param {!Node} node
     * @return {!boolean}
     */
    function isHeaderRows(node) {
        return node.nodeType === Node.ELEMENT_NODE
            && node.namespaceURI === tablens
            && node.localName === "table-header-rows";
    }
    /**
     * Whether a node says how wide the columns of a table are.
     *
     * Such an element holds no text and is drawn over the whole height of
     * the table, so its foot is past the end of every page but the last: read
     * as content, it sent every row to the next page for ever.
     * @param {!Node} node
     * @return {!boolean}
     */
    function isTableColumns(node) {
        return node.nodeType === Node.ELEMENT_NODE
            && node.namespaceURI === tablens
            && (node.localName === "table-column"
                || node.localName === "table-columns"
                || node.localName === "table-column-group");
    }
    /**
     * Whether a node is a row of a table, of the kind that is written whole
     * on one page.
     * @param {!Node} node
     * @return {!boolean}
     */
    function isTableRow(node) {
        return node.nodeType === Node.ELEMENT_NODE
            && node.namespaceURI === tablens
            && (node.localName === "table-row"
                || node.localName === "table-rows");
    }
    /**
     * Whether nothing stands before this child of the element but the rows of
     * the head of a table, which are written again at the top of every page
     * the table runs over.
     *
     * A row that follows them alone is the first thing the page holds, and it
     * is kept there whatever its height: a row taller than a page would
     * otherwise be moved to a page of its own for ever, and every page would
     * be written with the head of the table and nothing else.
     * @param {!Element} element
     * @param {!Node} node
     * @return {!boolean}
     */
    function afterHeaderRowsOnly(element, node) {
        var before = element.firstChild;
        while (before && before !== node) {
            if (!isHeaderRows(before)
                    && !(before.nodeType === Node.TEXT_NODE
                        && !before.textContent.trim())) {
                return false;
            }
            before = before.nextSibling;
        }
        return true;
    }
    /**
     * How many nodes a node holds, counted no further than a bound.
     * @param {!Node} node
     * @param {!number} bound
     * @return {!number}
     */
    function nodesIn(node, bound) {
        var count = 1,
            /**@type{?Node}*/
            child = node.firstChild;
        while (child && count < bound) {
            count += nodesIn(child, bound - count);
            child = child.nextSibling;
        }
        return count;
    }
    /**
     * Take out of an element everything past the first so many nodes.
     *
     * A document holds elements that hold thousands of nodes: a table of
     * contents is one of them, and a page of it was written by measuring the
     * whole of what was left, page after page. The element is parted in two
     * beforehand, by counting and not by measuring, so that a page is drawn
     * against what a page may hold and not against everything that is left
     * to write.
     *
     * What is taken out is put in a copy of the element, as a cut does, so
     * that it is written in the style it was written in.
     * @param {!Element} element
     * @param {!number} bound how many nodes are left in it
     * @return {?Element} what was taken out, or null where it held less
     */
    function splitOff(element, bound) {
        var count = 1,
            /**@type{?Node}*/
            node = element.firstChild,
            /**@type{!Element}*/
            tail = /**@type{!Element}*/(element.cloneNode(false)),
            /**@type{?Element}*/
            inner,
            /**@type{?Node}*/
            next;
        tail.setAttributeNS(webodfhelperns, "webodfhelper:continued", "true");
        while (node && count < bound) {
            count += nodesIn(node, bound - count);
            if (count >= bound && node.firstChild
                    && node.nodeType === Node.ELEMENT_NODE) {
                // The bound falls inside this one: what it holds past the
                // bound is taken out of it in the same way.
                inner = splitOff(/**@type{!Element}*/(node), bound);
                if (inner) {
                    tail.appendChild(inner);
                }
                node = node.nextSibling;
                break;
            }
            node = node.nextSibling;
        }
        while (node) {
            next = node.nextSibling;
            tail.appendChild(node);
            node = next;
        }
        return tail.firstChild
            ? tail
            : null;
    }
    /**
     * Whether a table may be cut between two of its rows.
     *
     * A table that says "style:may-break-between-rows" is false is written
     * whole on one page, as an office writes it: it goes to the page that
     * follows rather than being cut, unless the page holds nothing else and
     * it is taller than a page, where it is cut all the same.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!Element} table
     * @return {!boolean}
     */
    function mayBreakBetweenRows(odfroot, table) {
        var name = table.getAttributeNS(tablens, "style-name") || "",
            /**@type{?Element}*/
            style,
            /**@type{?Element}*/
            properties,
            /**@type{!string}*/
            said = "",
            /**@type{!number}*/
            depth = 0;
        while (name !== "" && said === "" && depth < 16) {
            style = styleOf(odfroot, name, "table");
            if (!style && plainStyleName(name) !== name) {
                name = plainStyleName(name);
                style = styleOf(odfroot, name, "table");
            }
            if (!style) {
                break;
            }
            properties = domUtils.getDirectChild(style, stylens,
                "table-properties");
            said = properties
                ? properties.getAttributeNS(stylens, "may-break-between-rows")
                    || ""
                : "";
            name = style.getAttributeNS(stylens, "parent-style-name") || "";
            depth += 1;
        }
        return said !== "false";
    }
    /**
     * Cut an element where the page ends, and answer what is left of it: a
     * copy of the element that holds what did not fit.
     *
     * A paragraph is cut between two of its words, a table between two of its
     * rows, and an element that holds neither is not cut at all: it is
     * written whole on the page that follows.
     * @param {!Element} box the page
     * @param {!Element} element
     * @param {!number} depth how far the cut may reach into the element
     * @param {!boolean} alone whether the page holds nothing else
     * @param {?odf.ODFDocumentElement=} odfroot the document, that says of a
     *                  table whether it may be cut between two of its rows
     * @return {?Element} what did not fit, or nothing if all of it fits
     */
    function cutElement(box, element, depth, alone, odfroot) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            bottom = box.getBoundingClientRect().bottom,
            /**@type{?Node}*/
            node = element.firstChild,
            /**@type{?Node}*/
            from = null,
            /**@type{?Element}*/
            inner = null,
            /**@type{!Element}*/
            tail,
            /**@type{?Element}*/
            head,
            /**@type{?Node}*/
            column,
            /**@type{?Node}*/
            next,
            /**@type{!ClientRect}*/
            rect;
        // A table that is written whole is not cut: it goes to the page
        // that follows, unless the page holds nothing else, where it is cut
        // rather than sent from page to page for ever.
        if (!alone && element.namespaceURI === tablens
                && element.localName === "table"
                && odfroot !== undefined && odfroot !== null
                && !mayBreakBetweenRows(odfroot, element)) {
            return null;
        }
        // What the element itself says of its size is not read: a section
        // and a list of the standard are drawn of no height at all while
        // what they hold is drawn under them, and nothing of them would
        // ever be cut. The children answer for it.
        while (node && !from && !inner) {
            rect = node.nodeType === Node.TEXT_NODE
                ? rangeOf(doc, node).getBoundingClientRect()
                : /**@type{!Element}*/(node).getBoundingClientRect();
            if (isTableColumns(node)) {
                // The columns say how wide the table is and hold nothing that
                // is read: they are of the table and not of the page.
                node = node.nextSibling;
            } else if (isHeaderRows(node)
                    && node === element.firstElementChild) {
                // The rows of the head of a table belong to the head of it
                // and are never moved: they are written again at the top of
                // what follows, see below. A document that writes such rows
                // further down, where it broke the table itself, writes rows
                // like any other there, and they are moved like any other.
                node = node.nextSibling;
            } else if (rect.bottom > bottom) {
                if (node.nodeType === Node.TEXT_NODE) {
                    from = cutText(box, /**@type{!Text}*/(node), alone)
                        || node;
                } else if (isTableRow(node)
                        && !(alone && afterHeaderRowsOnly(element, node))) {
                    // A row of a table is written whole on one page or on
                    // the next, and never cut across, which would part the
                    // cells of one row from one another. A row taller than
                    // a page is cut all the same, as it is that or nothing.
                    from = node;
                } else if (depth > 0) {
                    inner = cutElement(box, /**@type{!Element}*/(node),
                        depth - 1, alone, odfroot);
                    if (!inner) {
                        from = node;
                    }
                } else {
                    from = node;
                }
            } else {
                node = node.nextSibling;
            }
        }
        if (!from && !inner) {
            return null;
        }
        // What is left is put in a copy of the element, so that it is written
        // on the next page in the style it was written in: what was cut out
        // of the child that crossed the end of the page, and everything that
        // follows that child.
        tail = /**@type{!Element}*/(element.cloneNode(false));
        // What is left of an element that was cut is no new element of the
        // document: a list that goes on over a page holds no first item of
        // its own, and its numbers go on where the page before them left,
        // see "ListStylesToCss.js".
        tail.setAttributeNS(webodfhelperns, "webodfhelper:continued", "true");
        // A table that is cut in two writes the rows of its head again at
        // the top of what follows, as an office does.
        if (element.namespaceURI === tablens) {
            // The columns of the table are written again with it, before its
            // head, as they are the width of what follows.
            column = element.firstChild;
            while (column) {
                if (isTableColumns(column)) {
                    tail.appendChild(column.cloneNode(true));
                }
                column = column.nextSibling;
            }
        }
        head = domUtils.getDirectChild(element, tablens, "table-header-rows");
        if (head && element.namespaceURI === tablens
                && !(from && isHeaderRows(from))) {
            tail.appendChild(head.cloneNode(true));
        }
        if (inner) {
            tail.appendChild(inner);
            from = node
                ? node.nextSibling
                : null;
        }
        while (from) {
            next = from.nextSibling;
            tail.appendChild(from);
            from = next;
        }
        return tail.firstChild
            ? tail
            : null;
    }
    /**
     * Break the text into pages, one box to a page, laid one under another.
     *
     * The text is put in the box of the first page, and what does not fit in
     * it is cut off and put in the next: a paragraph is cut between two of
     * its words and a table between two of its rows, so that a page holds
     * what a page holds and nothing is lost between two of them.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @return {!number} how many pages the text was broken into
     */
    /**
     * Fill one page, and answer with the page that was filled.
     *
     * The paragraphs are taken from what waits to be written, several at a
     * time and read once: a page holds many of them, and each measure has
     * the browser lay the page out again. What was written too much is taken
     * back and written one at a time, and what crosses the end of the page
     * is cut there.
     * @param {!odf.TextLayout.Filling} state
     * @return {undefined}
     */
    function fillOnePage(state) {
        var doc = state.doc,
            /**@type{!odf.TextLayout.PageDimensions}*/
            dims = /**@type{!PagePlan}*/(state.plan).at(state.page),
            /**@type{!Element}*/
            box = /**@type{!Element}*/(doc.createElementNS(state.htmlns,
                "div")),
            /**@type{!Array.<!Node>}*/
            added,
            /**@type{?Node}*/
            taken,
            /**@type{?Node}*/
            node,
            /**@type{?Element}*/
            rest,
            /**@type{?Element}*/
            more,
            /**@type{?Element}*/
            over,
            /**@type{!Array.<!Node>}*/
            sent,
            /**@type{?Node}*/
            walk,
            /**@type{?Node}*/
            next,
            /**@type{!number}*/
            held,
            /**@type{!number}*/
            lines,
            /**@type{?Element}*/
            keeper,
            /**@type{!number}*/
            guard,
            /**@type{!{left:!number,top:!number}}*/
            place,
            /**@type{!number}*/
            n;
        box.className = "webodf-pageBox";
        // The box is the whole width of the paper, with the margins of the
        // page as its padding: a table written for a page of another size is
        // wider than the text of this one, and runs into the margin, as an
        // office draws it, rather than being cut off at the edge of the text.
        /**@type{!HTMLElement}*/(box).style.boxSizing = "border-box";
        /**@type{!HTMLElement}*/(box).style.paddingLeft =
            dims.marginLeft + "px";
        /**@type{!HTMLElement}*/(box).style.paddingRight =
            dims.marginRight + "px";
        /**@type{!HTMLElement}*/(box).style.width = dims.pageWidth + "px";
        /**@type{!HTMLElement}*/(box).style.height =
            (dims.pageHeight - dims.marginTop - dims.marginBottom) + "px";
        // A page is set at the place of the page it is, and not left to
        // follow the one before it: the margin of the foot of a page and the
        // margin of the head of the next fall into one another where margins
        // are used, and the pages would stand closer than the sheets they
        // are drawn on.
        /**@type{!HTMLElement}*/(box).style.position = "absolute";
        place = pagePlace(/**@type{!PagePlan}*/(state.plan), state.page);
        /**@type{!HTMLElement}*/(box).style.left = place.left + "px";
        /**@type{!HTMLElement}*/(box).style.top = (place.top
            + dims.marginTop) + "px";
        state.top = place.top + dims.pageHeight + dims.pageSeparation;
        state.text.appendChild(box);
        while (state.waiting.length > 0) {
            added = /**@type{!Array.<!Node>}*/([]);
            while (added.length < state.chunk && state.waiting.length > 0) {
                node = /**@type{!Node}*/(state.waiting[0]);
                // What the document asks to be written on a new page ends
                // the page that is being filled, unless it is the first
                // thing on it: a break before the first node would leave an
                // empty page behind, and the browser is asked for the same
                // where the pages are broken into columns.
                if (asksForANewPage(node) && holdsSomething(box)) {
                    break;
                }
                // An element of thousands of nodes — a table of contents,
                // a long section — is parted before it is written: a page is
                // drawn against what a page may hold, and not against the
                // whole of what is left to write, which was drawn again for
                // every page of it.
                if (node.nodeType === Node.ELEMENT_NODE
                        && nodesIn(node, nodesToAPage + 1) > nodesToAPage) {
                    rest = splitOff(/**@type{!Element}*/(node), nodesToAPage);
                    if (rest) {
                        state.waiting.splice(1, 0, rest);
                    }
                }
                state.waiting.shift();
                box.appendChild(node);
                added.push(node);
            }
            if (added.length === 0) {
                break;
            }
            if (added.length > 1 && overflows(box, added[0])) {
                // The chunk is more than the page holds: the first node of
                // it that crosses the end of the page is looked for, and
                // everything from there is taken back at once.
                //
                // The nodes are read where they stand, one reading of the
                // page answering for all of them: taking them back one at a
                // time reads the page again for each, as the browser lays
                // out anew whatever is read after something is written.
                held = firstOver(box, added);
                while (added.length > held) {
                    taken = /**@type{!Node}*/(added.pop());
                    box.removeChild(taken);
                    state.waiting.unshift(taken);
                }
                state.chunk = Math.max(1, added.length);
            }
            if (added.length === 0
                    || !overflows(box, added[0])) {
                node = null;
            } else {
                node = /**@type{!Node}*/(added[added.length - 1]);
                if (node.nodeType === Node.ELEMENT_NODE) {
                    held = String(node.textContent).length;
                    lines = linesOf(/**@type{!Element}*/(node));
                    rest = cutElement(box, /**@type{!Element}*/(node), 8,
                        box.childNodes.length === 1, state.root);
                    if (rest && box.childNodes.length > 1
                            && !cutWhereAnOfficeWould(
                                /**@type{!Element}*/(node), lines
                            )) {
                        // The cut would leave a line alone at the foot of
                        // the page or at the head of the next: the whole of
                        // it is written on the page that follows.
                        while (rest.firstChild) {
                            node.appendChild(rest.firstChild);
                        }
                        rest = null;
                    }
                    if (rest && String(rest.textContent).length >= held
                            && held > 0) {
                        // Nothing of it was left on the page, so cutting it
                        // gains nothing: it is written whole, here if the
                        // page holds nothing else and on the next page
                        // otherwise, or it would be cut for ever and never
                        // written.
                        while (rest.firstChild) {
                            node.appendChild(rest.firstChild);
                        }
                        rest = null;
                    }
                    if (rest) {
                        state.waiting.unshift(rest);
                    } else if (box.childNodes.length > 1) {
                        box.removeChild(node);
                        state.waiting.unshift(node);
                    }
                } else if (box.childNodes.length > 1) {
                    // What is not an element is written whole, on this page
                    // when the page is empty and on the next when it is not.
                    box.removeChild(node);
                    state.waiting.unshift(node);
                }
                node = null;
                break;
            }
        }
        // The page is read once it is filled: the first thing that crosses
        // its end is cut there, and what was written after it goes to the
        // next page with what was cut off.
        guard = 2;
        over = firstOverflowing(box);
        while (guard > 0 && over) {
            held = String(over.textContent).length;
            more = cutElement(box, over, 8, over === box.firstElementChild);
            if (more && String(more.textContent).length >= held
                    && held > 0) {
                while (more.firstChild) {
                    over.appendChild(more.firstChild);
                }
                more = null;
            }
            sent = [];
            walk = over.nextSibling;
            while (walk) {
                next = walk.nextSibling;
                sent.push(walk);
                box.removeChild(walk);
                walk = next;
            }
            if (more) {
                sent.unshift(more);
            } else if (over !== box.firstElementChild) {
                sent.unshift(over);
                box.removeChild(over);
            }
            if (sent.length === 0) {
                guard = 0;
            } else {
                for (n = sent.length - 1; n >= 0; n -= 1) {
                    state.waiting.unshift(sent[n]);
                }
                guard -= 1;
                over = firstOverflowing(box);
            }
        }
        // A heading is not left alone at the foot of a page: what asks to
        // be kept with what follows it is written on the page that follows,
        // with the run of paragraphs that ask the same before it, unless
        // nothing would be left on the page.
        keeper = box.lastElementChild;
        while (keeper && keeper !== box.firstElementChild
                && state.waiting.length > 0 && keepsWithWhatFollows(keeper)) {
            state.waiting.unshift(keeper);
            box.removeChild(keeper);
            keeper = box.lastElementChild;
        }
        // The pages that follow are filled by as many at a time as the page
        // that was just filled took: a page of a hundred short paragraphs is
        // not read a hundred times.
        state.chunk = Math.max(4, Math.min(64,
            Math.floor(box.childNodes.length / 2)));
        state.page += 1;
    }
    /**
     * Put back in the text what a layout that is under way holds aside.
     *
     * The pages are filled a few at a time, and what is not written yet
     * waits out of the document: a layout that begins while another is still
     * filling would find the text short of everything that waits, and would
     * draw the pages that were drawn already and nothing else. A reader that
     * asks for two pages to a row in the middle of the filling asks for
     * exactly that.
     * @param {!Element} text
     * @return {undefined}
     */
    function giveBackWaiting(text) {
        if (!filling || filling.text !== text) {
            filling = null;
            return;
        }
        while (filling.waiting.length > 0) {
            text.appendChild(/**@type{!Node}*/(filling.waiting.shift()));
        }
        filling = null;
    }
    /**
     * Make ready to break a text into pages: the rules the pages are drawn
     * by are written, and what is to be written is taken out of the document
     * while it is laid out, as a text that waits in the document is laid out
     * again at every measure.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @return {!odf.TextLayout.Filling}
     */
    function startPages(odfroot, plan) {
        var text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            doc = /**@type{!Document}*/(text.ownerDocument),
            sheet = ownStyleSheet(doc),
            /**@type{!DocumentFragment}*/
            store = doc.createDocumentFragment(),
            /**@type{!Array.<!Node>}*/
            waiting = [];
        clearOwnRules(sheet);
        sheet.insertRule("office|text {width:auto;margin:0;padding:0;"
            + "position:relative;}", sheet.cssRules.length);
        // A page holds what it holds and is of the size the plan gives it:
        // the browser is told so, so that a page that is filled is laid out
        // on its own and not with the pages that went before it. Without it
        // every measure of the page being filled lays out the whole of the
        // document again, and a document of eight hundred pages is laid out
        // eight hundred times over.
        // A page holds what it holds and is of the size the plan gives it:
        // the browser is told so, so that a page that is filled is laid out
        // on its own and not with the pages that went before it. Without it
        // every measure of the page being filled lays out the whole of the
        // document again, and a document of eight hundred pages is laid out
        // eight hundred times over.
        //
        // The styles of a page are its own as well, which holds the counters
        // of css to the page: the labels of the lists are worked out once
        // and written on the elements, so nothing of the document is counted
        // by them any more, see "numberLists" in "ListStylesToCss.js".
        sheet.insertRule(".webodf-pageBox {overflow:hidden;contain:strict;}",
            sheet.cssRules.length);
        while (text.firstChild) {
            store.appendChild(text.firstChild);
        }
        while (store.firstChild) {
            waiting.push(store.firstChild);
            store.removeChild(store.firstChild);
        }
        return {
            text: text,
            root: odfroot,
            doc: doc,
            htmlns: doc.documentElement.namespaceURI,
            plan: plan,
            waiting: waiting,
            chunk: 8,
            slice: 0,
            page: 0,
            top: 0,
            sheet: sheet,
            heightRule: -1
        };
    }
    /**
     * Draw a text over pages, breaking it into columns.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @return {undefined}
     */
    function layoutInColumns(odfroot, pagesDiv) {
        var /**@type{!Element}*/
            text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            /**@type{!PagePlan}*/
            plan,
            /**@type{!Array.<!Element>}*/
            runs,
            /**@type{!Array.<!number>}*/
            perRun,
            /**@type{!Array.<!number>}*/
            begins = [],
            /**@type{!number}*/
            total = 0,
            /**@type{!number}*/
            ground = 0,
            /**@type{!number}*/
            left = 0;
        while (pagesDiv.firstChild) {
            pagesDiv.removeChild(pagesDiv.firstChild);
        }
        // The boxes of a layout that went before are taken away first: the
        // paragraphs of the document are read to know where a master page
        // changes, and they are read from the text itself.
        unwrapColumnRuns(text);
        unwrapPageBoxes(text);
        giveBackWaiting(text);
        layOutTabsOfText(odfroot);
        plan = new PagePlan(odfroot);
        markPageBreaks(odfroot);
        runs = wrapColumnRuns(odfroot, plan);
        perRun = breakIntoColumns(odfroot, plan, runs);
        // Where each run begins, in pages and in pixels: a page is drawn
        // over the column that carries it, and a run of another size moves
        // the runs that follow it.
        columnPageOrigins = [];
        ground = odfroot.body.getBoundingClientRect().left;
        perRun.forEach(function (pages, index) {
            var /**@type{!odf.TextLayout.PageDimensions}*/
                dims = plan.at(total),
                /**@type{!number}*/
                pitch = dims.pageWidth + dims.pageSeparation + noteLane,
                /**@type{!number}*/
                n;
            // Where the run stands is read from the run itself: the boxes
            // of the runs follow one another as the browser lays them out,
            // and a page is drawn over the column that carries it.
            left = runs[index].getBoundingClientRect().left - ground
                - dims.marginLeft;
            begins.push(total);
            for (n = 0; n < pages; n += 1) {
                columnPageOrigins.push(left + n * pitch);
            }
            total += pages;
        });
        plan.beginsAt(begins);
        columnPageSize = {
            width: plan.at(0).pageWidth,
            height: plan.at(0).pageHeight
        };
        columnPages = Math.min(total, maxPages);
        setFramesAgainstTheirPage(odfroot, ownStyleSheet(
            /**@type{!Document}*/(text.ownerDocument)
        ));
        drawPageFurniture(odfroot, plan, pagesDiv, readMeta(odfroot));
    }
    /**
     * Set every page from one of them onwards at the place of its number.
     *
     * A page that is made between two others moves the ones that follow it
     * down by one: each is drawn where its number says, and the number of
     * each of them has changed.
     * @param {!PagePlan} plan
     * @param {!Array.<!Element>} boxes
     * @param {!number} from the first page to set, from zero
     * @return {undefined}
     */
    function placePages(plan, boxes, from) {
        var /**@type{!number}*/
            i,
            /**@type{!odf.TextLayout.PageDimensions}*/
            dims,
            /**@type{!{left:!number,top:!number}}*/
            place;
        for (i = from; i < boxes.length; i += 1) {
            dims = plan.at(i);
            place = pagePlace(plan, i);
            /**@type{!HTMLElement}*/(boxes[i]).style.left = (place.left
                + dims.marginLeft) + "px";
            /**@type{!HTMLElement}*/(boxes[i]).style.top = (place.top
                + dims.marginTop) + "px";
        }
    }
    /**
     * Move to the next page what crosses the end of a page.
     *
     * The pages are filled by measuring them, and what is drawn after them —
     * the headers, the feet, and the fonts they ask for — may make a page
     * hold one line less: rather than break the whole text again, what
     * crosses the end of a page is cut off and set at the head of the page
     * that follows, and a page is added at the end if the last one is full.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @return {undefined}
     */
    function trimPages(odfroot, plan) {
        var text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            doc = /**@type{!Document}*/(text.ownerDocument),
            htmlns = doc.documentElement.namespaceURI,
            /**@type{!Array.<!Element>}*/
            boxes = [],
            /**@type{?Element}*/
            node = text.firstElementChild,
            /**@type{!number}*/
            i;
        while (node) {
            if (node.className === "webodf-pageBox") {
                boxes.push(node);
            }
            node = node.nextElementSibling;
        }
        /**
         * Move what crosses the end of one page to the page that follows.
         * @param {!Element} box
         * @param {!number} index
         * @return {undefined}
         */
        function trimOne(box, index) {
            var /**@type{!number}*/
                guard = 4,
                /**@type{!boolean}*/
                fresh,
                /**@type{?Element}*/
                over = firstOverflowing(box),
                /**@type{?Element}*/
                more,
                /**@type{!Array.<!Node>}*/
                sent,
                /**@type{?Node}*/
                walk,
                /**@type{?Node}*/
                next,
                /**@type{!Element}*/
                target,
                /**@type{!odf.TextLayout.PageDimensions}*/
                dims,
                /**@type{!number}*/
                held,
                /**@type{!number}*/
                lines,
                /**@type{!number}*/
                n;
            while (guard > 0 && over) {
                held = String(over.textContent).length;
                lines = linesOf(over);
                more = cutElement(box, over, 8,
                    over === box.firstElementChild, odfroot);
                if (more && over !== box.firstElementChild
                        && !cutWhereAnOfficeWould(over, lines)) {
                    while (more.firstChild) {
                        over.appendChild(more.firstChild);
                    }
                    more = null;
                }
                if (more && String(more.textContent).length >= held
                        && held > 0) {
                    while (more.firstChild) {
                        over.appendChild(more.firstChild);
                    }
                    more = null;
                }
                sent = [];
                walk = over.nextSibling;
                while (walk) {
                    next = walk.nextSibling;
                    sent.push(walk);
                    box.removeChild(walk);
                    walk = next;
                }
                if (more) {
                    sent.unshift(more);
                } else if (over !== box.firstElementChild) {
                    // Nothing of it can be cut, a heading or a line of one
                    // word: it is written whole on the page that follows,
                    // unless the page holds nothing else.
                    sent.unshift(over);
                    box.removeChild(over);
                }
                if (sent.length === 0) {
                    guard = 0;
                } else {
                    // What is sent on goes to the page that follows, unless
                    // that page begins with what asks for a page of its own:
                    // a page of its own it stays, and a page is made between
                    // the two.
                    fresh = index + 1 >= boxes.length
                        || Boolean(boxes[index + 1].firstElementChild
                            && asksForANewPage(
                                /**@type{!Node}*/(
                                    boxes[index + 1].firstElementChild
                                )
                            ));
                    if (fresh) {
                        dims = plan.at(index + 1);
                        target = /**@type{!Element}*/(
                            doc.createElementNS(htmlns, "div")
                        );
                        target.className = "webodf-pageBox";
                        /**@type{!HTMLElement}*/(target).style.width =
                            (dims.pageWidth - dims.marginLeft
                                - dims.marginRight) + "px";
                        /**@type{!HTMLElement}*/(target).style.height =
                            (dims.pageHeight - dims.marginTop
                                - dims.marginBottom) + "px";
                        /**@type{!HTMLElement}*/(target).style.position =
                            "absolute";
                        /**@type{!HTMLElement}*/(target).style.left =
                            dims.marginLeft + "px";
                        /**@type{!HTMLElement}*/(target).style.top =
                            ((index + 1) * (dims.pageHeight
                                + dims.pageSeparation)
                                + dims.marginTop) + "px";
                        if (index + 1 >= boxes.length) {
                            text.appendChild(target);
                            boxes.push(target);
                        } else {
                            text.insertBefore(target, boxes[index + 1]);
                            boxes.splice(index + 1, 0, target);
                            placePages(plan, boxes, index + 2);
                        }
                    } else {
                        target = boxes[index + 1];
                    }
                    for (n = sent.length - 1; n >= 0; n -= 1) {
                        target.insertBefore(sent[n], target.firstChild);
                    }
                    guard -= 1;
                    over = firstOverflowing(box);
                }
            }
        }
        i = 0;
        while (i < boxes.length && boxes.length < maxPages) {
            trimOne(boxes[i], i);
            i += 1;
        }
        columnPages = boxes.length;
    }
    /**
     * Whether every page holds what was written on it.
     *
     * A page is filled by measuring it, and what is drawn after the pages —
     * the headers and the feet, the fonts they ask for — may change the
     * width of a line and make a page hold one line less: a reader that
     * asks this after the pages are drawn is told whether they are to be
     * set right.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {!boolean}
     */
    function pagesHold(odfroot) {
        var text = odfroot.body.lastElementChild,
            /**@type{?Element}*/
            node = text
                ? text.firstElementChild
                : null,
            /**@type{!boolean}*/
            fits = true;
        while (node && fits) {
            if (node.className === "webodf-pageBox"
                    && firstOverflowing(node)) {
                fits = false;
            }
            node = node.nextElementSibling;
        }
        return fits;
    }
    /**
     * Make the box that holds the document as wide as a row of pages.
     *
     * The elements of the document are of no namespace of html, where a
     * "style" attribute is left alone by the browser, so the width is written
     * on the first element of html above them: the box the reader draws in,
     * which is shrunk to the document and put in the middle by the reader.
     * @param {!Element} from the box that holds the pages
     * @param {!number} width
     * @return {undefined}
     */
    function widen(from, width) {
        var html = "http://www.w3.org/1999/xhtml",
            node = /**@type{?Element}*/(from.parentElement);
        while (node && node.namespaceURI !== html) {
            node = node.parentElement;
        }
        if (node) {
            /**@type{!HTMLElement}*/(node).style.width = width + "px";
        }
    }
    /**
     * Break a few pages, draw them, and take up the rest later.
     * @param {!number} round the layout this belongs to, so that a layout
     *                  that went before does not go on drawing
     * @return {undefined}
     */
    function fillSlice(round) {
        var end,
            /**@type{!PagePlan}*/
            plan,
            /**@type{!number}*/
            rowWidth,
            /**@type{!number}*/
            from;
        if (round !== fillingRound || !filling || !fillingRoot
                || !fillingDiv) {
            return;
        }
        // The first pages are drawn as soon as they are broken, one and then
        // two, and the slices grow from there: a reader is given the head of
        // a document to read while the rest of it is broken, rather than
        // waiting on a slice of a document of eight hundred pages. The
        // slices are of a time and not of a count, so that a page that is
        // slow to break does not hold the browser.
        end = new Date().getTime() + filling.slice;
        from = filling.page;
        while (filling.waiting.length > 0 && filling.page < maxPages
                && (filling.page === from
                        || new Date().getTime() < end)) {
            fillOnePage(filling);
        }
        filling.slice = Math.min(150, filling.slice * 2 + 10);
        columnPages = Math.max(1, filling.page);
        // The text is as tall as the pages it was broken into, so that what
        // is drawn after it stands under them.
        plan = /**@type{!PagePlan}*/(filling.plan);
        // The text is as tall as the pages it holds so far, so that what is
        // drawn after it stands under them. It is written on the element
        // itself and not in the sheet of the layout: a rule that is taken
        // away and written anew at every turn tells the browser that every
        // style of the document is to be worked out again, and a document of
        // eight hundred pages is worked out anew eight hundred times.
        rowWidth = pagesPerRow
            * (plan.at(0).pageWidth + plan.at(0).pageSeparation)
            - plan.at(0).pageSeparation;
        filling.text.setAttribute("style", "height:" + Math.max(0,
            filling.top - plan.at(Math.max(0, filling.page - 1))
                .pageSeparation) + "px;width:" + rowWidth + "px;");
        // The box that holds the pages is as wide as a row of them, and not
        // as wide as the text of one page: a reader that puts the document
        // in the middle then puts the whole row in the middle.
        fillingDiv.style.width = rowWidth + "px";
        // The document itself is as wide as the row too, as what holds it is
        // shrunk to the width of the document, and a row that is wider than
        // it would hang out of the reader instead of standing in the middle.
        widen(fillingDiv, rowWidth);
        drawPageFurniture(fillingRoot, plan, fillingDiv,
            readMeta(fillingRoot), from);
        if (filling.waiting.length > 0 && filling.page < maxPages) {
            runtime.setTimeout(function () {
                fillSlice(round);
            }, 0);
            return;
        }
        // The pages are all broken: what the headers and the feet, and the
        // fonts they ask for, took from a page is given back to the page
        // that follows it.
        filling = null;
        runtime.setTimeout(function () {
            var /**@type{!number}*/
                round2 = 0;
            // Setting a page right moves what it could not hold to the next
            // page, which may then hold one line too many in its turn: it is
            // done until every page holds what was written on it, twice at
            // the most.
            while (round2 < 2 && round === fillingRound && fillingRoot
                    && fillingDiv && !pagesHold(fillingRoot)) {
                trimPages(fillingRoot, plan);
                drawPageFurniture(fillingRoot, plan, fillingDiv,
                    readMeta(fillingRoot), 0);
                round2 += 1;
            }
            if (round === fillingRound && fillingDiv) {
                tellPageCount(
                    /**@type{!odf.ODFDocumentElement}*/(fillingRoot),
                    fillingDiv, countPages(fillingDiv));
                if (drawnHandler) {
                    drawnHandler();
                }
            }
        }, 0);
    }
    /**
     * Draw a text over pages laid one under another, each page a box of its
     * own that holds what the page holds.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @return {undefined}
     */
    function layoutInPages(odfroot, pagesDiv) {
        var /**@type{!Element}*/
            text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            /**@type{!PagePlan}*/
            plan;
        while (pagesDiv.firstChild) {
            pagesDiv.removeChild(pagesDiv.firstChild);
        }
        unwrapColumnRuns(text);
        unwrapPageBoxes(text);
        giveBackWaiting(text);
        layOutTabsOfText(odfroot);
        plan = new PagePlan(odfroot);
        markPageBreaks(odfroot);
        columnPageOrigins = [];
        // A row of two pages is what is drawn and what a reader scales to its
        // window, so the size given is the size of the row.
        columnPageSize = {
            width: pagesPerRow * (plan.at(0).pageWidth
                + plan.at(0).pageSeparation) - plan.at(0).pageSeparation,
            height: plan.at(0).pageHeight
        };
        lastPlan = plan;
        // The pages are broken a few at a time: the first of them are drawn
        // at once, and a reader reads them while the rest are broken, rather
        // than waiting on a document of a thousand pages.
        filling = startPages(odfroot, plan);
        fillingRoot = odfroot;
        fillingDiv = pagesDiv;
        fillingRound += 1;
        fillSlice(fillingRound);
    }
    /**
     * Layout the text by resizing frames and updating the numbers of pages.
     * This function runs for the maximum allocated time and returns true if
     * it is done in that time.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @return {!boolean}
     */
    function layout(odfroot, pagesDiv, maxTime) {
        if (pageMode === "columns") {
            layoutInColumns(odfroot, pagesDiv);
        } else {
            layoutInPages(odfroot, pagesDiv);
        }
        return maxTime > 0;
    }
    this.layout = layout;
    /**
     * Be told when the pages are all drawn.
     *
     * A text is broken into pages a few at a time, so what holds the pages is
     * of its last width only once the last of them is drawn: a reader that
     * scales the document to its window scales it again then.
     * @param {?function():undefined} handler
     * @return {undefined}
     */
    this.whenDrawn = function (handler) {
        drawnHandler = handler;
    };
    /**
     * Lay the tabs of every paragraph of a text at their stops.
     *
     * A tab of the text was drawn as a tab of a terminal, that walks to the
     * next stop of eight letters: an entry of a table of contents and the
     * number of the page it names ran into one another. It is done once, as
     * the text is drawn, and nothing is measured for it.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {undefined}
     */
    this.layOutTabs = function (odfroot) {
        layOutTabsOfText(odfroot);
    };
    /**
     * The way a text is drawn over pages.
     *
     * "pages" lays them one under another, each page a box of its own that
     * holds what the page holds: a paragraph and a table that cross the end
     * of a page are cut there, as an office cuts them. "columns" lays them
     * beside one another, each page a column, which is how two pages are
     * read side by side. "flow" writes the text as one run of text with the
     * pages floating beside it, where nothing is ever cut where a page ends.
     * @param {!string} mode
     * @return {undefined}
     */
    this.setPageMode = function (mode) {
        pageMode = mode;
    };
    /**
     * How many pages stand side by side on a row: one, which is how a
     * document is scrolled, or two, which is how a book is read. The pages
     * are broken the same way either way; only where they are drawn changes.
     * @param {!number} pages
     * @return {undefined}
     */
    this.setPagesPerRow = function (pages) {
        pagesPerRow = Math.max(1, pages);
    };
    /**
     * Whether the first page stands on its own, on the right of the first
     * row, as the first page of a book does: the place on its left is left
     * empty. It is only of use where a row holds more than one page.
     * @param {!boolean} alone
     * @return {undefined}
     */
    this.setFirstPageOnItsOwn = function (alone) {
        firstPageOnItsOwn = alone;
    };
    /**
     * Whether every page holds what was written on it.
     * @param {!odf.ODFDocumentElement} odfroot
     * @return {!boolean}
     */
    this.pagesFit = function (odfroot) {
        return pagesHold(odfroot);
    };
    /**
     * Whether a text is still being broken into pages.
     * @return {!boolean}
     */
    this.isBreaking = function () {
        return filling !== null;
    };
    /**
     * Set the pages right without breaking the whole text again: what
     * crosses the end of a page is moved to the page that follows.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @return {undefined}
     */
    this.repair = function (odfroot, pagesDiv) {
        if (pageMode !== "pages" || !lastPlan) {
            return;
        }
        trimPages(odfroot, lastPlan);
        drawPageFurniture(odfroot, lastPlan, pagesDiv, readMeta(odfroot), 0);
    };
    /**
     * Leave a lane beside each page for the notes of the annotations, of the
     * width a note is drawn at, or none.
     * @param {!number} width
     * @return {undefined}
     */
    this.setNoteLane = function (width) {
        noteLane = width;
    };
    /**
     * Where the page that holds a place of the text begins and ends across,
     * when the pages stand beside one another: a note of an annotation is
     * drawn in the lane beside the page it belongs to.
     * @param {!number} x from the left edge of the body of the document
     * @return {?{left:!number,right:!number}}
     */
    this.pageAt = function (x) {
        var found = null;
        if (pageMode !== "columns") {
            return null;
        }
        columnPageOrigins.forEach(function (left) {
            if (left <= x && (!found || left > found.left)) {
                found = {left: left, right: left + columnPageSize.width};
            }
        });
        return found;
    };
    /**
     * How wide and how tall one page is, or nothing when the text is written
     * as one run of text: a reader who fits a document to the window fits one
     * page to it there, and not the whole run of pages that stand beside one
     * another.
     * @return {?{width:!number,height:!number}}
     */
    this.pageSize = function () {
        return pageMode !== "flow" && columnPageSize.width > 0
            ? columnPageSize
            : null;
    };
};
/**@typedef{{
    node:!Element,
    background:!boolean,
    order:!number
}}*/
odf.TextLayout.PageShape;

/**@typedef{{
    at:!number,
    type:!string
}}*/
odf.TextLayout.TabStop;

/**@typedef{{
    text:!Element,
    root:!odf.ODFDocumentElement,
    doc:!Document,
    htmlns:?string,
    plan:!Object,
    waiting:!Array.<!Node>,
    chunk:!number,
    slice:!number,
    page:!number,
    top:!number,
    sheet:!CSSStyleSheet,
    heightRule:!number
}}*/
odf.TextLayout.Filling;

/**@typedef{{
    shapes:!Array.<!odf.TextLayout.PageShape>,
    header:?Element,
    footer:?Element,
    headerLeft:?Element,
    footerLeft:?Element,
    headerFirst:?Element,
    footerFirst:?Element
}}*/
odf.TextLayout.PageFurniture;

/**@typedef{{
    height:!number,
    gap:!number
}}*/
odf.TextLayout.PageArea;

/**@typedef{{
    pageWidth:!number,
    pageHeight:!number,
    marginTop:!number,
    marginBottom:!number,
    marginLeft:!number,
    marginRight:!number,
    pageSeparation:!number,
    header:!odf.TextLayout.PageArea,
    footer:!odf.TextLayout.PageArea,
    firstPage:!odf.TextLayout.PageFurniture,
    otherPages:!odf.TextLayout.PageFurniture
}}*/
odf.TextLayout.PageDimensions;
/**
 * A head or a foot of a page as it was drawn, to be copied from page to page.
 * @typedef {!{source:!Element,width:!number,drawn:!DocumentFragment,fields:!Array.<!number>}}
 */
odf.TextLayout.Furniture;
