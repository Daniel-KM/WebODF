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

#include "runner.h"

#include "bindings.h"
#include "nativeio.h"
#include "requestfilter.h"

#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QTemporaryFile>
#include <QTimer>
#include <QWebChannel>
#include <QWebEngineProfile>
#include <QWebEngineScript>
#include <QWebEngineScriptCollection>
#include <QWebEngineSettings>
#include <QWebEngineView>

namespace {

/** How long the page is left between two questions, in milliseconds. */
const int pollInterval = 150;

/** How many quiet answers in a row mean that the page is done. */
const int quietRoundsNeeded = 2;

/** The size the page is drawn in when no file is written. */
const QSize defaultViewSize(1024, 768);

/**
 * Write a list of strings the way javascript reads it.
 */
QString asJson(const QStringList& strings) {
    QJsonArray array;
    for (const QString& string : strings) {
        array.append(string);
    }
    return QString::fromUtf8(QJsonDocument(array)
            .toJson(QJsonDocument::Compact)).trimmed();
}

/**
 * Write a string the way javascript reads it.
 */
QString asJson(const QString& string) {
    const QString array = asJson(QStringList{string});
    return array.mid(1).chopped(1);
}

/**
 * Make the url absolute, keeping the query and the fragment: they are what a
 * page is often told to do, and loading a relative path loses them.
 */
QUrl absolute(const QString& name) {
    const QUrl url(name);
    if (!url.isRelative() && url.scheme() != "file") {
        return url;
    }
    const QString path = url.scheme() == "file"
        ? url.toLocalFile()
        : url.path();
    QUrl result = QUrl::fromLocalFile(QFileInfo(path).absoluteFilePath());
    result.setQuery(url.query());
    result.setFragment(url.fragment());
    return result;
}

} // namespace

Runner::Runner(const Options& options_)
    : QWebEnginePage(static_cast<QObject*>(nullptr)),
      options(options_),
      scriptMode(options_.arguments.at(0).endsWith(".js")),
      err(stderr),
      nativeio(new NativeIO(this, QDir::current())),
      view(new QWebEngineView()),
      bootstrap(nullptr),
      quietRounds(0),
      watching(false),
      sawError(false) {

    QWebEngineProfile* const profile = QWebEngineProfile::defaultProfile();
    profile->setUrlRequestInterceptor(new RequestFilter(this,
            absolute(options.arguments.at(0))));

    QWebChannel* const channel = new QWebChannel(this);
    channel->registerObject("nativeio", nativeio);
    setWebChannel(channel);

    // The watcher goes in every page before anything else runs, so that it
    // sees the whole of what the page does.
    QWebEngineScript watcher;
    watcher.setName("qtjsruntime-idle");
    watcher.setSourceCode(QString::fromUtf8(idleWatcher()));
    watcher.setInjectionPoint(QWebEngineScript::DocumentCreation);
    watcher.setWorldId(QWebEngineScript::MainWorld);
    watcher.setRunsOnSubFrames(true);
    profile->scripts()->insert(watcher);

    QWebEngineSettings* const preferences = settings();
    // A page loaded from a file reads the library and the documents beside it,
    // which chromium forbids unless it is told otherwise; it has no business
    // on the network, which the filter above sees to as well.
    preferences->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls,
                              true);
    preferences->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls,
                              false);
    preferences->setAttribute(QWebEngineSettings::ErrorPageEnabled, false);
    preferences->setAttribute(QWebEngineSettings::ShowScrollBars, false);

    connect(this, &QWebEnginePage::loadFinished, this, &Runner::loaded);

    // The page is shown, even when nothing is drawn into a file: chromium
    // slows down the timers of a page that is not seen, and stops asking for
    // frames, which a test that waits for one would wait for forever. Under a
    // platform without a screen, "-platform offscreen", showing it costs
    // nothing.
    view->setPage(this);
    view->resize(defaultViewSize);
    view->show();

    if (options.timeout > 0) {
        QTimer::singleShot(options.timeout * 1000, this, [this] {
            err << "The page did not end within " << options.timeout
                << " seconds.\n";
            err.flush();
            qApp->exit(3);
        });
    }

    if (scriptMode) {
        loadScript();
    } else {
        loadPage();
    }
}

Runner::~Runner() {
    QWebEngineProfile::defaultProfile()->setUrlRequestInterceptor(nullptr);
    delete view;
}

