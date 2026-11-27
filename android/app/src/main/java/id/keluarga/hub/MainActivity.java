package id.keluarga.hub;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    // Ganti dengan alamat server Keluarga Hub di jaringan rumah (lihat URL LAN
    // yang dicetak server saat start).
    private static final String SERVER_URL = "http://192.168.1.100:3000/";
    private static final int PICK_FILE = 100;
    private static final String ERROR_HTML =
        "<html><body style='font-family:sans-serif;background:#0b1020;color:#fff;display:flex;"
        + "align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center'>"
        + "<h2>Server tidak terjangkau</h2><p>Pastikan ponsel terhubung ke WiFi rumah "
        + "dan server Keluarga Hub menyala.</p><a href='@URL@' style='color:#8b5cf6'>Coba lagi</a>"
        + "</div></body></html>";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                view.loadDataWithBaseURL(null, ERROR_HTML.replace("@URL@", SERVER_URL), "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("*/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(Intent.createChooser(intent, "Pilih foto/video"), PICK_FILE);
                return true;
            }
        });
        web.loadUrl(SERVER_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] result = (resultCode == RESULT_OK && data != null && data.getData() != null)
                ? new Uri[] { data.getData() } : null;
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
