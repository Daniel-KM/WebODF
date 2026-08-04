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

#ifndef VIEWERSCHEME_H
#define VIEWERSCHEME_H

#include <QString>
#include <QWebEngineUrlSchemeHandler>

/**
 * Serve the viewer and the document that is open, and nothing else.
 *
 * Everything the window shows comes from this one scheme: the page, its style,
 * its script and the library, read from the resources of the program, and the
 * document that was chosen, read from the disk. Serving them together is what
 * makes them one origin, which is what the page needs: a page of one scheme may
 * not read what another serves, so a page of "qrc:" is refused the document,
 * where "odf:/viewer.html" reads "odf:/document" as it reads anything of its
 * own.
 *
 * The disk is not opened to the page for that: the one document that was chosen
 * is served, at one address, whichever file it is.
 */
class ViewerScheme : public QWebEngineUrlSchemeHandler {
    Q_OBJECT
public:
    /** The page the window loads. */
    static const char* pageUrl;

    /**
     * Declare the scheme to webengine. It has to be called before the
     * application is built, as webengine reads the schemes once, when it
     * starts.
     */
    static void registerScheme();

    explicit ViewerScheme(QObject* parent);

    /** Choose the document that is served from now on. */
    void setPath(const QString& path);

    void requestStarted(QWebEngineUrlRequestJob* job) override;

private:
    void serveDocument(QWebEngineUrlRequestJob* job);
    void serveResource(QWebEngineUrlRequestJob* job, const QString& name);

    QString path;
};

#endif
