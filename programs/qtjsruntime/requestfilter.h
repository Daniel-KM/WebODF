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

#ifndef REQUESTFILTER_H
#define REQUESTFILTER_H

#include <QUrl>
#include <QWebEngineUrlRequestInfo>
#include <QWebEngineUrlRequestInterceptor>

/**
 * Let through what the page needs, and nothing else.
 *
 * A page that is run to test the library, or to draw a document into a file,
 * has no business on the network: a test that reaches a server is a test that
 * fails when the network is down, and a document that names a picture on a
 * server would have it read without anyone asking. So only the files of the
 * machine, the scheme of nativeio and what the page holds itself are served;
 * a page that was itself loaded from a server keeps the right to talk to that
 * one server, which is what the editor of the collaboration needs.
 *
 * It replaces the network access manager of the port to WebKit: WebEngine has
 * none, as the network is handled in the process of the page, and an
 * interceptor is where a request is seen.
 */
class RequestFilter : public QWebEngineUrlRequestInterceptor {
    Q_OBJECT
public:
    RequestFilter(QObject* parent, const QUrl& page)
            : QWebEngineUrlRequestInterceptor(parent),
              host(page.host()),
              port(page.port()) {
    }

    void interceptRequest(QWebEngineUrlRequestInfo& info) override {
        const QUrl url = info.requestUrl();
        const QString scheme = url.scheme();
        if (scheme == "file" || scheme == "qrc" || scheme == "nativeio"
                || scheme == "data" || scheme == "blob" || scheme == "about") {
            return;
        }
        if (!host.isEmpty() && url.host() == host && url.port() == port) {
            return;
        }
        info.block(true);
    }

private:
    const QString host;
    const int port;
};

#endif
