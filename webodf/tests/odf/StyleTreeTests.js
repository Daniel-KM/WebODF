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
 * @source: https://webodf.org/
 * @source: https://github.com/webodf/WebODF/
 */

/*global runtime, webodfcore, odf*/

/**
 * @constructor
 * @param {!webodfcore.UnitTestRunner} runner
 * @implements {webodfcore.UnitTest}
 */
odf.StyleTreeTests = function StyleTreeTests(runner) {
    "use strict";
    var r = runner,
        t,
        namespaceMap = odf.Namespaces.namespaceMap;

    /**
     * @param {!string} styles
     * @param {!string} automaticStyles
     * @return {!odf.StyleTree.Tree}
     */
    function styleTree(styles, automaticStyles) {
        var stylesTree = webodfcore.UnitTest.createXmlDocument(
                'office:styles',
                styles,
                namespaceMap
            ).documentElement,
            automaticStylesTree = webodfcore.UnitTest.createXmlDocument(
                'office:automatic-styles',
                automaticStyles,
                namespaceMap
            ).documentElement;
        return new odf.StyleTree(stylesTree, automaticStylesTree).getStyleTree();
    }

    this.setUp = function () {
        t = {};
    };
    this.tearDown = function () {
        t = {};
    };

    function listStyle_IsInTheFamilyOfTheLists() {
        t.tree = styleTree(
            '<text:list-style style:name="List_20_1">' +
              '<text:list-level-style-bullet text:bullet-char="-" text:level="1"></text:list-level-style-bullet>' +
            '</text:list-style>',
            ''
        );
        /*jslint sub:true*/
        t.found = Boolean(t.tree["list"]["List_20_1"]);
        /*jslint sub:false*/
        r.shouldBe(t, "t.found", "true");
    }

    // The numbering of the chapters is written as an outline style, and a list
    // of the text names it as its own style, so it belongs to the family of the
    // lists: a document that uses it is drawn without its numbering otherwise,
    // and the drawing used to stop on it altogether.
    function outlineStyle_IsInTheFamilyOfTheLists() {
        t.tree = styleTree(
            '<text:outline-style style:name="Outline">' +
              '<text:outline-level-style text:level="1" style:num-format="1"></text:outline-level-style>' +
            '</text:outline-style>',
            ''
        );
        /*jslint sub:true*/
        t.found = Boolean(t.tree["list"]["Outline"]);
        /*jslint sub:false*/
        r.shouldBe(t, "t.found", "true");
    }

    function outlineStyle_KeepsTheOtherFamiliesEmpty() {
        t.tree = styleTree(
            '<text:outline-style style:name="Outline">' +
              '<text:outline-level-style text:level="1" style:num-format="1"></text:outline-level-style>' +
            '</text:outline-style>',
            ''
        );
        /*jslint sub:true*/
        t.paragraphs = Object.keys(t.tree["paragraph"]).length;
        /*jslint sub:false*/
        r.shouldBe(t, "t.paragraphs", "0");
    }

    this.tests = function () {
        return r.name([
            listStyle_IsInTheFamilyOfTheLists,
            outlineStyle_IsInTheFamilyOfTheLists,
            outlineStyle_KeepsTheOtherFamiliesEmpty
        ]);
    };
    this.asyncTests = function () {
        return [];
    };
};
odf.StyleTreeTests.prototype.description = function () {
    "use strict";
    return "Test the families of the StyleTree.";
};
