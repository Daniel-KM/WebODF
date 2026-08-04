/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global odf, webodfcore, runtime*/

(function () {
    "use strict";

    var /**@const
           @type{!string}*/
        fons = odf.Namespaces.fons,
        /**@const
           @type{!string}*/
        stylens = odf.Namespaces.stylens,
        /**@const
           @type{!string}*/
        textns = odf.Namespaces.textns,
        /**@const
           @type{!string}*/
        xmlns = odf.Namespaces.xmlns,
        /**@const
           @type{!string}*/
        helperns = "urn:webodf:names:helper",
        /**@const
           @type{!string}*/
        listCounterIdSuffix = "webodf-listLevel",
        /**@const
           @type{!Object.<string,string>}*/
        /**@const
           @type{!RegExp}*/
        // Symbol/dingbat fonts whose glyphs are encoded as plain ASCII letters.
        // They are proprietary and cannot be bundled, so on a device without
        // them the bullet shows up as a stray letter (e.g. Wingdings "n" => a
        // black square renders as the literal "n").
        symbolFontRe = /wingding|webding|stardings|starsymbol|opensymbol|monotype sorts|zapf\s*dingbats|dingbats/i,
        /**@const
           @type{!Object.<string,string>}*/
        // The handful of dingbat code points commonly used as list bullets,
        // mapped to Unicode look-alikes that render in any normal font.
        symbolBulletMap = {
            "n": "■", // black square (Wingdings)
            "o": "□", // white square
            "p": "❑", // shadowed square
            "l": "●", // black circle
            "m": "○", // white circle
            "u": "◆", // black diamond
            "v": "❖", // black diamond minus white X
            "§": "▪", // small black square
            "ü": "✓", // check mark
            "û": "☐", // ballot box
            "Ø": "➔"  // heavy wide-headed rightwards arrow
        };

    /**
     * Appends the rule into the stylesheets and logs any errors that occur
     * @param {!CSSStyleSheet} styleSheet
     * @param {!string} rule
     * @return {undefined}
     */
    function appendRule(styleSheet, rule) {
        try {
            styleSheet.insertRule(rule, styleSheet.cssRules.length);
        } catch (/**@type{!DOMException}*/e) {
            runtime.log("cannot load rule: " + rule + " - " + e);
        }
    }

    /**
     * Holds the current state of parsing the text:list elements in the DOM
     * @param {!Object.<!string, !string>} contentRules
     * @param {!Array.<!string>} continuedCounterIdStack
     * @constructor
     * @struct
     */
    function ParseState(contentRules, continuedCounterIdStack) {
        /**
         * The number of list counters created for a list
         * This is just a number appended to the list counter identifier to make it unique within the list
         * @type {!number}
         */
        this.listCounterCount = 0;

        /**
         * The CSS generated content rule keyed by list level
         * @type {!Object.<!string, !string>}
         */
        this.contentRules = contentRules;

        /**
         * The stack of counters for the list being processed
         * @type {!Array.<!string>}
         */
        this.counterIdStack = [];

        /**
         * The stack of counters the list should continue from if any
         * @type {!Array.<!string>}
         */
        this.continuedCounterIdStack = continuedCounterIdStack;
    }

    /**
     * Assigns globally unique CSS list counters to each text:list element in the document.
     * The reason a global list counter is required is due to how the scope of CSS counters works
     * which is described here http://www.w3.org/TR/CSS21/generate.html#scope
     *
     * The relevant part is that the scope of the counter applies to the element that the counter-reset rule
     * was applied to and any children or siblings of that element. Applying another counter-reset rule to the
     * same counter resets this scope and previous values of the counter are lost. These values are also inaccessible
     * if we inspect the value of the counter outside of the scope and we simply get the default value of zero.
     *
     * The above is important for the case of continued numbering combined with multi-level list numbering.
     * Multi-level lists use a separate counter for each list level and joins each counter value together.
     * Continued numbering takes the list counter from the list we want to continue and uses it for the list
     * that is being continued. Combining these two we get the approach of taking the list counter at each list level
     * from the list that is being continued and then using these counters at each level in the continued list.
     *
     * However the scope rules prevent us from continuing counters at any level deeper than the first level and
     * this behaviour is illustrated in an example of some list content below.
     * <office:document>
     *     <text:list>
     *         <text:list-item> counter: level1 value: 1
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: level2 value: 1
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     *     other doc content
     *     <text:list text:continue-numbering="true">
     *         <text:list-item>
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: level2 value: 0
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     * </office:document>
     *
     * The solution to this was to hoist the counter initialisation up to the document level so that the counter
     * scope applies to all lists in the document. Then each text:list element is given a unique counter by default.
     * Having unique counters is only really required for continuing a list based on its xml:id but having it for
     * all lists makes the code simpler and reduces the amount of CSS rules being overridden. Hence we end up with a
     * list counter setup as below.
     * <office:document> counter-reset: list1-1 list1-2
     *     <text:list>
     *         <text:list-item> counter: list1-1 value: 1
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: list1-2 value: 1
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     *     other doc content
     *     <text:list text:continue-numbering="true">
     *         <text:list-item>
     *             <text:list>
     *                 <text:list-item><text:p>Item</text:p></text:list-item> counter: list1-2 value: 2
     *             </text:list>
     *         </text:list-item>
     *     </text:list>
     * </office:document>
     *
     * @param {!CSSStyleSheet} styleSheet
     * @constructor
     */
    function UniqueListCounter(styleSheet) {
        var /**@type{!number}*/
            customListIdIndex = 0,
            /**@type{!string}*/
            globalCounterResetRule = "",
            /**@type{!Object.<!string,!Array.<!string>>}*/
            counterIdStacks = {};

        /**
         * Gets the stack of list counters for the given list.
         * Counter stacks are keyed by the list counter id of the first list level.
         * Returns a deep copy of the counter stack so it can be modified
         * @param {!Element|undefined} list
         * @return {!Array.<!string>}
         */
        function getCounterIdStack(list) {
            var counterId,
                stack = [];

            if (list) {
                counterId = list.getAttributeNS(helperns, "counter-id");
                stack = counterIdStacks[counterId].slice(0);
            }
            return stack;
        }

        /**
         * Assigns a unique global CSS list counter to this text:list element
         * @param {!string} topLevelListId This is used to generate a unique identifier for this element
         * @param {!Element} listElement This is always a text:list element
         * @param {!number} listLevel
         * @param {!ParseState} parseState
         * @return {undefined}
         */
        function createCssRulesForList(topLevelListId, listElement, listLevel, parseState) {
            var /**@type{!string}*/
                newListSelectorId,
                newListCounterId,
                newRule,
                contentRule,
                i;

            // increment counters and create a new identifier for this text:list element
            // this identifier will be used as the CSS counter name if this list is not continuing another list
            parseState.listCounterCount += 1;
            newListSelectorId = topLevelListId + "-level" + listLevel + "-" + parseState.listCounterCount;
            listElement.setAttributeNS(helperns, "counter-id", newListSelectorId);

            // if we need to continue from a previous list then get the counter from the stack
            // of the continued list and use it as the counter for this list element
            newListCounterId = parseState.continuedCounterIdStack.shift();
            if (!newListCounterId) {
                newListCounterId = newListSelectorId;

                // add the newly created counter to the counter reset rule so it can be
                // initialised later once we have parsed all the lists in the document.
                // In the case of a multi-level list with no items the counter increment rule
                // will not apply. To fix this issue we initialise the counters to a value of 1
                // instead of the default of 0.
                globalCounterResetRule += newListSelectorId + ' 1 ';

                // CSS counters increment the value before displaying the rendered list label. This is not an issue but as
                // we initialise the counters to a value of 1 above to handle lists with no list items it means that
                // lists that actually have list items will all start with the counter value of 2 which is not desirable.
                // To fix this we apply another CSS rule here that overrides the counter increment rule above and
                // prevents incrementing the counter on the FIRST list item that has content (AKA a visible list label).
                // A list that was cut where a page ends is written again on
                // the page that follows, and what follows the cut is no
                // first item of a list: the counter is held back on the
                // first item of a list, and never on the first item of what
                // is left of one, see "webodfhelper:continued" in
                // "TextLayout.js".
                newRule = 'text|list[webodfhelper|counter-id="' + newListSelectorId + '"]:not([webodfhelper|continued])';
                newRule += ' > text|list-item:first-child > :not(text|list):first-child:before';
                newRule += '{';
                // Due to https://bugs.webkit.org/show_bug.cgi?id=84985 a value of "none" is ignored by some version of WebKit
                // (specifically the ones shipped with the Cocoa frameworks on OSX 10.7 + 10.8).
                // Override the counter-increment on this counter by name to workaround this
                newRule += 'counter-increment: ' + newListCounterId + ' 0;';
                newRule += '}';
                appendRule(styleSheet, newRule);
            }

            // remove any counters from the stack that are deeper than the current list level
            // and push the newly created or continued counter on to the stack
            while (parseState.counterIdStack.length >= listLevel) {
                parseState.counterIdStack.pop();
            }
            parseState.counterIdStack.push(newListCounterId);

            // substitute the unique list counters in for each level up to the current one
            // this only replaces the first occurrence in the string as the generated rule
            // will have a different counter for each list level and multi level counter rules
            // are created by joining counters from different levels together
            contentRule = parseState.contentRules[listLevel.toString()] || "";
            for (i = 1; i <= listLevel; i += 1) {
                contentRule = contentRule.replace(i + listCounterIdSuffix, parseState.counterIdStack[i - 1]);
            }

            // Apply the counter increment to EVERY list item in this list that has content (AKA a visible list label)
            // An item that was cut where a page ends is written again on the
            // page that follows, and what is left of it is no new item of
            // the list: it carries the number of the item it is the end of,
            // and never one of its own.
            newRule = 'text|list[webodfhelper|counter-id="' + newListSelectorId + '"]';
            newRule += ' > text|list-item:not([webodfhelper|continued]) > :not(text|list):first-child:before';
            newRule += '{';
            newRule += contentRule;
            newRule += 'counter-increment: ' + newListCounterId + ';';
            newRule += '}';
            appendRule(styleSheet, newRule);
        }

        /**
         * Takes an element and parses it and its subtree for any text:list elements.
         * The text:list elements then have CSS rules applied that give each one
         * a unique global CSS counter for the purpose of list numbering.
         * @param {!string} topLevelListId
         * @param {!Element} element
         * @param {!number} listLevel
         * @param {!ParseState} parseState
         * @return {undefined}
         */
        function iterateOverChildListElements(topLevelListId, element, listLevel, parseState) {
            var isListElement = element.namespaceURI === textns && element.localName === "list",
                isListItemElement = element.namespaceURI === textns && element.localName === "list-item",
                childElement;

            // don't continue iterating over elements that aren't text:list or text:list-item
            if (!isListElement && !isListItemElement) {
                parseState.continuedCounterIdStack = [];
                return;
            }

            if (isListElement) {
                listLevel += 1;
                createCssRulesForList(topLevelListId, element, listLevel, parseState);
            }

            childElement = element.firstElementChild;
            while (childElement) {
                iterateOverChildListElements(topLevelListId, childElement, listLevel, parseState);
                childElement = childElement.nextElementSibling;
            }
        }

        /**
         * Takes a text:list element and creates CSS counter rules used for numbering
         * @param {!Object.<!string, !string>} contentRules
         * @param {!Element} list
         * @param {!Element=} continuedList
         * @return {undefined}
         */
        this.createCounterRules = function (contentRules, list, continuedList) {
            var /**@type{!string}*/
                listId = list.getAttributeNS(xmlns, "id"),
                currentParseState = new ParseState(contentRules, getCounterIdStack(continuedList));

            // ensure there is a unique identifier for each list if it does not have one
            if (!listId) {
                customListIdIndex += 1;
                listId = "X" + customListIdIndex;
            } else {
                listId = "Y" + listId;
            }

            iterateOverChildListElements(listId, list, 0, currentParseState);

            counterIdStacks[listId + "-level1-1"] = currentParseState.counterIdStack;
        };

        /**
         * Initialises all CSS counters created so far by this UniqueListCounter with a counter-reset rule.
         * Calling this method twice will cause the previous counter reset CSS rule to be overridden
         * @return {undefined}
         */
        this.initialiseCreatedCounters = function () {
            var newRule;

            newRule = 'office|document';
            newRule += '{';
            newRule += 'counter-reset: ' + globalCounterResetRule + ';';
            newRule += "}";
            appendRule(styleSheet, newRule);
        };
    }

    /**
     * A number written as the format of a level asks: "1" for the numbers,
     * "a" and "A" for the letters, "i" and "I" for the numbers of Rome.
     * @param {!number} value
     * @param {!string} format
     * @return {!string}
     */
    function writtenAs(value, format) {
        var letters = "abcdefghijklmnopqrstuvwxyz",
            romans = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
                [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"],
                [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]],
            /**@type{!string}*/
            written = "",
            /**@type{!number}*/
            left = value,
            /**@type{!number}*/
            i;
        if (format === "a" || format === "A") {
            // A number past the letters is written with as many letters as
            // it takes, "aa" after "z", which is how an office writes it.
            while (left > 0) {
                left -= 1;
                written = letters.charAt(left % 26) + written;
                left = Math.floor(left / 26);
            }
            return format === "A"
                ? written.toUpperCase()
                : written;
        }
        if (format === "i" || format === "I") {
            for (i = 0; i < romans.length; i += 1) {
                while (left >= romans[i][0]) {
                    written += romans[i][1];
                    left -= romans[i][0];
                }
            }
            return format === "I"
                ? written.toUpperCase()
                : written;
        }
        return String(value);
    }
    /**
     * @constructor
     */
    odf.ListStyleToCss = function ListStyleToCss() {

        var cssUnits = new webodfcore.CSSUnits(),
            odfUtils = odf.OdfUtils;

        /**
         * Takes a value with a valid CSS unit and converts it to a CSS pixel value
         * @param {!string} value
         * @return {!number}
         */
        function convertToPxValue(value) {
            var parsedLength = odfUtils.parseLength(value);
            if (!parsedLength) {
                runtime.log("Could not parse value '" + value + "'.");
                // Return 0 as fallback, might have least bad results if used
                return 0;
            }
            return cssUnits.convert(parsedLength.value, parsedLength.unit, "px");
        }

        /**
         * Return the supplied value with any backslashes escaped, and double-quotes escaped
         * @param {!string} value
         * @return {!string}
         */
        function escapeCSSString(value) {
            return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
        }

        /**
         * Determines whether the list element style-name matches the style-name we require
         * @param {!Element|undefined} list
         * @param {!string} matchingStyleName
         * @return {!boolean}
         */
        function isMatchingListStyle(list, matchingStyleName) {
            var styleName;
            if (list) {
                styleName = list.getAttributeNS(textns, "style-name");
            }
            return styleName === matchingStyleName;
        }

        /**
         * The content of the label of a numbered list.
         *
         * The label itself is worked out once and written on the element,
         * see "numberLists": the counters of css are of the page and not of
         * the document wherever a page holds its own styles, and a page that
         * holds its own styles is laid out for much less.
         * @return {!string}
         */
        function getNumberRule() {
            return "content: attr(odf-list-label);";
        }
        /**
         * Gets the CSS content for a image bullet list
         * @return {!string}
         */
        function getImageRule() {
            return "content: none";
        }

        /**
         * Gets the CSS content for a bullet list
         * @param {!Element} node
         * @return {!string}
         */
        function getBulletRule(node) {
            var bulletChar = node.getAttributeNS(textns, "bullet-char"),
                /**@type{?Element}*/
                textProperties = node.getElementsByTagNameNS(stylens, "text-properties")[0],
                /**@type{?string}*/
                fontName = textProperties
                    ? (textProperties.getAttributeNS(fons, "font-family")
                        || textProperties.getAttributeNS(stylens, "font-name"))
                    : null,
                rule;
            if (fontName && symbolFontRe.test(fontName)) {
                // Remap a known dingbat glyph, fall back to a plain disc for the
                // rest, and render it in a normal font instead of the missing
                // symbol font.
                if (symbolBulletMap.hasOwnProperty(bulletChar)) {
                    bulletChar = symbolBulletMap[bulletChar];
                } else if (bulletChar && bulletChar.charCodeAt(0) < 0x2000) {
                    // A glyph code (ASCII/Latin-1) with no mapping: use a disc.
                    bulletChar = "•";
                }
                rule = 'content: "' + escapeCSSString(bulletChar) + '"';
                rule += '; font-family: sans-serif';
                // The Unicode look-alike in a text font reads smaller than the
                // symbol it replaces (its visible disc is well under 1em), so
                // nudge it up to read as a proper bullet rather than a dot.
                rule += '; font-size: 1.5em';
                return rule;
            }
            return 'content: "' + escapeCSSString(bulletChar) + '"';
        }

        /**
         * Gets the CSS generated content rule for the list style
         * @param {!Element} node
         * @return {!string}
         */
        function getContentRule(node) {
            var contentRule = "",
                listLevelProps,
                listLevelPositionSpaceMode,
                listLevelLabelAlign,
                followedBy;

            if (node.localName === "list-level-style-number") {
                contentRule = getNumberRule();
            } else if (node.localName === "list-level-style-image") {
                contentRule = getImageRule();
            } else if (node.localName === "list-level-style-bullet") {
                contentRule = getBulletRule(node);
            }

            listLevelProps = /**@type{!Element}*/(node.getElementsByTagNameNS(stylens, "list-level-properties")[0]);
            if (listLevelProps) {
                listLevelPositionSpaceMode = listLevelProps.getAttributeNS(textns, "list-level-position-and-space-mode");

                if (listLevelPositionSpaceMode === "label-alignment") {
                    listLevelLabelAlign = /**@type{!Element}*/(listLevelProps.getElementsByTagNameNS(stylens, "list-level-label-alignment")[0]);
                    if (listLevelLabelAlign) {
                        followedBy = listLevelLabelAlign.getAttributeNS(textns, "label-followed-by");
                    }

                    if (followedBy === "space") {
                        contentRule += ' "\\a0"';
                    }
                }
            }

            // Content needs to be on a new line if it contains slashes due to a bug in older versions of webkit
            // E.g., the one used in the qt runtime tests - https://bugs.webkit.org/show_bug.cgi?id=35010
            return '\n' + contentRule + ';\n';
        }

        /**
         * Takes a text:list-style element and returns the generated CSS
         * content rules for each list level in the list style
         * @param {!Element} listStyleNode
         * @return {!Object.<!string, !string>}
         */
        function getAllContentRules(listStyleNode) {
            var childNode = listStyleNode.firstElementChild,
                level,
                rules = {};

            while (childNode) {
                level = childNode.getAttributeNS(textns, "level");
                level = level && parseInt(level, 10);
                rules[level] = getContentRule(childNode);
                childNode = childNode.nextElementSibling;
            }
            return rules;
        }

        /**
         * In label-width-and-position mode of specifying list layout the margin and indent specified in
         * the paragraph style is additive to the layout specified in the list style.
         *
         *   fo:margin-left    text:space-before    fo:text-indent  +-----------+
         * +---------------->+------------------>+----------------->|   label   |     LIST TEXT
         *                                                          +-----------+
         * +---------------->+------------------>+-------------------->LIST TEXT LIST TEXT LIST TEXT
         *                                        text:min-label-width
         *
         * To get this additive behaviour we calculate an offset from the left side of the page which is
         * the space-before +  min-label-width. We then apply this offset to each text:list-item
         * element and apply the negative value of the offset to each text:list element. This allows the positioning
         * provided in the list style to apply relative to the paragraph style as we desired. Then on each
         * ::before pseudo-element which holds the label we apply the negative value of the min-label-width to complete
         * the alignment from the left side of the page. We then apply the min-label-distance as padding to the right
         * of the ::before psuedo-element to complete the list label placement.
         *
         * For the label-alignment mode the paragraph style overrides the list style but we specify offsets for
         * the text:list and text:list-item elements to keep the code consistent between the modes
         *
         * Diagram and implementation based on: https://wiki.openoffice.org/wiki/Number_layout
         *
         * @param {!CSSStyleSheet} styleSheet
         * @param {!string} name
         * @param {!Element} node
         * @return {undefined}
         */
        function addListStyleRule(styleSheet, name, node) {
            var selector = 'text|list[text|style-name="' + name + '"]',
                level = node.getAttributeNS(textns, "level"),
                selectorLevel,
                listItemRule,
                listLevelProps,
                listLevelPositionSpaceMode,
                listLevelLabelAlign,
                listIndent,
                textAlign,
                bulletWidth,
                labelDistance,
                bulletIndent,
                followedBy,
                leftOffset;

            // style:list-level-properties is an optional element. Since the rest of this function
            // depends on its existence, return from it if it is not found.
            listLevelProps = /**@type{!Element|undefined}*/(node.getElementsByTagNameNS(stylens, "list-level-properties")[0]);
            listLevelPositionSpaceMode = listLevelProps && listLevelProps.getAttributeNS(textns, "list-level-position-and-space-mode");
            listLevelLabelAlign = /**@type{!Element|undefined}*/(listLevelProps) &&
                                  /**@type{!Element|undefined}*/(listLevelProps.getElementsByTagNameNS(stylens, "list-level-label-alignment")[0]);

            // calculate CSS selector based on list level
            level = level && parseInt(level, 10);
            selectorLevel = level;
            while (selectorLevel > 1) {
                selector += ' > text|list-item > text|list';
                selectorLevel -= 1;
            }

            // TODO: fo:text-align is only an optional attribute with <style:list-level-properties>,
            // needs to be found what should be done if not present. For now falling back to "left"
            textAlign = (listLevelProps && listLevelProps.getAttributeNS(fons, "text-align")) || "left";
            // convert the start and end text alignments to left and right as
            // IE does not support the start and end values for text alignment
            switch (textAlign) {
                case "end":
                    textAlign = "right";
                    break;
                case "start":
                    textAlign = "left";
                    break;
            }

            // get relevant properties from the style based on the list label positioning mode
            if (listLevelPositionSpaceMode === "label-alignment") {
                // TODO: fetch the margin and indent from the paragraph style if it is defined there
                // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#element-style_list-level-label-alignment
                // for now just fallback to "0px" if not defined on <style:list-level-label-alignment>
                listIndent = (listLevelLabelAlign && listLevelLabelAlign.getAttributeNS(fons, "margin-left")) || "0px";
                bulletIndent = (listLevelLabelAlign && listLevelLabelAlign.getAttributeNS(fons, "text-indent")) || "0px";
                followedBy = listLevelLabelAlign && listLevelLabelAlign.getAttributeNS(textns, "label-followed-by");
                leftOffset = convertToPxValue(listIndent);

            } else {
                // this block is entered if list-level-position-and-space-mode
                // has the value label-width-and-position or is not present
                // TODO: fallback values should be read from parent styles or (system) defaults
                listIndent = (listLevelProps && listLevelProps.getAttributeNS(textns, "space-before")) || "0px";
                bulletWidth = (listLevelProps && listLevelProps.getAttributeNS(textns, "min-label-width")) || "0px";
                labelDistance = (listLevelProps && listLevelProps.getAttributeNS(textns, "min-label-distance")) || "0px";
                leftOffset = convertToPxValue(listIndent) + convertToPxValue(bulletWidth);
            }

            listItemRule = selector + ' > text|list-item';
            listItemRule += '{';
            listItemRule += 'margin-left: ' + leftOffset + 'px;';
            listItemRule += '}';
            appendRule(styleSheet, listItemRule);

            listItemRule = selector + ' > text|list-item > text|list';
            listItemRule += '{';
            listItemRule += 'margin-left: ' + (-leftOffset) + 'px;';
            listItemRule += '}';
            appendRule(styleSheet, listItemRule);

            if (listLevelPositionSpaceMode !== "label-alignment") {
                // In label-width-and-position mode the list level alone fixes the
                // indent (leftOffset above, plus the hanging label below). A
                // presentation paragraph exported from PowerPoint also carries
                // the same indent as fo:margin-left / fo:text-indent on its own
                // paragraph style; applying both stacks them and pushes the text
                // ~twice as far from the bullet. Neutralise the paragraph's own
                // horizontal indent for list paragraphs so only the list level
                // counts.
                listItemRule = selector + ' > text|list-item > :not(text|list)';
                listItemRule += '{ margin-left: 0; text-indent: 0; }';
                appendRule(styleSheet, listItemRule);
            }

            // insert the list label before every immediate child of the list-item, except for lists
            listItemRule = selector + ' > text|list-item > :not(text|list):first-child:before';
            listItemRule += '{';
            listItemRule += 'text-align: ' + textAlign + ';';
            listItemRule += 'display: inline-block;';

            if (listLevelPositionSpaceMode === "label-alignment") {
                listItemRule += 'margin-left: ' + bulletIndent + ';';
                if (followedBy === "listtab") {
                    // TODO: remove this padding once text:label-followed-by="listtab" is implemented
                    // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-text_label-followed-by
                    listItemRule += 'padding-right: 0.2cm;';
                }
            } else {
                listItemRule += 'min-width: ' + bulletWidth + ';';
                listItemRule += 'margin-left: ' + (parseFloat(bulletWidth) === 0 ? '' : '-') + bulletWidth + ';';
                listItemRule += 'padding-right: ' + labelDistance + ';';
            }
            listItemRule += '}';
            appendRule(styleSheet, listItemRule);
        }

        /**
         * Adds a CSS rule for every ODF list style
         * @param {!CSSStyleSheet} styleSheet
         * @param {!string} name
         * @param {!Element} node
         * @return {undefined}
         */
        function addRule(styleSheet, name, node) {
            var n = node.firstElementChild;
            while (n) {
                if (n.namespaceURI === textns) {
                    addListStyleRule(styleSheet, name, n);
                }
                n = n.nextElementSibling;
            }
        }

        /**
         * Adds new CSS rules based on any properties in
         * the ODF list content if they affect the final style
         * @param {!CSSStyleSheet} styleSheet
         * @param {!Element} odfBody
         * @param {!Object.<!string, !odf.StyleTreeNode>} listStyles
         * @return {undefined}
         */
        function applyContentBasedStyles(styleSheet, odfBody, listStyles) {
            var lists = odfBody.getElementsByTagNameNS(textns, "list"),
                listCounter = new UniqueListCounter(styleSheet),
                list,
                /**
                 * The last list of each style, that a list which continues
                 * the numbering carries on from: the standard says the list
                 * that goes before it, and what goes before it is the last
                 * list written in the same style and not whatever list was
                 * written last, which is another list of another style as
                 * often as not.
                 * @type{!Object.<string,!Element>}
                 */
                previousOfStyle = {},
                continueNumbering,
                continueListXmlId,
                xmlId,
                styleName,
                contentRules,
                listsWithXmlId = {},
                i;

            for (i = 0; i < lists.length; i += 1) {
                list = /**@type{!Element}*/(lists.item(i));
                styleName = list.getAttributeNS(textns, "style-name");

                // TODO: Handle default list style
                // lists that have no text:style-name attribute defined and do not have a parent text:list that
                // defines a style name use a default implementation defined style as per the spec
                // http://docs.oasis-open.org/office/v1.2/os/OpenDocument-v1.2-os-part1.html#attribute-text_style-name_element-text_list

                // lists that have no text:style-name attribute defined but do have a parent list that defines a
                // style name will inherit that style and will be handled correctly as any text:list with a style defined
                // will have CSS rules applied to its child text:list elements
                // A list may name a style that is nowhere in the document, and
                // one that is written by another program often does. It is then
                // drawn without a style of its own, rather than stopping the
                // reading of the whole document.
                if (styleName && !listStyles[styleName]) {
                    runtime.log("DEBUG: no list style named " + styleName + ".");
                    styleName = null;
                }
                if (styleName) {
                    continueNumbering = list.getAttributeNS(textns, "continue-numbering");
                    continueListXmlId = list.getAttributeNS(textns, "continue-list");
                    xmlId = list.getAttributeNS(xmlns, "id");

                    // store the list keyed by the xml:id
                    if (xmlId) {
                        listsWithXmlId[xmlId] = list;
                    }

                    contentRules = getAllContentRules(listStyles[styleName].element);

                    // lists with different styles cannot be continued
                    // https://tools.oasis-open.org/issues/browse/OFFICE-3558
                    if (continueNumbering && !continueListXmlId
                            && previousOfStyle.hasOwnProperty(styleName)) {
                        listCounter.createCounterRules(contentRules, list,
                            previousOfStyle[styleName]);
                    } else if (continueListXmlId && isMatchingListStyle(listsWithXmlId[continueListXmlId], styleName)) {
                        listCounter.createCounterRules(contentRules, list, listsWithXmlId[continueListXmlId]);
                    } else {
                        listCounter.createCounterRules(contentRules, list);
                    }
                    previousOfStyle[styleName] = list;
                }
            }

            listCounter.initialiseCreatedCounters();
        }

        /**
         * The level of a list style that answers for a level of a list.
         * @param {!Element} style the "text:list-style"
         * @param {!number} level from one
         * @return {?Element}
         */
        function levelOfStyle(style, level) {
            var node = style.firstElementChild;
            while (node) {
                if (node.namespaceURI === textns
                        && String(node.getAttributeNS(textns, "level"))
                            === String(level)) {
                    return node;
                }
                node = node.nextElementSibling;
            }
            return null;
        }
        /**
         * Write on one item of a list the label it carries.
         * @param {!Element} item
         * @param {!Element} style the "text:list-style"
         * @param {!number} level from one
         * @param {!Array.<!number>} held the number each level stands at
         * @param {!Element=} where what carries the label, the first child
         *                  of the item by default
         * @return {undefined}
         */
        function labelOne(item, style, level, held, where) {
            var rule = levelOfStyle(style, level),
                /**@type{!string}*/
                written = "",
                /**@type{!number}*/
                shows,
                /**@type{!number}*/
                start,
                /**@type{?Element}*/
                own,
                /**@type{!string}*/
                format,
                /**@type{!number}*/
                l;
            if (!rule || (rule.localName !== "list-level-style-number"
                    && rule.localName !== "outline-level-style")) {
                return;
            }
            start = parseInt(item.getAttributeNS(textns, "start-value")
                || rule.getAttributeNS(textns, "start-value") || "", 10);
            if (isNaN(start)) {
                held[level - 1] = (held[level - 1] || 0) + 1;
            } else {
                held[level - 1] = start;
            }
            held.length = level;
            shows = parseInt(rule.getAttributeNS(textns, "display-levels")
                || "1", 10);
            if (isNaN(shows) || shows < 1) {
                shows = 1;
            }
            written += rule.getAttributeNS(stylens, "num-prefix") || "";
            for (l = level - shows + 1; l <= level; l += 1) {
                own = levelOfStyle(style, l);
                format = own
                    ? own.getAttributeNS(stylens, "num-format") || "1"
                    : "1";
                written += writtenAs(held[l - 1] || 1, format);
                if (l < level) {
                    written += ".";
                }
            }
            written += rule.getAttributeNS(stylens, "num-suffix") || "";
            (where || /**@type{!Element}*/(item.firstElementChild)).setAttribute(
                "odf-list-label",
                written
            );
        }
        /**
         * Write on every item of every list the label it carries.
         *
         * The numbers of the lists were counted by the counters of css,
         * which are of the page and not of the document wherever a page
         * holds its own styles: they are counted here instead, once, in the
         * order the document is written, and written on the elements as
         * "odf-list-label", which the rules of the labels read.
         *
         * What the standard says of the numbering is answered for: the
         * format of each level and the levels a label shows, the prefix and
         * the suffix of a level, the number a level starts at, and a list
         * that carries on the numbering of the last list of its style.
         * @param {!Element} odfBody
         * @param {(!Object.<string,!odf.StyleTreeNode>|undefined)} listStyles
         * @return {undefined}
         */
        function numberLists(odfBody, listStyles) {
            var lists = odfBody.getElementsByTagNameNS(textns, "list"),
                /**@type{!Object.<string,!Array.<!number>>}*/
                counts = {},
                /**@type{!number}*/
                i;
            /**
             * Whether a list stands inside another list.
             * @param {!Element} list
             * @return {!boolean}
             */
            function standsInAList(list) {
                var walk = /**@type{?Element}*/(list.parentElement);
                while (walk) {
                    if (walk.namespaceURI === textns
                            && walk.localName === "list") {
                        return true;
                    }
                    walk = /**@type{?Element}*/(walk.parentElement);
                }
                return false;
            }
            /**
             * The style a list is written in, its own or the one of the list
             * it stands in.
             * @param {!Element} list
             * @return {!string}
             */
            function styleOfList(list) {
                var walk = /**@type{?Element}*/(list),
                    /**@type{!string}*/
                    name = "";
                while (walk && !name) {
                    if (walk.namespaceURI === textns
                            && walk.localName === "list") {
                        name = walk.getAttributeNS(textns, "style-name") || "";
                    }
                    walk = /**@type{?Element}*/(walk.parentElement);
                }
                return listStyles && listStyles.hasOwnProperty(name)
                    ? name
                    : "";
            }
            /**
             * Write the labels of one list and of the lists it holds, in the
             * order the document is written: a list that stands under an
             * item is numbered where that item stands and not once the whole
             * of the list it stands in is numbered, or it would carry the
             * number of the last item of it.
             * @param {!Element} list
             * @param {!Element} style the "text:list-style"
             * @param {!number} level from one
             * @param {!Array.<!number>} held the number each level stands at
             * @return {undefined}
             */
            function numberOne(list, style, level, held) {
                var /**@type{?Element}*/
                    item = list.firstElementChild,
                    /**@type{?Element}*/
                    under;
                while (item) {
                    if (item.namespaceURI === textns
                            && item.localName === "list-item") {
                        if (item.firstElementChild
                                && item.firstElementChild.localName
                                    !== "list") {
                            labelOne(item, style, level, held);
                        }
                        under = item.firstElementChild;
                        while (under) {
                            if (under.namespaceURI === textns
                                    && under.localName === "list") {
                                numberOne(under, style, level + 1, held);
                            }
                            under = under.nextElementSibling;
                        }
                    }
                    item = item.nextElementSibling;
                }
            }
            if (!listStyles) {
                return;
            }
            /**
             * Write the labels of a list that stands in no other list, and
             * of everything it holds.
             * @param {!Element} list
             * @return {undefined}
             */
            function numberWhole(list) {
                var name = styleOfList(list),
                    /**@type{!Array.<!number>}*/
                    held;
                if (!name || standsInAList(list) || !listStyles) {
                    return;
                }
                held = counts.hasOwnProperty(name)
                    ? counts[name]
                    : [];
                counts[name] = held;
                // A list that does not carry on the numbering of the last
                // list of its style begins where its style says.
                if (!list.getAttributeNS(textns, "continue-numbering")
                        && !list.getAttributeNS(textns, "continue-list")) {
                    held.length = 0;
                }
                numberOne(list, listStyles[name].element, 1, held);
            }
            for (i = 0; i < lists.length; i += 1) {
                numberWhole(/**@type{!Element}*/(lists.item(i)));
            }
        }
        /**
         * Write on every heading the number of its chapter.
         *
         * A document numbers its chapters with an outline style, that names
         * a way of writing the number of each level: it is not a list, and
         * the headings that carry those numbers stand in no list. A heading
         * that stands in a list is numbered by the list and left alone here.
         * @param {!Element} odfBody
         * @param {(!Object.<string,!odf.StyleTreeNode>|undefined)} listStyles
         * @return {undefined}
         */
        function numberHeadings(odfBody, listStyles) {
            var headings = odfBody.getElementsByTagNameNS(textns, "h"),
                /**@type{?Element}*/
                outline = null,
                /**@type{!Array.<!number>}*/
                held = [],
                /**@type{!number}*/
                level,
                /**@type{?Element}*/
                parent,
                /**@type{!Element}*/
                heading,
                /**@type{!number}*/
                i;
            if (!listStyles) {
                return;
            }
            Object.keys(listStyles).forEach(function (name) {
                if (!outline
                        && listStyles[name].element.localName
                            === "outline-style") {
                    outline = listStyles[name].element;
                }
            });
            if (!outline) {
                return;
            }
            for (i = 0; i < headings.length; i += 1) {
                heading = /**@type{!Element}*/(headings.item(i));
                parent = heading.parentElement;
                level = parseInt(heading.getAttributeNS(textns,
                    "outline-level") || "1", 10);
                if (isNaN(level) || level < 1) {
                    level = 1;
                }
                // A heading of a list is numbered by its list, and one that
                // the document writes as the head of a list carries no
                // number at all.
                if (parent && parent.namespaceURI === textns
                        && parent.localName === "list-item") {
                    parent = null;
                } else if (heading.getAttributeNS(textns, "is-list-header")
                        !== "true") {
                    labelOne(heading, /**@type{!Element}*/(outline), level,
                        held, heading);
                }
            }
        }
        /**
         * Creates CSS styles from the given ODF list styles and applies them to the stylesheet
         * @param {!CSSStyleSheet} styleSheet
         * @param {!odf.StyleTree.Tree} styleTree
         * @param {!Element} odfBody
         * @return {undefined}
         */
        this.applyListStyles = function (styleSheet, styleTree, odfBody) {
            var styleFamilyTree,
                node;

            /*jslint sub:true*/
            // The available families are defined in StyleUtils.familyNamespacePrefixes.
            styleFamilyTree = (styleTree["list"]);
            /*jslint sub:false*/
            if (styleFamilyTree) {
                Object.keys(styleFamilyTree).forEach(function (styleName) {
                    node = /**@type{!odf.StyleTreeNode}*/(styleFamilyTree[styleName]);
                    addRule(styleSheet, styleName, node.element);
                });
            }

            applyContentBasedStyles(styleSheet, odfBody, styleFamilyTree);
            numberLists(odfBody, styleFamilyTree);
            numberHeadings(odfBody, styleFamilyTree);
            appendRule(styleSheet, 'text|h[odf-list-label]:before'
                + '{content: attr(odf-list-label); white-space: pre;}');
        };
    };
}());

