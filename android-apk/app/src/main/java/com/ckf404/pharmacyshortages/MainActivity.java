package com.ckf404.pharmacyshortages;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://pharmashrt-lxbcyjhj.manus.space/?app=1.3.2";
    private static final int CACHE_RESET_VERSION = 7;
    private static final int DEEP_TEAL = Color.rgb(17, 52, 64);
    private WebView webView;
    private ProgressBar progressBar;
    private View errorPanel;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DEEP_TEAL);
        getWindow().setNavigationBarColor(DEEP_TEAL);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(DEEP_TEAL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                view.setPadding(0, bars.top, 0, bars.bottom);
                return windowInsets;
            });
        } else {
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                view.setPadding(0, windowInsets.getSystemWindowInsetTop(), 0, windowInsets.getSystemWindowInsetBottom());
                return windowInsets;
            });
        }
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
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.getSettings().setSupportMultipleWindows(false);
        int lastCacheReset = getSharedPreferences("pharmacy_shortages", MODE_PRIVATE).getInt("cache_reset_version", 0);
        if (lastCacheReset < CACHE_RESET_VERSION) {
            webView.clearCache(true);
            getSharedPreferences("pharmacy_shortages", MODE_PRIVATE).edit().putInt("cache_reset_version", CACHE_RESET_VERSION).apply();
        }
        webView.addJavascriptInterface(new PharmacyAndroidBridge(), "PharmacyAndroid");
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
                if (isWhatsAppLink(uri)) return openWhatsApp(uri);
                if ("intent".equals(uri.getScheme())) {
                    try {
                        startActivity(Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME));
                        return true;
                    } catch (Exception ignored) {
                        return true;
                    }
                }
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) root.requestApplyInsets();
        loadApp();
    }

    private boolean isWhatsAppLink(Uri uri) {
        String host = uri.getHost();
        return "whatsapp".equalsIgnoreCase(uri.getScheme())
                || "wa.me".equalsIgnoreCase(host)
                || "api.whatsapp.com".equalsIgnoreCase(host)
                || "web.whatsapp.com".equalsIgnoreCase(host);
    }

    private boolean openWhatsApp(Uri uri) {
        Uri nativeUri = toNativeWhatsAppUri(uri);
        Intent whatsapp = new Intent(Intent.ACTION_VIEW, nativeUri);
        whatsapp.setPackage("com.whatsapp");
        try {
            startActivity(whatsapp);
        } catch (ActivityNotFoundException notInstalled) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                // The link is intentionally consumed here so the WebView never replaces the pharmacy screen.
            }
        }
        return true;
    }

    private Uri toNativeWhatsAppUri(Uri source) {
        if ("whatsapp".equalsIgnoreCase(source.getScheme())) return source;
        String phone = source.getQueryParameter("phone");
        if (phone == null || phone.isEmpty()) {
            java.util.List<String> segments = source.getPathSegments();
            phone = segments.isEmpty() ? "" : segments.get(0);
        }
        String text = source.getQueryParameter("text");
        Uri.Builder nativeLink = new Uri.Builder().scheme("whatsapp").authority("send");
        if (!phone.isEmpty()) nativeLink.appendQueryParameter("phone", phone.replaceAll("\\D", ""));
        if (text != null && !text.isEmpty()) nativeLink.appendQueryParameter("text", text);
        return nativeLink.build();
    }

    private boolean isTrustedAppPage() {
        String currentUrl = webView == null ? null : webView.getUrl();
        if (currentUrl == null) return false;
        String host = Uri.parse(currentUrl).getHost();
        return host != null && host.endsWith("manus.space");
    }

    private final class PharmacyAndroidBridge {
        @JavascriptInterface
        public void openWhatsApp(String rawUrl) {
            if (rawUrl == null) return;
            final Uri uri = Uri.parse(rawUrl);
            runOnUiThread(() -> {
                if (isTrustedAppPage() && isWhatsAppLink(uri)) MainActivity.this.openWhatsApp(uri);
            });
        }
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
