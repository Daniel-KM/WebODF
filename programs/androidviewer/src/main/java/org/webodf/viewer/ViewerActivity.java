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
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
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
 * Everything is served over "https://webodf.invalid/", by the asset loader:
 * a page loaded from "file://" may not read another file with XMLHttpRequest,
 * which is how the library reads a document.
 */
public class ViewerActivity extends Activity {

    private static final String DOMAIN = "webodf.invalid";
    private static final String CACHED = "document.odf";

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

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(DOMAIN)
                .addPathHandler("/assets/",
                        new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/cache/",
                        new WebViewAssetLoader.InternalStoragePathHandler(
                                this, getCacheDir()))
                .build();

        WebView view = new WebView(this);
        view.getSettings().setJavaScriptEnabled(true);
        view.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView webView, android.webkit.WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });
        setContentView(view);

        String page = "https://" + DOMAIN + "/assets/index.html";
        Intent intent = getIntent();
        Uri uri = (intent == null)
                ? null
                : intent.getData();
        if (uri != null && cache(uri)) {
            page += "?file=/cache/" + CACHED;
        }
        view.loadUrl(page);
    }
}
