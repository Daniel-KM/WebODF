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

import UIKit
import UniformTypeIdentifiers
import WebKit

/// Show a document of the OpenDocument format with WebODF, in a web view.
///
/// The page and the library are read from the resources of the application,
/// and the document the system hands over is copied beside them, as it comes
/// from a place the application may only read while it is being handed the
/// file.
///
/// Everything is served under "odf://viewer/", by a handler of that scheme:
/// a page loaded from a file may not read another file with XMLHttpRequest,
/// which is how the library reads a document, whereas everything served here
/// is of one origin. Only the files of the viewer and the one document are
/// served, so no name a document holds may reach anything else.
///
/// It is the shell that Android has, in the words of another system: the page,
/// the library and the behaviour are the same, see "ViewerActivity.java".
final class ViewerController: UIViewController {

    /// The files of the viewer, served under their own name and no other.
    private static let files = [
        "index.html", "index.css", "index.js", "webodf.js",
        "about.en.html", "about.fr.html", "about.css"
    ]

    /// The name the document is served under, whichever file it is.
    private static let document = "document.odf"

    /// The nine types of the format, as the picker only offers those.
    private static let types = [
        "org.oasis-open.opendocument.text",
        "org.oasis-open.opendocument.text-template",
        "org.oasis-open.opendocument.text-flat-xml",
        "org.oasis-open.opendocument.presentation",
        "org.oasis-open.opendocument.presentation-template",
        "org.oasis-open.opendocument.presentation-flat-xml",
        "org.oasis-open.opendocument.spreadsheet",
        "org.oasis-open.opendocument.spreadsheet-template",
        "org.oasis-open.opendocument.spreadsheet-flat-xml"
    ].compactMap { UTType($0) }

    private var web: WKWebView!

    /// Where the document that is open is kept, beside the caches.
    private var cached: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(ViewerController.document)
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let settings = WKWebViewConfiguration()
        settings.setURLSchemeHandler(ViewerScheme(controller: self),
                                     forURLScheme: "odf")
        // A document is read, never typed in, so nothing of the page is kept
        // between two runs.
        settings.websiteDataStore = .nonPersistent()

        web = WKWebView(frame: .zero, configuration: settings)
        web.navigationDelegate = self
        // The page that tells what the viewer is is left by the gesture of the
        // system, as there is no bar to hold a button.
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        show(document: nil)
    }

    /// Draw a document, or the page that asks for one when there is none.
    func show(document: URL?) {
        guard let page = URL(string: "odf://viewer/index.html") else {
            return
        }
        if let document, keep(document) {
            web.load(URLRequest(url: URL(
                string: "odf://viewer/index.html?file=/"
                    + ViewerController.document) ?? page))
            return
        }
        web.load(URLRequest(url: page))
    }

    /// Copy the document that was handed over, so that it is read from a place
    /// of the application: the system only lends the file it gives.
    private func keep(_ document: URL) -> Bool {
        let reached = document.startAccessingSecurityScopedResource()
        defer {
            if reached {
                document.stopAccessingSecurityScopedResource()
            }
        }
        do {
            let bytes = try Data(contentsOf: document)
            try bytes.write(to: cached, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    /// Ask the system for a document. The system reads the file and hands it
    /// over, so the viewer holds no permission of its own.
    func pick() {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: ViewerController.types)
        picker.delegate = self
        present(picker, animated: true)
    }

    /// Answer a request of the page, and nothing else: the name is compared to
    /// the files that are served, never used to build a path.
    func answer(_ url: URL) -> (Data, String)? {
        let name = String(url.path.dropFirst())
        if name == ViewerController.document {
            guard let bytes = try? Data(contentsOf: cached) else {
                return nil
            }
            return (bytes, "application/octet-stream")
        }
        guard ViewerController.files.contains(name),
              let file = Bundle.main.url(forResource: name,
                                         withExtension: nil),
              let bytes = try? Data(contentsOf: file) else {
            return nil
        }
        return (bytes, ViewerController.type(of: name))
    }

    /// The type of a file of the viewer, as a web view only reads a script and
    /// a style sheet when they are served as such.
    private static func type(of name: String) -> String {
        if name.hasSuffix(".html") {
            return "text/html"
        }
        if name.hasSuffix(".js") {
            return "text/javascript"
        }
        if name.hasSuffix(".css") {
            return "text/css"
        }
        return "application/octet-stream"
    }
}

extension ViewerController: WKNavigationDelegate {

    /// The page asks for a document by going to "/open", which is never
    /// loaded: the picker is opened instead. That spares the page a bridge to
    /// the code around it, as it does on Android.
    ///
    /// A link that leaves the viewer is handed to the browser of the system:
    /// this viewer shows documents, and never a page of the web.
    func webView(_ webView: WKWebView,
                 decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == "odf" {
            if url.path == "/open" {
                decisionHandler(.cancel)
                pick()
                return
            }
            decisionHandler(.allow)
            return
        }
        if url.scheme == "http" || url.scheme == "https" {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }
}

extension ViewerController: UIDocumentPickerDelegate {

    func documentPicker(_ picker: UIDocumentPickerViewController,
                        didPickDocumentsAt urls: [URL]) {
        if let first = urls.first {
            show(document: first)
        }
    }
}

/// Serve the files of the viewer and the document that is open, and nothing
/// else. It is what "shouldInterceptRequest" does on Android.
final class ViewerScheme: NSObject, WKURLSchemeHandler {

    private weak var controller: ViewerController?

    init(controller: ViewerController) {
        self.controller = controller
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == "viewer",
              let (bytes, type) = controller?.answer(url) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        task.didReceive(URLResponse(url: url, mimeType: type,
                                    expectedContentLength: bytes.count,
                                    textEncodingName: "utf-8"))
        task.didReceive(bytes)
        task.didFinish()
    }

    /// A request of this scheme is answered at once, so there is nothing to
    /// stop.
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
    }
}
