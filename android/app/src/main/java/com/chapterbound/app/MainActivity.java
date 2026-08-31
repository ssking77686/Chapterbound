package com.chapterbound.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Android WebView 不向 CSS 提供 env(safe-area-inset-*)，edge-to-edge 下顶部工具栏
     * 会落入状态栏/刘海防误触区。这里读取真实的系统栏+刘海高度，注入为 CSS 变量
     * --safe-top，让工具栏下移到书页上边界（状态栏之下）。
     */
    private void injectSafeAreaTop() {
        final View decor = getWindow().getDecorView();
        final WebView webView = getBridge().getWebView();
        final Runnable task = new Runnable() {
            @Override
            public void run() {
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
                if (insets == null) {
                    webView.postDelayed(this, 200);
                    return;
                }
                Insets sb = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                int top = sb.top;
                // 注入到 <html>：值 + 成功标记（标记让 CSS 的触屏保底失效，避免双重下移）。
                // 仅取 statusBars（竖屏刘海已含在状态栏高度内），不取 cutout 取大——防止下移过头。
                String js = "!!document.documentElement&&("
                        + "document.documentElement.setAttribute('data-safe-top-injected','1'),"
                        + "document.documentElement.style.setProperty('--safe-top','" + top + "px'),true)";
                webView.evaluateJavascript(js, value -> {
                    if (!"true".equals(value)) {
                        webView.postDelayed(this, 300);
                    }
                });
            }
        };
        webView.postDelayed(task, 200);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injectSafeAreaTop();
    }
}
