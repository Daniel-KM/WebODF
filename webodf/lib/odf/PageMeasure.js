/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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
 * @source: https://webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */




/*global odf, runtime, Node*/

/**
 * What a page holds and where it ends: the measures a layout leans on, and
 * the cuts it makes by them.
 *
 * Nothing here knows of the layout that is under way: each function is given
 * the page and the nodes it works on and answers of those alone. What breaks
 * a text into pages, and what is drawn around them, is in "TextLayout.js".
 * @constructor
 */
odf.PageMeasureImpl = function PageMeasureImpl() {
    "use strict";
    var /**@const@type{!string}*/
        drawns = odf.Namespaces.drawns,
        /**@const@type{!string}*/
        tablens = odf.Namespaces.tablens,
        /**@const@type{!string}*/
        textns = odf.Namespaces.textns,
        /**@const@type{!string}*/
        webodfhelperns = "urn:webodf:names:helper";
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
        // The lines an office keeps together are the lines of a paragraph: a
        // section, a list or a table of contents is cut wherever a paragraph
        // of it may be cut, and the rule of the orphans is read of that
        // paragraph and not of the whole of what holds it.
        if (element.namespaceURI !== textns
                || (element.localName !== "p" && element.localName !== "h")) {
            return true;
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
     * Write a page in the columns its layout asks for.
     * @param {!Element} box the page
     * @param {!odf.PageMeasure.PageDimensions} dims
     * @return {undefined}
     */
    function setColumns(box, dims) {
        if (dims.columnCount > 1) {
            /**@type{!HTMLElement}*/(box).style.setProperty("column-count",
                String(dims.columnCount));
            /**@type{!HTMLElement}*/(box).style.setProperty("column-gap",
                dims.columnGap + "px");
        }
    }
    /**
     * Whether a page is written in more than one column.
     * @param {!Element} box the page
     * @return {!boolean}
     */
    function holdsColumns(box) {
        var count = /**@type{!HTMLElement}*/(box).style
            .getPropertyValue("column-count");
        return count !== "" && count !== "1" && count !== "auto";
    }
    /**
     * Where the text of a page ends.
     *
     * The notes of the foot of a page are drawn in the padding at the foot of
     * the box, so the text ends where that padding begins and not at the edge
     * of the box.
     * @param {!Element} box the page
     * @return {!number}
     */
    function edgeOf(box) {
        return box.getBoundingClientRect().bottom
            - (parseFloat(/**@type{!HTMLElement}*/(box).style.paddingBottom)
                || 0);
    }
    /**
     * Where the last column of a page ends.
     *
     * A page written in columns is filled from the foot of one column to the
     * head of the next, so what does not fit stands to the right of the last
     * column and not under the text.
     * @param {!Element} box the page
     * @return {!number}
     */
    function rightEdgeOf(box) {
        return box.getBoundingClientRect().right
            - (parseFloat(/**@type{!HTMLElement}*/(box).style.paddingRight)
                || 0);
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
        var edge = edgeOf(box),
            /**@type{!boolean}*/
            columns = holdsColumns(box),
            /**@type{!number}*/
            side = rightEdgeOf(box),
            /**@type{?Element}*/
            node = box.firstElementChild,
            /**@type{!ClientRect}*/
            rect;
        while (node) {
            rect = node.getBoundingClientRect();
            if (node.className !== "webodf-pageNotes"
                    && (rect.height > 0 || rect.width > 0)
                    && (columns
                        ? rect.right > side + 1
                        : rect.bottom > edge + 1)) {
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
            edge = edgeOf(box),
            /**@type{!boolean}*/
            columns = holdsColumns(box),
            /**@type{!number}*/
            side = rightEdgeOf(box),
            /**@type{?Node}*/
            last = box.lastElementChild
                && box.lastElementChild.className === "webodf-pageNotes"
                ? box.lastElementChild.previousSibling
                : box.lastChild,
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
        if (!last) {
            return false;
        }
        range.setStartBefore(node);
        range.setEndAfter(last);
        rect = range.getBoundingClientRect();
        if ((rect.height > 0 || rect.width > 0)
                && (columns
                    ? rect.right > side + 1
                    : rect.bottom > edge + 1)) {
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
     * Whether what was cut off an element holds nothing worth a page.
     *
     * An element that is cut may leave a copy that holds no word and no
     * shape of its own: the empty paragraph of a table of contents, for one.
     * It is thrown away rather than written, as it would take the room of
     * its spacings on the page that follows and leave a page half empty.
     * @param {?Element} tail what was cut off
     * @return {!boolean}
     */
    function holdsNothing(tail) {
        if (!tail) {
            return true;
        }
        if (String(tail.textContent).trim() !== "") {
            return false;
        }
        // A frame, an image or a shape is drawn although it holds no word.
        return tail.getElementsByTagNameNS(drawns, "frame").length === 0
            && tail.getElementsByTagNameNS(drawns, "image").length === 0
            && tail.getElementsByTagNameNS(tablens, "table").length === 0;
    }
    /**
     * Take the spacings from what a page ends on and that holds nothing.
     *
     * Cutting a paragraph between two of its words may leave nothing of it on
     * the page it was cut on: the empty paragraph is drawn as its spacings
     * and no more, and in a box that lays its children in a column those
     * spacings are not folded into the edge of the box, so the page is a few
     * pixels too full and the line above is moved on for nothing.
     * @param {!Element} box the page
     * @return {undefined}
     */
    function unspaceEmptyTail(box) {
        var node = box.lastElementChild,
            /**@type{!number}*/
            guard = 8;
        // The last thing on the page is looked for, and then everything it
        // stands in that holds nothing either: a paragraph left empty by a
        // cut holds the box its tabs were laid in, which is empty as well.
        while (node && node.lastElementChild && guard > 0) {
            node = node.lastElementChild;
            guard -= 1;
        }
        guard = 8;
        while (node && node !== box && guard > 0
                && node.getBoundingClientRect().height === 0) {
            // An element of the document is of no namespace of html, where
            // the browser leaves a "style" attribute alone: it is marked
            // instead, and the rule of the mark takes its spacings away.
            node.setAttributeNS(webodfhelperns, "webodfhelper:spaceless",
                "true");
            node = node.parentElement;
            guard -= 1;
        }
    }
    this.rangeOf = rangeOf;
    this.edgeOf = edgeOf;
    this.rightEdgeOf = rightEdgeOf;
    this.linesOf = linesOf;
    this.askedNumber = askedNumber;
    this.cutWhereAnOfficeWould = cutWhereAnOfficeWould;
    this.keepsWithWhatFollows = keepsWithWhatFollows;
    this.anythingBefore = anythingBefore;
    this.holdsSomething = holdsSomething;
    this.holdsNothing = holdsNothing;
    this.isOutOfFlow = isOutOfFlow;
    this.holdsColumns = holdsColumns;
    this.setColumns = setColumns;
    this.nodesIn = nodesIn;
    this.splitOff = splitOff;
    this.firstOverflowing = firstOverflowing;
    this.firstOver = firstOver;
    this.overflows = overflows;
    this.cutText = cutText;
    this.unspaceEmptyTail = unspaceEmptyTail;
};

/**
 * @type {!odf.PageMeasureImpl}
 */
odf.PageMeasure = new odf.PageMeasureImpl();

/**@typedef{{
    node:!Element,
    background:!boolean,
    order:!number
}}*/
odf.PageMeasure.PageShape;
/**@typedef{{
    at:!number,
    type:!string
}}*/
odf.PageMeasure.TabStop;
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
odf.PageMeasure.Filling;

/**@typedef{{
    shapes:!Array.<!odf.PageMeasure.PageShape>,
    header:?Element,
    footer:?Element,
    headerLeft:?Element,
    footerLeft:?Element,
    headerFirst:?Element,
    footerFirst:?Element
}}*/
odf.PageMeasure.PageFurniture;
/**@typedef{{
    height:!number,
    gap:!number
}}*/
odf.PageMeasure.PageArea;
/**@typedef{{
    pageWidth:!number,
    pageHeight:!number,
    marginTop:!number,
    marginBottom:!number,
    marginLeft:!number,
    marginRight:!number,
    pageSeparation:!number,
    columnCount:!number,
    columnGap:!number,
    header:!odf.PageMeasure.PageArea,
    footer:!odf.PageMeasure.PageArea,
    firstPage:!odf.PageMeasure.PageFurniture,
    otherPages:!odf.PageMeasure.PageFurniture
}}*/
odf.PageMeasure.PageDimensions;
