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
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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
        "index.html", "index.css", "index.js", "webodf.js"
    };

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
     * Answer a request of the page, and nothing else: the name is compared to
     * the files that are served, never used to build a path.
     */
    private WebResourceResponse answer(Uri uri) {
        if (!DOMAIN.equals(uri.getHost())) {
            return null;
        }
        String name = uri.getLastPathSegment();
        if (name == null) {
            return null;
        }
        try {
            if (("/" + CACHED).equals(uri.getPath())) {
                return new WebResourceResponse(typeOf(name), null,
                        new FileInputStream(new File(getCacheDir(), CACHED)));
            }
            for (String served : FILES) {
                if (served.equals(name) && ("/" + served).equals(uri.getPath())) {
                    return new WebResourceResponse(typeOf(name), "utf-8",
                            getAssets().open(served));
                }
            }
        } catch (IOException e) {
            return null;
        }
        return null;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        WebView view = new WebView(this);
        view.getSettings().setJavaScriptEnabled(true);
        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView webView, WebResourceRequest request) {
                return answer(request.getUrl());
            }
        });
        setContentView(view);

        String page = PAGE;
        Intent intent = getIntent();
        Uri uri = (intent == null)
                ? null
                : intent.getData();
        if (uri != null && cache(uri)) {
            page += "?file=/" + CACHED;
        }
        view.loadUrl(page);
    }
}
