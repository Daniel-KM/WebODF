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

package org.webodf.viewer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Show a document in the OpenDocument format with WebODF, in a web view.
 *
 * The page and the library are read from the assets, and the document the
 * system hands over is copied into the directory of the cache, as it comes as
 * a "content://" uri that the web view may not read by itself.
 *
 * Everything is served over "https://webodf.invalid/", from the requests the
 * web view is intercepted on: a page loaded from "file://" may not read
 * another file with XMLHttpRequest, which is how the library reads a
 * document. Only the four files of the viewer and the one document are
 * served, so no name from a document may reach anything else.
 */
public class ViewerActivity extends Activity {

    private static final String DOMAIN = "webodf.invalid";
    private static final String PAGE = "https://" + DOMAIN + "/index.html";
    private static final String CACHED = "document.odf";
    private static final String[] FILES = {
        "index.html", "index.css", "index.js", "webodf.js",
        "about.en.html", "about.fr.html", "about.css"
    };
    /** The nine types of the format, as the picker only offers those. */
    private static final String[] TYPES = {
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.text-flat-xml",
        "application/vnd.oasis.opendocument.text-template",
        "application/vnd.oasis.opendocument.presentation",
        "application/vnd.oasis.opendocument.presentation-flat-xml",
        "application/vnd.oasis.opendocument.presentation-template",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
        "application/vnd.oasis.opendocument.spreadsheet-template"
    };
    private static final int PICK = 1;
    private static final String OPEN = "/open";

    private WebView view;

    /**
     * Whether a path is one of the files of the viewer.
     */
    private static boolean served(String path) {
        for (String file : FILES) {
            if (("/" + file).equals(path)) {
                return true;
            }
        }
        return false;
    }

    /**
     * The type of a file of the viewer, as the web view only reads a script
     * and a style sheet when they are served as such.
     */
    private static String typeOf(String name) {
        if (name.endsWith(".html")) {
            return "text/html";
        }
        if (name.endsWith(".js")) {
            return "application/javascript";
        }
        if (name.endsWith(".css")) {
            return "text/css";
        }
        return "application/octet-stream";
    }

