package br.com.centralseries.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.*;
import android.widget.*;

public final class MainActivity extends Activity {
    private static final String HOST = "177-153-53-229.sslip.io";
    private static final String PANEL = "https://" + HOST + "/painel/";
    private static final int CHOOSE_IMAGE = 41;
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private ProgressBar progress;
    private static boolean isPanel(Uri u) {
        String path = u.getPath();
        return "https".equals(u.getScheme()) && HOST.equalsIgnoreCase(u.getHost()) &&
            (u.getPort() == -1 || u.getPort() == 443) && u.getUserInfo() == null &&
            path != null && (path.equals("/painel") || path.equals("/painel/"));
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(20,19,30));
        getWindow().setNavigationBarColor(Color.rgb(20,19,30));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(16,11,25));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return req.isForMainFrame() && !isPanel(req.getUrl());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError error){
                if(req.isForMainFrame()) offline();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse error){
                if(req.isForMainFrame()) offline();
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int n){
                progress.setProgress(n); progress.setVisibility(n==100?View.GONE:View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params){
                if(chooser!=null) chooser.onReceiveValue(null);
                chooser=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("image/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(intent,CHOOSE_IMAGE); }
                catch(ActivityNotFoundException e){ chooser.onReceiveValue(null); chooser=null; }
                return true;
            }
        });
        if(state==null || web.restoreState(state)==null) web.loadUrl(PANEL);
    }
    private void offline(){
        if(isFinishing()) return;
        new AlertDialog.Builder(this).setTitle("Central Séries")
            .setMessage("Não foi possível acessar o painel. Verifique a conexão e tente novamente.")
            .setPositiveButton("Tentar novamente",(d,w)->web.loadUrl(PANEL))
            .setNegativeButton("Fechar",(d,w)->finish()).show();
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==CHOOSE_IMAGE && chooser!=null){
            Uri uri=result==RESULT_OK&&data!=null?data.getData():null;
            chooser.onReceiveValue(uri==null?null:new Uri[]{uri});
            chooser=null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle state){
        web.saveState(state); super.onSaveInstanceState(state);
    }
    @Override protected void onPause(){ CookieManager.getInstance().flush(); super.onPause(); }
    @Override public void onBackPressed(){ if(web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy(){
        if(chooser!=null){chooser.onReceiveValue(null);chooser=null;}
        web.destroy();super.onDestroy();
    }
}
