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
            headerNode: null,
            footerNode: null
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
            headerNode: masterPage
                ? domUtils.getDirectChild(masterPage, stylens, "header")
                : null,
            footerNode: masterPage
                ? domUtils.getDirectChild(masterPage, stylens, "footer")
                : null
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
        if (dims.headerNode) {
            dims.marginTop += dims.header.height + dims.header.gap;
        }
        if (dims.footerNode) {
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
     * Copy what a master page writes in a header or in a footer, and put the
     * number of the page where the document asks for it. The nodes are of the
     * document, so the styles of the document draw them as they draw the text.
     * @param {!Element} source the "style:header" or the "style:footer"
     * @param {!HTMLDivElement} box
     * @param {!number} page the number of the page, from one
     * @param {!number} pages how many pages there are
     * @return {undefined}
     */
    function fillPageArea(source, box, page, pages) {
        var doc = box.ownerDocument,
            fields,
            i;
        box.appendChild(doc.importNode(source, true));
        fields = box.getElementsByTagNameNS(textns, "page-number");
        for (i = 0; i < fields.length; i += 1) {
            fields[i].textContent = String(page);
        }
        fields = box.getElementsByTagNameNS(textns, "page-count");
        for (i = 0; i < fields.length; i += 1) {
            fields[i].textContent = String(pages);
        }
    }
    /**
     * Draw the header and the footer of every page.
     *
     * They are drawn beside the text rather than in it: the boxes of the pages
     * hold the text away from the margins, and these are laid over the room
     * that was left, one for each page. Nothing of the text is touched.
     * @param {!odf.TextLayout.PageDimensions} dims
     * @param {!HTMLDivElement} pagesDiv
     * @return {undefined}
     */
    function drawPageFurniture(dims, pagesDiv) {
        var doc = pagesDiv.ownerDocument,
            htmlns = pagesDiv.namespaceURI,
            pages = countPages(pagesDiv),
            /**@type{!HTMLDivElement}*/
            box,
            top,
            n;
        while (pagesDiv.lastChild
                && /**@type{!Element}*/(pagesDiv.lastChild).className
                    === "webodf-pageFurniture") {
            pagesDiv.removeChild(pagesDiv.lastChild);
        }
        if (!dims.headerNode && !dims.footerNode) {
            return;
        }
        for (n = 0; n < pages; n += 1) {
            top = n * (dims.pageHeight + dims.pageSeparation);
            if (dims.headerNode) {
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
                fillPageArea(dims.headerNode, box, n + 1, pages);
                pagesDiv.appendChild(box);
            }
            if (dims.footerNode) {
                box = /**@type{!HTMLDivElement}*/(doc.createElementNS(htmlns,
                    "div"));
                box.className = "webodf-pageFurniture";
                box.style.position = "absolute";
                box.style.left = dims.marginLeft + "px";
                box.style.right = dims.marginRight + "px";
                box.style.top = (top + dims.pageHeight - dims.marginBottom
                    + dims.footer.gap) + "px";
                box.style.minHeight = dims.footer.height + "px";
                fillPageArea(dims.footerNode, box, n + 1, pages);
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
        drawPageFurniture(dims, pagesDiv);
        return maxTime > 0;
    }
    this.layout = layout;
};
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
    headerNode:?Element,
    footerNode:?Element
}}*/
odf.TextLayout.PageDimensions;