    /**
     * Copy the document into the cache, so that it is served as a file of its
     * own.
     */
    private boolean cache(Uri uri) {
        File target = new File(getCacheDir(), CACHED);
        try (InputStream in = getContentResolver().openInputStream(uri);
                OutputStream out = new FileOutputStream(target)) {
            if (in == null) {
                return false;
            }
            byte[] buffer = new byte[16384];
            int read = in.read(buffer);
            while (read > 0) {
                out.write(buffer, 0, read);
                read = in.read(buffer);
            }
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * An empty answer, that the web view takes as the whole of a request: it
     * asks nothing from the network, where returning null would let it fetch
     * the address itself.
     */
    private static WebResourceResponse nothing() {
        return new WebResourceResponse("text/plain", "utf-8",
                new ByteArrayInputStream(new byte[0]));
    }

    /**
     * Answer a request of the page, and nothing else: the name is compared to
     * the files that are served, never used to build a path. Anything else is
     * answered with nothing at all, so that a document holding an image or a
     * style sheet of the web reaches no server: no request of this viewer ever
     * leaves the device.
     */
    private WebResourceResponse answer(Uri uri) {
        if (!DOMAIN.equals(uri.getHost())) {
            return nothing();
        }
        String path = uri.getPath();
        if (path == null) {
            return nothing();
        }
        try {
            if (("/" + CACHED).equals(path)) {
                return new WebResourceResponse("application/octet-stream", null,
                        new FileInputStream(new File(getCacheDir(), CACHED)));
            }
            for (String file : FILES) {
                if (("/" + file).equals(path)) {
                    return new WebResourceResponse(typeOf(file), "utf-8",
                            getAssets().open(file));
                }
            }
        } catch (IOException e) {
            return nothing();
        }
        return nothing();
    }

    /**
     * Whether the back of the system was answered here.
     *
     * The page of the details is left by the back of the system, that goes
     * back to the document; where there is nowhere to go back to, the system
     * is left to do what it does, which is to leave the viewer.
     */
    private boolean wentBack() {
        if (view != null && view.canGoBack()) {
            view.goBack();
            return true;
        }
        return false;
    }

    /**
     * The back of the system, on android 12 and older.
     *
     * Android 13 asks for a callback registered on the dispatcher, which is
     * what "onCreate" does where the system has one: this is answered by the
     * systems that have none, and by them alone.
     */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (wentBack()) {
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        view = new WebView(this);
        WebSettings settings = view.getSettings();
        // The library runs in the page, so scripts are needed. Everything
        // else a web view may reach is closed: the page reads no file and no
        // content provider, and it is never allowed to read the network, see
        // answer() above. The databases of a page are not closed, as the api
        // that did it is deprecated: the web view dropped WebSQL itself.
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setDomStorageEnabled(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // A page is drawn at the width of the screen at most, and a reader
        // zooms in on it with two fingers from there. The buttons the web view
        // draws for that are left out, as every phone pinches.
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView webView, WebResourceRequest request) {
                return answer(request.getUrl());
            }

            // The page asks for a document by going to "/open", which is
            // never loaded: the picker is opened instead. That spares the
            // page a bridge to the code around it.
            //
            // Nothing else is loaded either: a link a document holds leads
            // nowhere, as the viewer only ever shows the one page it carries.
            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView webView, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (OPEN.equals(uri.getPath())) {
                    pick();
                    return true;
                }
                // The page that tells what the viewer is belongs to it, and is
                // loaded as the first one was. A link it holds leads out, to
                // the browser of the system, that opens it: this viewer shows
                // documents, and never a page of the web.
                if (DOMAIN.equals(uri.getHost()) && served(uri.getPath())) {
                    return false;
                }
                if ("http".equals(uri.getScheme())
                        || "https".equals(uri.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                }
                return true;
            }
        });
        setContentView(view);

        // Android 13 does the back of the system by a callback registered on
        // a dispatcher, and calls "onBackPressed" no more: the callback is
        // registered where the system has one, and the older systems are
        // answered by "onBackPressed", which they still call. The viewer runs
        // on android 5 and newer, so both are needed.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                () -> {
                    if (!wentBack()) {
                        finish();
                    }
                });
        }

        Intent intent = getIntent();
        Uri uri = (intent == null)
                ? null
                : intent.getData();
        if (uri != null && cache(uri)) {
            view.loadUrl(PAGE + "?file=/" + CACHED);
            return;
        }
        // Started on its own rather than on a document: the page says how to
        // open one, and asks for it when it is touched. The picker is not
        // opened here, as an application that opens one before it is even
        // seen gives no way back.
        view.loadUrl(PAGE);
    }

    /**
     * @param action ACTION_OPEN_DOCUMENT or ACTION_GET_CONTENT
     */
    private Intent asking(String action) {
        Intent intent = new Intent(action);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, TYPES);
        return intent;
    }

    /**
     * Ask the system for a document, so that the viewer opens one when it is
     * started from the list of the applications, and not only when a document
     * is handed to it. The system reads the file, so the viewer needs no
     * permission to reach the storage.
     *
     * Two ways of asking are tried, as a system may carry neither: the picker
     * of the documents, that a system without it answers nothing to, then the
     * older way, that a file manager usually answers. The viewer says so
     * rather than stopping when no application answers either.
     */
    private void pick() {
        try {
            startActivityForResult(asking(Intent.ACTION_OPEN_DOCUMENT), PICK);
            return;
        } catch (ActivityNotFoundException e) {
            // The picker of the documents is not there: ask any application.
        }
        try {
            startActivityForResult(asking(Intent.ACTION_GET_CONTENT), PICK);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_picker, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = (data == null)
                ? null
                : data.getData();
        if (request == PICK && result == RESULT_OK && uri != null && cache(uri)) {
            view.loadUrl(PAGE + "?file=/" + CACHED);
        }
    }
}
