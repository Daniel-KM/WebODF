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
         * How wide the box that holds the height of a page is drawn. It is
         * as narrow as a browser lets a box be and still count it: a box of
         * no width at all is held to occupy nothing, and every page would be
         * drawn at the top of the one before it. The width stands well above
         * the grain of the engines, a sixtieth of a pixel in gecko and a
         * sixty-fourth in blink and in webkit, and above it still once a
         * reader has drawn the document small: a quarter of a pixel is
         * counted down to a zoom of a fifteenth, where a twentieth of a
         * pixel is already lost at a quarter.
         * @const
         * @type{!string}
         */
        pageColumnWidth = "0.25px",
        /**
         * Whether the text is broken into columns, one column to a page, or
         * written as one run of text with the pages floating beside it.
         * @type{!boolean}
         */
        columnsMode = false,
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
            area.height = lengthInPx(box, "min-height", 0);
            area.gap = lengthInPx(box, gap, 0);
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
        if (dims.otherPages.header || dims.otherPages.headerLeft
                || dims.otherPages.headerFirst || dims.firstPage.header
                || dims.firstPage.headerLeft || dims.firstPage.headerFirst) {
            dims.marginTop += dims.header.height + dims.header.gap;
        }
        if (dims.otherPages.footer || dims.otherPages.footerLeft
                || dims.otherPages.footerFirst || dims.firstPage.footer
                || dims.firstPage.footerLeft || dims.firstPage.footerFirst) {
            dims.marginBottom += dims.footer.height + dims.footer.gap;
        }
        return dims;
    }
    this.readPageDimensions = readPageDimensions;
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @return {!number}
     */
    function countPages(pagesDiv) {
        return columnsMode
            ? columnPages
            : Math.ceil((pagesDiv.childElementCount - 1) / 2);
    }
    /**
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @return {!number}
     */
    function getPagesHeight(plan, pagesDiv) {
        var npages = countPages(pagesDiv);
        return npages === 0
            ? 0
            : plan.top(npages) - plan.at(npages - 1).pageSeparation;
    }
    /**
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} count
     * @return {undefined}
     */
    function removePages(pagesDiv, count) {
        var last = pagesDiv.lastElementChild;
        while (count > 0) {
            pagesDiv.removeChild(last);
            last = pagesDiv.lastElementChild;
            if (last) {
                pagesDiv.removeChild(last);
                last = pagesDiv.lastElementChild;
            }
            count -= 1;
        }
        last.style.marginBottom = 0;
        last.style.height = 0;
    }
    /**
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} count
     * @return {undefined}
     */
    function addPages(plan, pagesDiv, count) {
        var doc = pagesDiv.ownerDocument,
            frag = doc.createDocumentFragment(),
            htmlns = doc.documentElement.namespaceURI,
            n = countPages(pagesDiv),
            lastSeparator = pagesDiv.lastElementChild,
            /**@type{!odf.TextLayout.PageDimensions}*/
            dims,
            /**@type{!number}*/
            contentHeight,
            div;
        count += n;
        while (n < count) {
            dims = plan.at(n);
            contentHeight = dims.pageHeight - dims.marginTop
                - dims.marginBottom;
            // make separator
            div = doc.createElementNS(htmlns, "div");
            div.style.width = "100%";
            div.style.cssFloat = "right";
            div.style.position = "relative";
            div.style.zIndex = 10;
            div.style.marginBottom = dims.marginTop + "px";
            if (n > 0) {
                div.style.height = dims.pageSeparation + "px";
                div.style.marginTop = dims.marginBottom + "px";
                div.className = "webodf-pageSeparator";
            }
            frag.appendChild(div);
            div = doc.createElementNS(htmlns, "div");
            div.style.height = contentHeight + "px";
            div.style.width = pageColumnWidth;
            div.style.cssFloat = "right";
            frag.appendChild(div);
            n += 1;
        }
        div = doc.createElementNS(htmlns, "div");
        div.style.width = "100%";
        div.style.cssFloat = "right";
        div.style.position = "relative";
        div.style.zIndex = 10;
        div.style.marginTop = plan.at(Math.max(0, count - 1)).marginBottom
            + "px";
        frag.appendChild(div);
        if (lastSeparator) {
            pagesDiv.replaceChild(frag, lastSeparator);
        } else {
            pagesDiv.appendChild(frag);
        }
    }
    /**
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} bodyHeight
     * @return {!boolean}
     */
    function adjustPages(plan, pagesDiv, bodyHeight) {
        var pages = countPages(pagesDiv),
            dims = plan.at(Math.max(0, pages - 1)),
            missingHeight = bodyHeight - getPagesHeight(plan, pagesDiv),
            missingPages = Math.ceil(missingHeight / dims.pageHeight),
            pageCountChanged = false;
        if (!isFinite(missingPages)) {
            return false;
        }
        missingPages = Math.min(missingPages,
            maxPages - countPages(pagesDiv));
        if (missingPages > 0) {
            // too few pages
            pageCountChanged = true;
            addPages(plan, pagesDiv, missingPages);
        } else if (missingPages < 0) {
            // too many pages
            pageCountChanged = true;
            removePages(pagesDiv, -missingPages);
        }
        return pageCountChanged;
    }
    /**
     * @param {!number} maxTime
     * @return {!number}
     */
    function endTime(maxTime) {
        return new Date().getTime() + maxTime;
    }
    /**
     * @param {!number} end
     * @return {!boolean}
     */
    function checkTime(end) {
        var now = new Date().getTime();
        return now < end;
    }
    /**
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @return {!boolean}
     */
    function updateNumberOfPages(odfroot, plan, pagesDiv, maxTime) {
        var text = odfroot.body.lastElementChild,
            end = endTime(maxTime),
            textHeight = text.clientHeight,
            timeLeft = true;
        while (timeLeft && adjustPages(plan, pagesDiv, textHeight)) {
            timeLeft = checkTime(end);
        }
        return timeLeft;
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
        var doc = paragraph.ownerDocument,
            htmlns = "http://www.w3.org/1999/xhtml",
            stops = tabStopsOf(odfroot, paragraph),
            /**@type{!Array.<!HTMLElement>}*/
            parts = [],
            /**@type{!HTMLElement}*/
            part,
            /**@type{!HTMLElement}*/
            line,
            /**@type{?Node}*/
            node = paragraph.firstChild,
            /**@type{?Node}*/
            next,
            /**@type{!Array.<!string>}*/
            pieces,
            /**@type{!number}*/
            i;
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
        // The parts are the nodes between the tabs, the first one before the
        // first tab.
        part = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns, "span"));
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
                // before a header is drawn, so a tab is a letter here.
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
                    if (pieces[i].length > 0) {
                        part.appendChild(doc.createTextNode(pieces[i]));
                    }
                }
            } else {
                part.appendChild(node);
            }
            node = next;
        }
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
                gap = 4;
            pieces.forEach(function (piece, i) {
                var rect = rects[l][i],
                    push;
                if (rect.width === 0) {
                    return;
                }
                push = 0;
                if (edge > 0 && rect.left < edge + gap) {
                    // A blank is left between two parts that were pushed
                    // together, so the two are still read as two.
                    push = Math.min(edge + gap - rect.left,
                        Math.max(0, right - rect.right));
                    // The part is already drawn against its stop, and is
                    // only pushed from where it stands.
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
        var doc = box.ownerDocument;
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
        box.appendChild(doc.importNode(source, true));
        unstampStyleNames(odfroot, box);
        expandSpaces(box);
        fill("page-number", String(page));
        fill("page-count", String(pages));
        Object.keys(meta).forEach(function (name) {
            fill(name, meta[name]);
        });
        // A line of a header is written as a line of the document is, so what
        // the canvas does to a line of the document is done here as well: a
        // break is a break, a run of spaces is a run of spaces, and a tab
        // takes the part that follows it to its stop.
        paragraphsOf(box).forEach(function (paragraph) {
            layOutTabStops(odfroot, paragraph);
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
            /**@type{!Array.<!Element>}*/
            roots = [odfroot.automaticStyles, odfroot.styles],
            /**@type{!NodeList}*/
            styles,
            /**@type{!Element}*/
            candidate,
            /**@type{?Element}*/
            style = null,
            /**@type{!string}*/
            master = "",
            /**@type{!number}*/
            i,
            /**@type{!number}*/
            r;
        if (name === "") {
            return null;
        }
        for (r = 0; r < roots.length && style === null; r += 1) {
            styles = roots[r].getElementsByTagNameNS(stylens, "style");
            for (i = 0; i < styles.length && style === null; i += 1) {
                candidate = /**@type{!Element}*/(styles.item(i));
                if (candidate.getAttributeNS(stylens, "name") === name
                        && candidate.getAttributeNS(stylens, "family")
                            === "paragraph") {
                    style = candidate;
                }
            }
        }
        if (style === null) {
            return null;
        }
        master = style.getAttributeNS(stylens, "master-page-name") || "";
        return master === "" ? null : masterPageNamed(odfroot, master);
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
                return readPageDimensions(odfroot, entry.master);
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
     * @return {undefined}
     */
    function drawPageFurniture(odfroot, plan, pagesDiv, meta) {
        var /**@type{!Document}*/
            doc = /**@type{!Document}*/(pagesDiv.ownerDocument),
            /**@type{?string}*/
            htmlns = pagesDiv.namespaceURI,
            /**@type{!Element}*/
            behind = odfroot.body,
            pages = countPages(pagesDiv),
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
            n;
        removeBoxes(pagesDiv);
        removeBoxes(behind);
        // The body no longer paints the ground of the whole text: each page
        // is painted on its own, see the rule of "office|body" in
        // "webodf.css". A class would not do, as the engine of the styles
        // reads none on an element of another namespace.
        behind.setAttributeNS(webodfhelperns, "paginated", "true");
        for (n = 0; n < pages; n += 1) {
            dims = plan.at(n);
            // A page stands under the one before it when the text is one run
            // of text, and beside it when the text is broken into columns,
            // one column to a page.
            left = columnsMode
                ? columnPageOrigins[n] || 0
                : 0;
            top = columnsMode
                ? 0
                : plan.top(n);
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
                fillPageArea(odfroot, header, box, n + 1, pages, meta);
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
                fillPageArea(odfroot, footer, box, n + 1, pages, meta);
                pagesDiv.appendChild(box);
                drawn.push(box);
            }
        }
        spreadLines(drawn);
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
     * Take away the room left before the paragraphs that are written on a new
     * page, so that a text is measured as it was written.
     * @param {!Element} root
     * @return {undefined}
     */
    function removeGaps(root) {
        var /**@type{?Element}*/
            node = root.firstElementChild,
            /**@type{?Element}*/
            next;
        // The room is left among the paragraphs themselves, so the children
        // of the text answer for all of it: nothing deeper is read, which a
        // text of a thousand pages would make dear.
        while (node) {
            next = node.nextElementSibling;
            if (node.className === "webodf-pageBreak") {
                root.removeChild(node);
            }
            node = next;
        }
    }
    /**
     * Write on a new page what the document asks to be written on one.
     *
     * A text is one run of text here, and a page is a box that floats beside
     * it: a break is made by leaving as much room before the paragraph as
     * what is left of the page it stands on. The room is a box of the reader
     * and not of the document, so nothing of the document is moved, and it
     * is taken away before it is measured again.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @return {!boolean} whether room was left anywhere
     */
    function forcePageBreaks(odfroot, plan, pagesDiv) {
        var /**@type{!Element}*/
            text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            doc = pagesDiv.ownerDocument,
            htmlns = pagesDiv.namespaceURI,
            /**@type{!number}*/
            origin,
            /**@type{!Array.<!Element>}*/
            nodes = [],
            /**@type{!Array.<!Element>}*/
            wanted = [],
            /**@type{!Array.<!number>}*/
            tops = [],
            /**@type{!Array.<!number>}*/
            rooms = [],
            /**@type{!Array.<!number>}*/
            starts = [],
            /**@type{!number}*/
            shift = 0,
            /**@type{!number}*/
            page = 0,
            /**@type{!number}*/
            top,
            /**@type{!number}*/
            room,
            /**@type{!number}*/
            i,
            /**@type{?Element}*/
            node;
        removeGaps(text);
        node = text.firstElementChild;
        while (node) {
            nodes.push(node);
            node = node.nextElementSibling;
        }
        nodes.forEach(function (element, index) {
            if (asksForABreak(odfroot, element, "break-before")
                    || (index > 0 && asksForABreak(odfroot, nodes[index - 1],
                        "break-after"))) {
                wanted.push(element);
            }
        });
        if (wanted.length === 0) {
            return false;
        }
        // Everything is read before anything is written: a browser lays the
        // whole text out again at each read that follows a write, and a text
        // of a thousand pages would be laid out a thousand times over.
        origin = pagesDiv.getBoundingClientRect().top;
        wanted.forEach(function (element) {
            tops.push(element.getBoundingClientRect().top - origin);
        });
        // Where each page begins, from the first to one beyond the last that
        // may be asked for: the room left before a paragraph is read from it
        // rather than from the pages that are drawn, which are not drawn yet.
        top = 0;
        for (i = 0; i < maxPages; i += 1) {
            starts.push(top);
            top += plan.at(i).pageHeight + plan.at(i).pageSeparation;
        }
        tops.forEach(function (start, index) {
            top = start + shift;
            while (page + 1 < starts.length && starts[page + 1] <= top) {
                page += 1;
            }
            room = starts[page] + plan.at(page).marginTop;
            if (top <= room + 1 || page + 1 >= starts.length) {
                rooms.push(0);
                return;
            }
            // The paragraph stands in the middle of a page, so it is given
            // what is left of it: the room of a page and the room of the
            // margin of the next one.
            room = starts[page + 1] + plan.at(page + 1).marginTop - top;
            rooms.push(room > 0
                ? room
                : 0);
            shift += rooms[index];
        });
        // A break is given its room, and one that needs none is given a box
        // of no height all the same: the room is set anew once the text has
        // been laid out again, and a paragraph that stands at the top of a
        // page now may not stand there then.
        wanted.forEach(function (element, index) {
            var /**@type{!Element}*/
                gap = doc.createElementNS(htmlns, "div");
            gap.className = "webodf-pageBreak";
            /**@type{!HTMLElement}*/(gap).style.height = (rooms[index] > 0
                ? rooms[index]
                : 0) + "px";
            element.parentNode.insertBefore(gap, element);
        });
        return true;
    }
    /**
     * Set the room left before a break to what the page really asks for.
     *
     * The room is worked out from where the paragraphs stood before any of
     * it was left, and a text does not fall again exactly where it was
     * reckoned it would: a line breaks elsewhere once the page it stands on
     * has changed, and the boxes of the pages push what crosses them. The
     * paragraphs are read once more, and each room is set to what is
     * missing, or taken back to what was too much.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!PagePlan} plan
     * @param {!HTMLDivElement} pagesDiv
     * @return {!boolean} whether any room was set anew
     */
    function tunePageBreaks(odfroot, plan, pagesDiv) {
        var /**@type{!Element}*/
            text = /**@type{!Element}*/(odfroot.body.lastElementChild),
            /**@type{!Array.<!HTMLElement>}*/
            gaps = [],
            /**@type{!Array.<!number>}*/
            tops = [],
            /**@type{!Array.<!number>}*/
            starts = [],
            /**@type{!number}*/
            origin,
            /**@type{!number}*/
            shift = 0,
            /**@type{!number}*/
            page = 0,
            /**@type{!number}*/
            changed = 0,
            /**@type{!number}*/
            top,
            /**@type{!number}*/
            i,
            /**@type{?Element}*/
            node;
        node = text.firstElementChild;
        while (node) {
            if (node.className === "webodf-pageBreak") {
                gaps.push(/**@type{!HTMLElement}*/(node));
            }
            node = node.nextElementSibling;
        }
        if (gaps.length === 0) {
            return false;
        }
        origin = pagesDiv.getBoundingClientRect().top;
        gaps.forEach(function (gap) {
            var next = gap.nextElementSibling;
            tops.push(next
                ? next.getBoundingClientRect().top - origin
                : 0);
        });
        top = 0;
        for (i = 0; i < maxPages; i += 1) {
            starts.push(top);
            top += plan.at(i).pageHeight + plan.at(i).pageSeparation;
        }
        gaps.forEach(function (gap, index) {
            var /**@type{!number}*/
                room = parseFloat(gap.style.height) || 0,
                /**@type{!number}*/
                bare,
                /**@type{!number}*/
                wanted,
                /**@type{!number}*/
                move;
            top = tops[index] + shift;
            // Where the paragraph would stand were no room left before it:
            // the page it is sent to is read from that, and not from where
            // it stands now, or a paragraph already sent to the top of a
            // page would be sent to the top of the next one at every round.
            bare = top - room;
            while (page + 1 < starts.length && starts[page + 1] <= bare) {
                page += 1;
            }
            wanted = starts[page] + plan.at(page).marginTop;
            if (bare > wanted + 1 && page + 1 < starts.length) {
                wanted = starts[page + 1] + plan.at(page + 1).marginTop;
            }
            move = wanted - top;
            if (Math.abs(move) > 1 && room + move >= 0) {
                gap.style.height = (room + move) + "px";
                shift += move;
                changed += 1;
            }
        });
        return changed > 0;
    }
    /**
     * The sheet of styles the layout writes its own rules in.
     *
     * The text is broken into columns by rules that are of the reader and
     * not of the document, so they are kept in a sheet of their own, made
     * once and written anew at each layout.
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
            doc.head.appendChild(element);
        }
        return /**@type{!CSSStyleSheet}*/(
            /**@type{!HTMLStyleElement}*/(element).sheet
        );
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
            first = 0,
            /**@type{!number}*/
            i;
        for (i = sheet.cssRules.length - 1; i >= 0; i -= 1) {
            sheet.deleteRule(i);
        }
        odf.Namespaces.forEachPrefix(function (prefix, ns) {
            sheet.insertRule("@namespace " + prefix + " url(" + ns + ");",
                sheet.cssRules.length);
        });
        sheet.insertRule("@namespace webodfhelper url(" + webodfhelperns
            + ");", sheet.cssRules.length);
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
            if (asksForABreak(odfroot, element, "break-before")
                    || (index > 0 && asksForABreak(odfroot, nodes[index - 1],
                        "break-after"))) {
                element.setAttributeNS(webodfhelperns,
                    "webodfhelper:breakbefore", "true");
            } else {
                element.removeAttributeNS(webodfhelperns, "breakbefore");
            }
        });
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
        drawPageFurniture(odfroot, plan, pagesDiv, readMeta(odfroot));
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
        var plan = new PagePlan(odfroot),
            round = 0;
        if (columnsMode) {
            layoutInColumns(odfroot, pagesDiv);
            return true;
        }
        // The pages are drawn, then it is read from them which page each
        // change of master page falls on, and they are drawn again: a page of
        // another size moves the ones that follow it. Two rounds answer for
        // a text of one master page, and the third is there for the rest.
        do {
            updateNumberOfPages(odfroot, plan, pagesDiv, maxTime);
            updateNumberOfPages(odfroot, plan, pagesDiv, maxTime);
            round += 1;
        } while (plan.follow(countPages(pagesDiv)) && round < 3);
        // The paragraphs that ask for a page of their own are given one, and
        // the pages are counted again, as the text is longer for it. A break
        // made on one page may push the next one onto another page, so it is
        // done again, twice, which answers for a text of breaks that follow
        // one another.
        if (forcePageBreaks(odfroot, plan, pagesDiv)) {
            updateNumberOfPages(odfroot, plan, pagesDiv, maxTime);
            // The room left before each break was worked out from where the
            // text stood before any of it was left: it is read again and set
            // to what the page really asks for. A break that is set anew
            // moves the ones that follow it, so it is done until nothing
            // moves, four rounds at the most.
            round = 0;
            while (round < 4 && tunePageBreaks(odfroot, plan, pagesDiv)) {
                updateNumberOfPages(odfroot, plan, pagesDiv, maxTime);
                round += 1;
            }
        }
        drawPageFurniture(odfroot, plan, pagesDiv, readMeta(odfroot));
        return maxTime > 0;
    }
    this.layout = layout;
    /**
     * Break the text into columns, one column to a page, rather than write
     * it as one run of text with the pages floating beside it. A column is
     * broken by the browser itself, so a paragraph and a table are cut where
     * a page ends, which the boxes that float beside a text cannot do.
     * @param {!boolean} enable
     * @return {undefined}
     */
    this.setColumns = function (enable) {
        columnsMode = enable;
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
        if (!columnsMode) {
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
        return columnsMode && columnPageSize.width > 0
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

