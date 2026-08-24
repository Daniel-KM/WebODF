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
 * What is drawn around the text of a page: the header and the foot, the notes
 * of the foot, the shapes of the master page, and the tabs of a line.
 *
 * Nothing here holds the state of a layout: what a function needs of the
 * document is given to it, and what it needs of the layout — where the stops
 * of a paragraph are read, how the names of the styles are taken off a copy —
 * is given to it as a function to call. What breaks a text into pages is in
 * "TextLayout.js".
 * @constructor
 */
odf.PageFurnitureImpl = function PageFurnitureImpl() {
    "use strict";
    var /**@const@type{!string}*/
        textns = odf.Namespaces.textns,
        /**@const@type{!string}*/
        webodfhelperns = "urn:webodf:names:helper";
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
     * @param {!function(!odf.ODFDocumentElement,!Element):
     *              !Array.<!odf.PageMeasure.TabStop>} stopsFor the stops the
     *              style of a paragraph writes
     * @return {undefined}
     */
    function layOutTabStops(odfroot, paragraph, stopsFor) {
        var doc = /**@type{!Document}*/(paragraph.ownerDocument),
            htmlns = "http://www.w3.org/1999/xhtml",
            stops = stopsFor(odfroot, paragraph),
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
            var /**@type{?odf.PageMeasure.TabStop}*/
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
     * @param {!function(!odf.ODFDocumentElement,!Element):
     *              !Array.<!odf.PageMeasure.TabStop>} stopsFor the stops the
     *              style of a paragraph writes
     * @return {undefined}
     */
    function layOutTabsInText(odfroot, paragraph, stopsFor) {
        var doc = /**@type{!Document}*/(paragraph.ownerDocument),
            htmlns = "http://www.w3.org/1999/xhtml",
            stops = stopsFor(odfroot, paragraph),
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
            var /**@type{?odf.PageMeasure.TabStop}*/
                stop = index === 0
                    ? null
                    : stops[Math.min(index, stops.length) - 1],
                /**@type{?odf.PageMeasure.TabStop}*/
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
     * @return {!Array.<!odf.PageMeasure.TabStop>}
     */
    function stopsOfLine(line) {
        var written = line.getAttributeNS(webodfhelperns, "stops") || "",
            /**@type{!Array.<!odf.PageMeasure.TabStop>}*/
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
                    /**@type{?odf.PageMeasure.TabStop}*/
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
     * @param {!function(!odf.ODFDocumentElement,!Element):undefined} unstamp
     *              takes off a copy the names of the styles the canvas
     *              stamped on it, so the copy is drawn in its own style
     * @return {!number}
     */
    function roomTaken(odfroot, source, width, unstamp) {
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
        unstamp(odfroot, box);
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
     * @param {!odf.PageMeasure.PageDimensions} dims
     * @param {!function(!odf.ODFDocumentElement,!Element):undefined} unstamp
     *              takes off a copy the names of the styles the canvas
     *              stamped on it
     * @return {!odf.PageMeasure.PageDimensions}
     */
    function roomForFurniture(odfroot, dims, unstamp) {
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
                roomTaken(odfroot, head, width, unstamp)) + dims.header.gap;
        }
        if (foot) {
            dims.marginBottom += Math.max(dims.footer.height,
                roomTaken(odfroot, foot, width, unstamp)) + dims.footer.gap;
        }
        return dims;
    }
    /**
     * A box that holds the shapes of one page, of the size of the sheet.
     * @param {!Document} doc
     * @param {?string} htmlns
     * @param {!odf.PageMeasure.PageDimensions} dims
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
     * @param {!odf.PageMeasure.PageShape} shape
     * @return {!boolean}
     */
    function behindTheText(shape) {
        return shape.background;
    }
    /**
     * @param {!odf.PageMeasure.PageShape} shape
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
     * Take the notes of the foot of a page away, and the room they took.
     * @param {!Element} box the page
     * @return {undefined}
     */
    function clearNotes(box) {
        var area = box.lastElementChild;
        if (area && area.className === "webodf-pageNotes") {
            box.removeChild(area);
        }
        /**@type{!HTMLElement}*/(box).style.paddingBottom = "";
    }
    /**
     * The notes of the foot of the page that are called for on a page.
     * @param {!Element} box the page
     * @return {!Array.<!Element>}
     */
    function notesOf(box) {
        var found = box.getElementsByTagNameNS(textns, "note"),
            /**@type{!Array.<!Element>}*/
            notes = [],
            /**@type{!Element}*/
            note,
            /**@type{!number}*/
            i;
        for (i = 0; i < found.length; i += 1) {
            note = /**@type{!Element}*/(found.item(i));
            if (note.getAttributeNS(textns, "note-class") === "footnote") {
                notes.push(note);
            }
        }
        return notes;
    }
    /**
     * Draw the notes called for on a page at the foot of it.
     *
     * A note is written at the foot of the page its number stands on, as an
     * office writes it, and the text of the page is that much shorter: the
     * room the notes take is the padding at the foot of the box, so what
     * crosses into it is moved to the page that follows, see "trimPages".
     *
     * What is drawn is a copy: the note itself is left where it stands in the
     * text, as the document is the reader's to show and not to write.
     * @param {!Element} box the page
     * @return {undefined}
     */
    function layNotes(box) {
        var doc = /**@type{!Document}*/(box.ownerDocument),
            htmlns = /**@type{!string}*/(doc.documentElement.namespaceURI),
            notes = notesOf(box),
            /**@type{!HTMLElement}*/
            area,
            /**@type{!HTMLElement}*/
            rule,
            /**@type{!number}*/
            tall;
        clearNotes(box);
        if (notes.length === 0) {
            return;
        }
        area = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns, "div"));
        area.className = "webodf-pageNotes";
        // The notes stand in the padding at the foot of the box, against the
        // text and not against the paper: the padding of the box is the
        // margin of the page, which the notes are no part of.
        area.style.position = "absolute";
        area.style.bottom = "0";
        area.style.left = /**@type{!HTMLElement}*/(box).style.paddingLeft;
        area.style.right = /**@type{!HTMLElement}*/(box).style.paddingRight;
        // A line stands between the text and the notes, as an office draws
        // it: a quarter of the width of the text, and no wider.
        rule = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns, "div"));
        rule.style.width = "25%";
        rule.style.borderTop = "1px solid currentColor";
        rule.style.marginBottom = "0.2em";
        area.appendChild(rule);
        notes.forEach(function (note) {
            var line = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns,
                    "div")),
                number = /**@type{!HTMLElement}*/(doc.createElementNS(htmlns,
                    "span")),
                citation = note.getElementsByTagNameNS(textns,
                    "note-citation").item(0),
                body = note.getElementsByTagNameNS(textns,
                    "note-body").item(0),
                /**@type{?Node}*/
                walk;
            number.className = "webodf-pageNoteNumber";
            number.style.marginRight = "0.5em";
            number.appendChild(doc.createTextNode(citation
                ? String(citation.textContent)
                : ""));
            // The body itself is not moved and not copied: what it holds is,
            // as the rule that hides a body of a note would hide the copy of
            // it as well.
            walk = body
                ? body.firstChild
                : null;
            while (walk) {
                line.appendChild(walk.cloneNode(true));
                walk = walk.nextSibling;
            }
            // The number of the note is written at the head of the first
            // line of it and not above it, in the letters of the note: it is
            // put inside what was copied, and not before it.
            if (line.firstElementChild) {
                line.firstElementChild.insertBefore(number,
                    line.firstElementChild.firstChild);
            } else {
                line.insertBefore(number, line.firstChild);
            }
            area.appendChild(line);
        });
        box.appendChild(area);
        tall = area.getBoundingClientRect().height;
        /**@type{!HTMLElement}*/(box).style.paddingBottom = tall + "px";
    }
    /**
     * How far the foot of a page reaches into the text of it.
     *
     * The foot is drawn under the text, in the margin: where it is taller
     * than the margin left for it, it stands over the last lines, and this
     * says by how much.
     * @param {!Element} box the page
     * @param {?Element} furniture what is drawn around the page
     * @return {!number} nothing where the foot stands clear of the text
     */
    function footOver(box, furniture) {
        var bottom = box.getBoundingClientRect().bottom,
            /**@type{!number}*/
            top = 0,
            /**@type{!NodeList}*/
            parts,
            /**@type{!ClientRect}*/
            rect,
            /**@type{!number}*/
            i;
        if (!furniture) {
            return 0;
        }
        parts = furniture.getElementsByTagName("*");
        top = bottom;
        for (i = 0; i < parts.length; i += 1) {
            rect = /**@type{!Element}*/(parts.item(i))
                .getBoundingClientRect();
            // Only what is drawn under the middle of the page is the foot of
            // it: a header stands over the text and takes nothing from it
            // here.
            if (rect.height > 0
                    && rect.top > bottom - box.getBoundingClientRect().height
                        / 2) {
                top = Math.min(top, rect.top);
            }
        }
        return Math.max(0, Math.round(bottom - top));
    }
    this.roomTaken = roomTaken;
    this.roomForFurniture = roomForFurniture;
    this.spreadLines = spreadLines;
    this.getTop = getTop;
    this.pageShapesBox = pageShapesBox;
    this.behindTheText = behindTheText;
    this.overTheText = overTheText;
    this.removeBoxes = removeBoxes;
    this.clearNotes = clearNotes;
    this.footOver = footOver;
    this.layNotes = layNotes;
    this.notesOf = notesOf;
    this.stopsOfLine = stopsOfLine;
    this.layOutTabStops = layOutTabStops;
    this.partsOfParagraph = partsOfParagraph;
    this.raiseTabs = raiseTabs;
    this.expandSpaces = expandSpaces;
    this.holdsAField = holdsAField;
    this.layOutTabsInText = layOutTabsInText;
};

/**
 * @type {!odf.PageFurnitureImpl}
 */
odf.PageFurniture = new odf.PageFurnitureImpl();
