/**
 * Copyright (C) 2026 Daniel Berthereau <Daniel.git@Berthereau.net>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License (GNU AGPL) as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/**
 * Run a script or a page of the library in the webengine of qt, which is the
 * blink of chromium, and end with the code the script asked for. It is what
 * the target "test-qtjsruntime" runs the tests of the library with.
 */

#include "runner.h"

#include <QApplication>
#include <QTextStream>

namespace {

/**
 * Read the options, that come before the name of the script or of the page, and
 * leave the rest to the script.
 */
bool parse(const QStringList& given, Options& options, QTextStream& err) {
    int i = 0;
    while (i < given.size() && given.at(i).startsWith("--")) {
        const QString name = given.at(i).mid(2);
        if (i + 1 >= given.size()) {
            err << "The option '" << given.at(i) << "' takes a value.\n";
            return false;
        }
        const QString value = given.at(i + 1);
        if (name == "export-pdf") {
            options.exportPdf = value;
        } else if (name == "timeout") {
            options.timeout = value.toInt();
        } else {
            err << "Unknown option '" << given.at(i) << "'.\n";
            return false;
        }
        i += 2;
    }
    options.arguments = given.mid(i);
    return !options.arguments.isEmpty();
}

} // namespace

int main(int argc, char** argv) {
    QTextStream err(stderr);
    QApplication app(argc, argv);
    app.setApplicationName("qtjsruntime");

    Options options;
    if (!parse(app.arguments().mid(1), options, err)) {
        err << "Usage: " << argv[0] << " [--export-pdf pdffile]"
               " [--timeout seconds] html/javascriptfile [arguments]\n";
        err.flush();
        return 1;
    }

    Runner runner(options);
    return app.exec();
}
