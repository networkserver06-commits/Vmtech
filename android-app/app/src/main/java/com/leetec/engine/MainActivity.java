package com.leetec.engine;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://leetec.online/";
    private static final String TRUSTED_HOST = "leetec.online";
    private WebView webView;
    private ProgressBar progressBar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(8, 18, 23));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(8, 18, 23));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(8, 18, 23));
        Window window = getWindow();
        window.getDecorView().setSystemUiVisibility(0);

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressDrawable(getDrawable(android.R.drawable.progress_horizontal));
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(-1, 5);
        root.addView(progressBar, progressParams);
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " LeeTecEngineAndroid/1.1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);
        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                view.requestFocus(View.FOCUS_DOWN);
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) { }
            }
        });

        if (savedInstanceState == null) webView.loadUrl(HOME_URL); else webView.restoreState(savedInstanceState);
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        boolean isWeb = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        boolean isTrusted = TRUSTED_HOST.equalsIgnoreCase(host) || (host != null && host.endsWith("." + TRUSTED_HOST));
        if (isWeb && isTrusted) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
        return true;
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
