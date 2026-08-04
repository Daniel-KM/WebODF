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
 * @source: https://github.com/kogmbh/WebODF/
 */


/*global odf, runtime, webodfcore*/
/**
 * @constructor
 */
odf.TextLayout = function TextLayout() {
    "use strict";
    var domUtils = webodfcore.DomUtils,
        odfUtils = odf.OdfUtils,
        fons = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
        stylens = "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
        drawns = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
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
     * @return {!number}
     */
    function lengthInPx(properties, name, fallback) {
        var value = properties.getAttributeNS(fons, name),
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
     * The shapes a master page draws on every page: a watermark, a banner
     * along an edge, a note in a margin. The standard allows them beside the
     * header and the footer, and it is where they are written, as the margins
     * of a page carry no area of their own.
     * @param {?Element} masterPage
     * @return {!Array.<!Element>}
     */
    function shapesOf(masterPage) {
        var shapes = [],
            node = masterPage && masterPage.firstElementChild;
        while (node) {
            if (node.namespaceURI === drawns) {
                shapes.push(node);
            }
            node = node.nextElementSibling;
        }
        return shapes;
    }
    /**
     * Draw the shapes of a master page on one page, where the shape itself
     * says where it goes: what a master page draws is placed against the
     * sheet, so the box is the sheet and the offsets are the ones written.
     * @param {!Array.<!Element>} shapes
     * @param {!HTMLDivElement} box
     * @return {undefined}
     */
    function fillPageShapes(shapes, box) {
        var doc = box.ownerDocument;
        shapes.forEach(function (shape) {
            var copy = doc.importNode(shape, true),
                x = shape.getAttributeNS(svgns, "x"),
                y = shape.getAttributeNS(svgns, "y"),
                width = shape.getAttributeNS(svgns, "width"),
                height = shape.getAttributeNS(svgns, "height"),
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
     * @param {?Element} masterPage
     * @return {!odf.TextLayout.PageFurniture}
     */
    function readFurniture(masterPage) {
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
            shapes: shapesOf(masterPage),
            header: child("header"),
            footer: child("footer"),
            headerLeft: child("header-left"),
            footerLeft: child("footer-left"),
            headerFirst: child("header-first"),
            footerFirst: child("footer-first")
        };
    }
    /**
     * @param {!odf.TextLayout.PageFurniture} furniture
     * @return {!boolean}
     */
    function hasFurniture(furniture) {
        return Boolean(furniture.header || furniture.footer
            || furniture.headerLeft || furniture.footerLeft
            || furniture.headerFirst || furniture.footerFirst
            || furniture.shapes.length > 0);
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
     * @return {!odf.TextLayout.PageDimensions}
     */
    function readPageDimensions(odfroot) {
        var /**@type{!NodeList}*/
            masterPages = odfroot.masterStyles.getElementsByTagNameNS(stylens,
                "master-page"),
            /**@type{?Element}*/
            masterPage = masterPages.length > 0
                ? /**@type{!Element}*/(masterPages[0])
                : null,
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
            layout = /**@type{!Element}*/(layouts[i]);
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
            marginTop: defaultDimensions.marginTop,
            marginBottom: defaultDimensions.marginBottom,
            marginLeft: defaultDimensions.marginLeft,
            marginRight: defaultDimensions.marginRight,
            pageSeparation: pageSeparation,
            header: readPageArea(pageLayout, "header-style", "margin-bottom"),
            footer: readPageArea(pageLayout, "footer-style", "margin-top"),
            firstPage: readFurniture(masterPage),
            otherPages: readFurniture(nextMasterPage(odfroot, masterPage)
                || masterPage)
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
        return Math.ceil((pagesDiv.childElementCount - 1) / 2);
    }
    /**
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @return {!number}
     */
    function getPagesHeight(dims, pagesDiv) {
        var npages = countPages(pagesDiv),
            height;
        height = npages * dims.pageHeight + (npages - 1) * dims.pageSeparation;
        return height;
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
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} count
     * @return {undefined}
     */
    function addPages(dims, pagesDiv, count) {
        var doc = pagesDiv.ownerDocument,
            frag = doc.createDocumentFragment(),
            htmlns = doc.documentElement.namespaceURI,
            n = countPages(pagesDiv),
            lastSeparator = pagesDiv.lastElementChild,
            contentHeight = dims.pageHeight - dims.marginTop - dims.marginBottom,
            div;
        count += n;
        while (n < count) {
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
            div.style.width = "1px";
            div.style.cssFloat = "right";
            frag.appendChild(div);
            n += 1;
        }
        div = doc.createElementNS(htmlns, "div");
        div.style.width = "100%";
        div.style.cssFloat = "right";
        div.style.position = "relative";
        div.style.zIndex = 10;
        div.style.marginTop = dims.marginBottom + "px";
        frag.appendChild(div);
        if (lastSeparator) {
            pagesDiv.replaceChild(frag, lastSeparator);
        } else {
            pagesDiv.appendChild(frag);
        }
    }
    /**
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} bodyHeight
     * @return {!boolean}
     */
    function adjustPages(dims, pagesDiv, bodyHeight) {
        var missingHeight = bodyHeight - getPagesHeight(dims, pagesDiv),
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
            addPages(dims, pagesDiv, missingPages);
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
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @return {!boolean}
     */
    function updateNumberOfPages(odfroot, dims, pagesDiv, maxTime) {
        var text = odfroot.body.lastElementChild,
            end = endTime(maxTime),
            textHeight = text.clientHeight,
            timeLeft = true;
        while (timeLeft && adjustPages(dims, pagesDiv, textHeight)) {
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
     * Copy what a master page writes in a header or in a footer, and put the
     * number of the page where the document asks for it. The nodes are of the
     * document, so the styles of the document draw them as they draw the text.
     * @param {!Element} source the "style:header" or the "style:footer"
     * @param {!HTMLDivElement} box
     * @param {!number} page the number of the page, from one
     * @param {!number} pages how many pages there are
     * @param {!Object.<!string,!string>} meta what the document says of itself
     * @return {undefined}
     */
    function fillPageArea(source, box, page, pages, meta) {
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
        fill("page-number", String(page));
        fill("page-count", String(pages));
        Object.keys(meta).forEach(function (name) {
            fill(name, meta[name]);
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
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!string} which "header" or "footer"
     * @param {!number} page the number of the page, from one
     * @return {?Element}
     */
    function pageArea(dims, which, page) {
        var furniture = page === 1 ? dims.firstPage : dims.otherPages,
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
     * Draw the header and the footer of every page.
     *
     * They are drawn beside the text rather than in it: the boxes of the pages
     * hold the text away from the margins, and these are laid over the room
     * that was left, one for each page. Nothing of the text is touched.
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @param {!Object.<!string,!string>} meta what the document says of itself
     * @return {undefined}
     */
    function drawPageFurniture(dims, pagesDiv, meta) {
        var doc = pagesDiv.ownerDocument,
            htmlns = pagesDiv.namespaceURI,
            pages = countPages(pagesDiv),
            /**@type{!HTMLDivElement}*/
            box,
            /**@type{?Element}*/
            header,
            /**@type{?Element}*/
            footer,
            /**@type{!Array.<!Element>}*/
            shapes,
            top,
            n;
        while (pagesDiv.lastChild
                && (/**@type{!Element}*/(pagesDiv.lastChild).className
                        === "webodf-pageFurniture"
                    || /**@type{!Element}*/(pagesDiv.lastChild).className
                        === "webodf-pageShapes")) {
            pagesDiv.removeChild(pagesDiv.lastChild);
        }
        if (!hasFurniture(dims.firstPage) && !hasFurniture(dims.otherPages)) {
            return;
        }
        for (n = 0; n < pages; n += 1) {
            top = n * (dims.pageHeight + dims.pageSeparation);
            header = pageArea(dims, "header", n + 1);
            footer = pageArea(dims, "footer", n + 1);
            shapes = (n === 0 ? dims.firstPage : dims.otherPages).shapes;
            if (shapes.length > 0) {
                box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
                    "div"));
                box.className = "webodf-pageShapes";
                box.style.position = "absolute";
                box.style.left = 0;
                box.style.right = 0;
                box.style.top = top + "px";
                box.style.height = dims.pageHeight + "px";
                fillPageShapes(shapes, box);
                pagesDiv.appendChild(box);
            }
            if (header) {
                box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
                    "div"));
                box.className = "webodf-pageFurniture";
                box.style.position = "absolute";
                box.style.left = dims.marginLeft + "px";
                box.style.right = dims.marginRight + "px";
                box.style.top = (top + dims.marginTop - dims.header.gap
                    - dims.header.height) + "px";
                // The height of the style is the least it takes: a header of
                // two lines where one was asked for grows into the margin
                // rather than being cut.
                box.style.minHeight = dims.header.height + "px";
                fillPageArea(header, box, n + 1, pages, meta);
                pagesDiv.appendChild(box);
            }
            if (footer) {
                box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
                    "div"));
                box.className = "webodf-pageFurniture";
                box.style.position = "absolute";
                box.style.left = dims.marginLeft + "px";
                box.style.right = dims.marginRight + "px";
                box.style.top = (top + dims.pageHeight - dims.marginBottom
                    + dims.footer.gap) + "px";
                box.style.minHeight = dims.footer.height + "px";
                fillPageArea(footer, box, n + 1, pages, meta);
                pagesDiv.appendChild(box);
            }
        }
    }
    /**
     * Layout the text by resizing frames and updating the numbers of pages.
     * This function runs for the maximum allocated time and returns true if
     * it is done in that time.
     * @param {!odf.ODFDocumentElement} odfroot
     * @param {!HTMLDivElement} pagesDiv
     * @param {!number} maxTime (milliseconds)
     * @param {!odf.TextLayout.PageDimensions=} dims
     * @return {!boolean}
     */
    function layout(odfroot, pagesDiv, maxTime, dims) {
        if (!dims) {
            dims = readPageDimensions(odfroot);
        }
        updateNumberOfPages(odfroot, dims, pagesDiv, maxTime);
        updateNumberOfPages(odfroot, dims, pagesDiv, maxTime);
        drawPageFurniture(dims, pagesDiv, readMeta(odfroot));
        return maxTime > 0;
    }
    this.layout = layout;
};
/**@typedef{{
    shapes:!Array.<!Element>,
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

