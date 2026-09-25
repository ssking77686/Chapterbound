package com.chapterbound.app;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * 把系统安全区注入成 CSS 变量（--safe-top / --safe-bottom / --safe-left / --safe-right）。
     *
     * 为什么需要：Android WebView 的 CSS env(safe-area-inset-*) 恒为 0，edge-to-edge 下
     * 内容会铺进状态栏 / 刘海 / 手势条。
     *
     * 三个易错点：
     * 1) 单位。WindowInsetsCompat.getInsets() 返回【物理像素】，而 WebView 里 1 CSS px = 1 dp，
     *    注入前必须 ÷ density。漏掉这步会让 --safe-top 被放大 density 倍（2.0~3.5），
     *    顶栏会被压下去几十像素。
     * 2) 只读 statusBars().top 不够。横屏时刘海跑到左右两侧（displayCutout），底部手势条在
     *    navigationBars()。顶部仍只取 statusBars —— 竖屏刘海已含在状态栏高度内，若对 cutout
     *    取大会下移过头（历史 bug，勿改）。
     * 3) 旋转 / 折叠 / 分屏不会重建 Activity（AndroidManifest 声明了 configChanges），
     *    值会一直停在旧方向，必须在 onConfigurationChanged 里重新注入。
     */
    private void injectSafeArea() {
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
                float density = webView.getResources().getDisplayMetrics().density;
                if (density <= 0f) {
                    density = 1f;
                }
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());

                int top = Math.round(bars.top / density);
                int bottom = Math.round(nav.bottom / density);
                int left = Math.round(cut.left / density);
                int right = Math.round(cut.right / density);

                // 四个值与成功标记必须一次写完：标记是「已注入」的开关，CSS 的触屏保底靠它失效。
                // 历史上标记只管顶部，却连带关掉了 --safe-bottom 的保底，导致底部恒为 0。
                String js = "!!document.documentElement&&("
                        + "document.documentElement.style.setProperty('--safe-top','" + top + "px'),"
                        + "document.documentElement.style.setProperty('--safe-bottom','" + bottom + "px'),"
                        + "document.documentElement.style.setProperty('--safe-left','" + left + "px'),"
                        + "document.documentElement.style.setProperty('--safe-right','" + right + "px'),"
                        + "document.documentElement.setAttribute('data-safe-top-injected','1'),true)";
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
        injectSafeArea();
    }

    /** 旋转 / 折叠 / 分屏：Activity 不重建，必须重新注入，否则沿用旧方向的值 */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        injectSafeArea();
    }
}
