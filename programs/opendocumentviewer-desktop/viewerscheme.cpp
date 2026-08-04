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
 * @source: https://github.com/webodf/WebODF/
 */

#include "viewerscheme.h"

#include <QBuffer>
#include <QFile>
#include <QMimeDatabase>
#include <QWebEngineUrlRequestJob>
#include <QWebEngineUrlScheme>

namespace {

/** The name the page reads the document under. */
const char* documentPath = "/document";

/**
 * The type of a resource of the program. Chromium refuses a script or a style
 * that is served under another type, so they are named here rather than
 * guessed.
 */
QByteArray typeOf(const QString& name) {
    if (name.endsWith(".html")) {
        return "text/html;charset=UTF-8";
    }
    if (name.endsWith(".css")) {
        return "text/css;charset=UTF-8";
    }
    if (name.endsWith(".js")) {
        return "text/javascript;charset=UTF-8";
    }
    return "application/octet-stream";
}

/** Answer with bytes the page keeps until it is done with them. */
void answer(QWebEngineUrlRequestJob* job, const QByteArray& type,
            const QByteArray& data) {
    QBuffer* const buffer = new QBuffer(job);
    buffer->setData(data);
    buffer->open(QIODevice::ReadOnly);
    job->reply(type, buffer);
}

} // namespace

const char* ViewerScheme::pageUrl = "odf:/viewer.html";

void ViewerScheme::registerScheme() {
    QWebEngineUrlScheme scheme("odf");
    // The scheme is declared secure, so that the page is a trustworthy origin,
    // and subject to the rules of cors, which every request of the page passes
    // anyway: they are all served from here, so they are all of its own origin.
    // It is deliberately not a local scheme: those are held apart by chromium,
    // and the page would then be refused the document unless the whole disk
    // were opened to it.
    scheme.setSyntax(QWebEngineUrlScheme::Syntax::Path);
    scheme.setFlags(QWebEngineUrlScheme::SecureScheme
                    | QWebEngineUrlScheme::CorsEnabled);
    QWebEngineUrlScheme::registerScheme(scheme);
}

ViewerScheme::ViewerScheme(QObject* parent)
    : QWebEngineUrlSchemeHandler(parent) {
}

void ViewerScheme::setPath(const QString& path_) {
    path = path_;
}

void ViewerScheme::requestStarted(QWebEngineUrlRequestJob* job) {
    const QString wanted = job->requestUrl().path();
    if (wanted == documentPath) {
        serveDocument(job);
    } else {
        serveResource(job, wanted);
    }
}

void ViewerScheme::serveDocument(QWebEngineUrlRequestJob* job) {
    if (path.isEmpty()) {
        job->fail(QWebEngineUrlRequestJob::UrlNotFound);
        return;
    }
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        job->fail(QWebEngineUrlRequestJob::RequestFailed);
        return;
    }
    // The whole document is read at once: the page reads it whole as well, as a
    // zip is read from its end, and a document that would not fit in memory
    // would not be drawn either.
    const QMimeType type = QMimeDatabase().mimeTypeForFile(path);
    answer(job, type.isValid()
        ? type.name().toUtf8()
        : QByteArray("application/octet-stream"), file.readAll());
}

void ViewerScheme::serveResource(QWebEngineUrlRequestJob* job,
        const QString& name) {
    // Only the files of the program are served, and only by their own name: a
    // path is never taken apart here, so nothing outside the resources can be
    // asked for.
    QFile file(":" + name);
    if (name.lastIndexOf('/') > 0 || !file.open(QIODevice::ReadOnly)) {
        job->fail(QWebEngineUrlRequestJob::UrlNotFound);
        return;
    }
    answer(job, typeOf(name), file.readAll());
}