void Runner::loadScript() {
    const QStringList arguments = options.arguments;
    const QFileInfo info(arguments.at(0));
    if (!info.isReadable() || !info.isFile()) {
        err << "Cannot read file '" << arguments.at(0) << "'.\n";
        err.flush();
        qApp->exit(1);
        return;
    }
    // The runtime of the library looks for the classes it loads in the
    // directory of the script that holds it and in the current one, as it does
    // under node.
    const QStringList libraryPaths = {info.dir().absolutePath(),
                                      QDir::currentPath()};
    const QString page = QStringLiteral(R"HTML(<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>qtjsruntime</title>
<script>%1</script>
<script>%2</script>
<script src="%3"></script>
<script>
new QWebChannel(qt.webChannelTransport, function (channel) {
    window.__qtjsruntime.install(channel.objects.nativeio, %4, %5);
    %6
});
</script>
</head>
<body></body>
</html>
)HTML")
        .arg(QString::fromUtf8(webChannelScript()),
             QString::fromUtf8(runtimeBindings()),
             QString::fromUtf8(QUrl::fromLocalFile(info.absoluteFilePath())
                     .toEncoded()),
             asJson(libraryPaths),
             asJson(QDir::currentPath()),
             arguments.size() > 1
                 ? "window.__qtjsruntime.run("
                     + asJson(arguments.mid(1)) + ");"
                 : QString());

    // The page is written beside the document rather than in the directory of
    // the temporary files, so that a path the script reads is read from the
    // same place as under node, and so that the scripts of the library, whose
    // paths are absolute, are read from a page of the same scheme.
    bootstrap = new QTemporaryFile(QDir::current()
            .absoluteFilePath("qtjsruntimeXXXXXX.html"), this);
    if (!bootstrap->open() || bootstrap->write(page.toUtf8()) < 0) {
        err << "Cannot write the page that runs the script in "
            << QDir::currentPath() << ".\n";
        err.flush();
        qApp->exit(1);
        return;
    }
    bootstrap->flush();
    setUrl(QUrl::fromLocalFile(QFileInfo(*bootstrap).absoluteFilePath()));
}

void Runner::loadPage() {
    const QUrl url = absolute(options.arguments.at(0));
    if (url.isLocalFile()) {
        const QFileInfo info(url.toLocalFile());
        if (!info.isReadable() || !info.isFile()) {
            err << "Cannot read file '" << url.toString() << "'.\n";
            err.flush();
            qApp->exit(1);
            return;
        }
    }
    setUrl(url);
}

void Runner::loaded(bool ok) {
    if (!ok) {
        err << "Cannot load '" << url().toString() << "'.\n";
        err.flush();
        qApp->exit(1);
        return;
    }
    if (!scriptMode) {
        // A page that uses the library gets the same bindings, so that it may
        // write a file or end the program as a script does.
        runJavaScript(QString::fromUtf8(webChannelScript())
            + QString::fromUtf8(runtimeBindings())
            + "new QWebChannel(qt.webChannelTransport, function (channel) {"
              "if (typeof runtime !== \"undefined\") {"
              "window.__qtjsruntime.install(channel.objects.nativeio, [], "
            + asJson(QDir::currentPath()) + "); } });");
    }
    // A script says when it is done by calling "runtime.exit", so there is
    // nothing to watch for. A page does not, so it is watched until it stops
    // changing, which is also when it may be printed into a file.
    if (!scriptMode || !options.exportPdf.isEmpty()) {
        startWatching();
    }
}

void Runner::startWatching() {
    if (!watching) {
        watching = true;
        QTimer::singleShot(pollInterval, this, &Runner::pollIdle);
    }
}

void Runner::pollIdle() {
    runJavaScript(QStringLiteral(
            "!!(window.__qtjsruntime && window.__qtjsruntime.idle())"),
            [this](const QVariant& answer) {
        quietRounds = answer.toBool()
            ? quietRounds + 1
            : 0;
        if (quietRounds >= quietRoundsNeeded) {
            writeExports();
        } else {
            QTimer::singleShot(pollInterval, this, &Runner::pollIdle);
        }
    });
}

void Runner::writeExports() {
    writePdf([this] {
        qApp->exit(sawError ? 1 : 0);
    });
}

void Runner::writePdf(const std::function<void()>& next) {
    if (options.exportPdf.isEmpty()) {
        next();
        return;
    }
    QMetaObject::Connection* const connection = new QMetaObject::Connection;
    *connection = connect(this, &QWebEnginePage::pdfPrintingFinished, this,
            [this, next, connection](const QString& path, bool ok) {
        disconnect(*connection);
        delete connection;
        if (!ok) {
            err << "Cannot write '" << path << "'.\n";
            err.flush();
            sawError = true;
        }
        next();
    });
    printToPdf(options.exportPdf);
}

void Runner::javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level,
        const QString& message, int lineNumber, const QString& sourceID) {
    if (scriptMode) {
        err << message << "\n";
    } else {
        err << sourceID << ":" << lineNumber << " " << message << "\n";
    }
    err.flush();
    if (level == ErrorMessageLevel) {
        sawError = true;
        // A script that threw will never call "runtime.exit", so it is watched
        // from here on: it ends as soon as nothing is left to do, with the
        // code of a failure, rather than at the end of the time it is given.
        startWatching();
    }
}

void Runner::javaScriptAlert(const QUrl& /*securityOrigin*/,
        const QString& msg) {
    err << "ALERT: " << msg << "\n";
    err.flush();
}

bool Runner::javaScriptPrompt(const QUrl& /*securityOrigin*/,
        const QString& /*msg*/, const QString& /*defaultValue*/,
        QString* /*result*/) {
    return false;
}
