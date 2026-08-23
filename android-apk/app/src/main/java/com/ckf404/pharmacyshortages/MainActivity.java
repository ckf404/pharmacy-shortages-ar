package com.ckf404.pharmacyshortages;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://pharmashrt-lxbcyjhj.manus.space/";
    private static final int DEEP_TEAL = Color.rgb(17, 52, 64);
    private WebView webView;
    private ProgressBar progressBar;
    private View errorPanel;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(DEEP_TEAL);
        webView = new WebView(this);
        webView.setBackgroundColor(DEEP_TEAL);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(true);
        progressBar.setVisibility(View.VISIBLE);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP
        );
        root.addView(progressBar, progressParams);

        errorPanel = buildErrorPanel();
        root.addView(errorPanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setLoadWithOverviewMode(true);
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setSupportMultipleWindows(false);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setVisibility(progress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.endsWith("manus.space")) return false;
                return !"https".equals(uri.getScheme());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showNetworkError();
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showNetworkError();
            }
        });

        setContentView(root);
        loadApp();
    }

    private View buildErrorPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(DEEP_TEAL);
        panel.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("تعذر فتح النظام");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, 1);
        panel.addView(title);

        TextView explanation = new TextView(this);
        explanation.setText("تحقق من اتصال الإنترنت ثم أعد المحاولة.");
        explanation.setTextColor(Color.rgb(203, 213, 225));
        explanation.setTextSize(15);
        explanation.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        textParams.topMargin = dp(12);
        panel.addView(explanation, textParams);

        Button retry = new Button(this);
        retry.setText("إعادة المحاولة");
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(15);
        retry.setBackgroundColor(Color.rgb(13, 148, 136));
        retry.setOnClickListener(view -> loadApp());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.gravity = Gravity.CENTER_HORIZONTAL;
        buttonParams.topMargin = dp(22);
        panel.addView(retry, buttonParams);
        return panel;
    }

    private void loadApp() {
        errorPanel.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);
        webView.loadUrl(APP_URL);
    }

    private void showNetworkError() {
        progressBar.setVisibility(View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
        }
        super.onDestroy();
    }
}
