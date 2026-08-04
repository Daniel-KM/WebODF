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

#ifndef RUNNER_H
#define RUNNER_H

#include <QStringList>
#include <QTextStream>
#include <QWebEnginePage>

#include <functional>

class NativeIO;
class QTemporaryFile;
class QWebEngineView;

/**
 * What was asked on the command line.
 */
struct Options {
    /** The file the page is printed into, if any. */
    QString exportPdf;
    /** How long the program may run, in seconds; 0 for as long as it takes. */
    int timeout = 600;
    /** The script or the page, then the arguments of the script. */
    QStringList arguments;
};

/**
 * Load a script or a page, and end when it is done.
 *
 * A file that ends in ".js" is a script: a page is made that loads the runtime
 * of the library and hands the script to it, the way node does. Anything else
 * is a page, loaded as it is. In both cases the program ends when the script
 * calls "runtime.exit", or, when a file is to be written, once the page has
 * stopped changing.
 */
class Runner : public QWebEnginePage {
    Q_OBJECT
public:
    Runner(const Options& options);
    ~Runner() override;

protected:
    void javaScriptConsoleMessage(JavaScriptConsoleMessageLevel level,
                                  const QString& message, int lineNumber,
                                  const QString& sourceID) override;
    void javaScriptAlert(const QUrl& securityOrigin,
                         const QString& msg) override;
    bool javaScriptPrompt(const QUrl& securityOrigin, const QString& msg,
                          const QString& defaultValue,
                          QString* result) override;

private slots:
    void loaded(bool ok);
    /** Ask the page whether it is still doing something. */
    void pollIdle();

private:
    /** Load the script through a page that gives it the runtime. */
    void loadScript();
    /** Load the page named on the command line, as it is. */
    void loadPage();
    /** Watch the page until it stops doing anything, then end. */
    void startWatching();
    /** Write the file that was asked for, then end. */
    void writeExports();
    void writePdf(const std::function<void()>& next);

    const Options options;
    const bool scriptMode;
    QTextStream err;
    NativeIO* nativeio;
    QWebEngineView* view;
    QTemporaryFile* bootstrap;
    /** How many times in a row the page answered that it had nothing to do. */
    int quietRounds;
    bool watching;
    bool sawError;
};

#endif
