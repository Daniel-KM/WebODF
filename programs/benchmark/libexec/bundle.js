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
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global require, process, console*/

// The modules of the benchmark are written for AMD, which the closure compiler
// carried until it dropped it: the option "--transform_amd_modules" is not one
// it knows any more. They are gathered here instead, each under the name of its
// file, with the few lines that resolve them at the end. Nothing is compiled: a
// benchmark measures the library, not itself.
//
// Usage: node libexec/bundle.js js benchmark.js
var fs = require("fs"),
    path = require("path");

/**
 * @param {!string} dir
 * @param {!string} output
 * @return {undefined}
 */
function bundle(dir, output) {
    "use strict";
    var names = fs.readdirSync(dir).filter(function (name) {
            return name.slice(-3) === ".js";
        }).sort(),
        parts = [`(function () {
    "use strict";
    var factories = {}, modules = {};
    function define(name, deps, factory) {
        if (factory === undefined) {
            factory = deps;
            deps = [];
        }
        factories[name] = {deps: deps, factory: factory};
    }
    function need(name) {
        var module = factories[name];
        if (!modules.hasOwnProperty(name)) {
            modules[name] = module.factory.apply(null, module.deps.map(need));
        }
        return modules[name];
    }
`]

    names.forEach(function (name) {
        var module = name.slice(0, -3),
            source = fs.readFileSync(path.join(dir, name), "utf8"),
            at = source.indexOf("define(");
        if (at === -1) {
            return;
        }
        // The call of the module is named after its file, as a loader of AMD
        // names it after the address it read it from.
        parts.push(`${source.slice(0, at)}define(${JSON.stringify(module)}, `
            + source.slice(at + "define(".length));
    });

    // The page starts the benchmark itself, so the module of the entry is
    // handed to it. It used to be named "module$HTMLBenchmark", the name the
    // closure compiler gave a module of AMD.
    parts.push(`    window.HTMLBenchmark = need("HTMLBenchmark");
}());
`);
    fs.writeFileSync(output, parts.join(""));
}

if (process.argv.length !== 4) {
    console.log("Usage: node libexec/bundle.js <directory> <output>");
    process.exit(1);
}
bundle(process.argv[2], process.argv[3]);
