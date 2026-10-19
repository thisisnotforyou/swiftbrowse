import 'dart:collection';

import 'package:adblocker_webview/adblocker_webview.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Implementation for [AdBlockerWebviewController]
class AdBlockerWebviewControllerImpl implements AdBlockerWebviewController {
  AdBlockerWebviewControllerImpl();

  WebViewController? _webViewController;
  final AdblockFilterManager _adBlockManager = AdblockFilterManager();
  final _allResourceRules = <ResourceRule>[];
  bool _isInitialized = false;

  /// Returns whether the controller has been initialized
  bool get isInitialized => _isInitialized;

  @override
  Future<void> initialize(FilterConfig filterConfig) async {
    await _adBlockManager.init(filterConfig);
    _allResourceRules
      ..clear()
      ..addAll(_adBlockManager.getAllResourceRules());
    _isInitialized = true;
  }

  @override
  UnmodifiableListView<ResourceRule> get allResourceRules =>
      UnmodifiableListView(_allResourceRules);

  @override
  void setInternalController(WebViewController controller) {
    _webViewController = controller;
  }

  @override
  Future<bool> canGoBack() async {
    final controller = _webViewController;
    if (controller == null) return false;
    return controller.canGoBack();
  }

  @override
  Future<bool> canGoForward() async {
    final controller = _webViewController;
    if (controller == null) return false;
    return controller.canGoForward();
  }

  @override
  Future<void> clearCache() async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.clearCache();
  }

  @override
  List<String> getCssRulesForWebsite(String url) =>
      _adBlockManager.getCSSRulesForWebsite(url);

  @override
  Future<String?> getTitle() async {
    final controller = _webViewController;
    if (controller == null) return null;
    return controller.getTitle();
  }

  @override
  Future<void> goBack() async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.goBack();
  }

  @override
  Future<void> goForward() async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.goForward();
  }

  @override
  Future<void> loadUrl(String url) async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.loadRequest(Uri.parse(url));
  }

  @override
  Future<void> loadData(String data, {String? baseUrl}) async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.loadHtmlString(data, baseUrl: baseUrl);
  }

  @override
  bool shouldBlockResource(String url) =>
      _adBlockManager.shouldBlockResource(url);

  @override
  Future<void> reload() async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.reload();
  }

  @override
  Future<void> stopLoading() async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.runJavaScript('window.stop();');
  }

  @override
  Future<void> runScript(String script) async {
    final controller = _webViewController;
    if (controller == null) return;
    return controller.runJavaScript(script);
  }

  @override
  Set<String> get allowedDomains => _adBlockManager.allowedDomains;

  @override
  void addAllowedDomain(String domain) =>
      _adBlockManager.addAllowedDomain(domain);

  @override
  bool removeAllowedDomain(String domain) =>
      _adBlockManager.removeAllowedDomain(domain);

  @override
  bool isAllowedDomain(String urlOrDomain) =>
      _adBlockManager.isAllowedDomain(urlOrDomain);

  @override
  Set<String> get blockedDomains => _adBlockManager.blockedDomains;

  @override
  void addBlockedDomain(String domain) =>
      _adBlockManager.addBlockedDomain(domain);

  @override
  bool removeBlockedDomain(String domain) =>
      _adBlockManager.removeBlockedDomain(domain);

  @override
  bool isBlockedDomain(String urlOrDomain) =>
      _adBlockManager.isBlockedDomain(urlOrDomain);

  // ===== Statistics Methods =====

  @override
  BlockingStatistics get statistics => _adBlockManager.statistics;

  @override
  void resetStatistics() => _adBlockManager.resetStatistics();

  /// Disposes the controller and releases resources
  Future<void> dispose() async {
    await _adBlockManager.dispose();
    _webViewController = null;
    _allResourceRules.clear();
    _isInitialized = false;
  }
}
