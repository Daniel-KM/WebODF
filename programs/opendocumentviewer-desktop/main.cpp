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
 * A viewer of OpenDocument for the desktop, on linux, on windows and on macos.
 *
 * It is the same library, drawn in the webengine of qt, as the extensions for
 * the browsers and the viewer for android use: a document is read the same way
 * everywhere, and there is one place where the reading of the format lives.
 */

#include "viewerscheme.h"
#include "mainwindow.h"

#include <QApplication>
#include <QIcon>

int main(int argc, char** argv) {
    // The scheme the document is served at has to be declared before the
    // application is built, as webengine reads the schemes once, when it
    // starts.
    ViewerScheme::registerScheme();

    QApplication app(argc, argv);
    // The name of the organisation is what the settings of the window are kept
    // under, and it is the domain of the project rather than a company: the
    // viewer belongs to no one.
    app.setOrganizationName("webodf.org");
    app.setApplicationName("opendocumentviewer");
    app.setApplicationDisplayName("OpenDocument Viewer");
    app.setApplicationVersion(OPENDOCUMENTVIEWER_VERSION);
    app.setDesktopFileName("org.webodf.OpenDocumentViewer");
    // The icon is in the program, so the window carries it even where no
    // desktop serves one, on windows and on macos.
    app.setWindowIcon(QIcon(":/icon.png"));

    MainWindow window;
    window.show();

    // A document may be given on the command line, which is how a file manager
    // opens one, and the rest of the arguments are left to qt.
    const QStringList arguments = app.arguments();
    if (arguments.size() > 1 && !arguments.at(1).startsWith("-")) {
        window.open(arguments.at(1));
    }

    return app.exec();
}
