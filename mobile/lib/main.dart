import 'dart:async';
import 'dart:io';

import 'package:adblocker_webview/adblocker_webview.dart';
import 'package:background_downloader/background_downloader.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FileDownloader().start(autoCleanDatabase: true);
  runApp(const SwiftBrowseMobileApp());
}

const _homeHtml = '''
<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#101521;color:#edf0f8;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;min-height:100vh;place-items:center}
main{text-align:center;padding:28px}h1{font-size:38px;letter-spacing:-2px;margin:0 0 10px}p{color:#9ca9bd;margin:0}
.mark{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 18px;border-radius:20px;background:linear-gradient(145deg,#c09cff,#7560d2);color:#1b1231;font-size:34px;font-weight:800}
</style></head><body><main><div class="mark">S</div><h1>SwiftBrowse</h1><p>Fast browsing. Fewer trackers.</p></main></body></html>
''';

class SwiftBrowseMobileApp extends StatelessWidget {
  const SwiftBrowseMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    const background = Color(0xFF101521);
    return MaterialApp(
      title: 'SwiftBrowse',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFAA8AFF),
          brightness: Brightness.dark,
          surface: const Color(0xFF171E2B),
        ),
        scaffoldBackgroundColor: background,
        useMaterial3: true,
      ),
      home: const BrowserScreen(),
    );
  }
}

class BrowserTab {
  factory BrowserTab(int id) {
    final controller = AdBlockerWebviewControllerImpl();
    final ready = controller.initialize(
          FilterConfig(filterTypes: [FilterType.easyList, FilterType.adGuard]),
        );
    return BrowserTab._(id, controller, ready);
  }

  BrowserTab._(this.id, this.controller, this.ready);

  final int id;
  final AdBlockerWebviewControllerImpl controller;
  final Future<void> ready;
  String url = '';
  String title = 'New tab';
  int progress = 0;
  String? error;
}

class BrowserDownload {
  BrowserDownload(this.task, this.url);

  final DownloadTask task;
  final String url;
  double progress = 0;
  TaskStatus status = TaskStatus.enqueued;
  String? savedPath;
  String? error;

  String get name {
    final path = savedPath ?? task.filename;
    if (path.isEmpty || path == '?') return Uri.tryParse(url)?.host ?? url;
    return path.split(Platform.pathSeparator).last;
  }
}

class BrowserScreen extends StatefulWidget {
  const BrowserScreen({super.key});

  @override
  State<BrowserScreen> createState() => _BrowserScreenState();
}

class _BrowserScreenState extends State<BrowserScreen> {
  final _address = TextEditingController();
  final _tabs = <BrowserTab>[];
  final _downloads = <BrowserDownload>[];
  final _downloadsNotifier = ValueNotifier<List<BrowserDownload>>([]);
  int _activeIndex = 0;
  int _nextTabId = 1;

  BrowserTab? get _active =>
      _tabs.isEmpty ? null : _tabs[_activeIndex];

  @override
  void initState() {
    super.initState();
    _addTab();
  }

  @override
  void dispose() {
    _address.dispose();
    _downloadsNotifier.dispose();
    for (final tab in _tabs) {
      unawaited(_disposeTab(tab));
    }
    super.dispose();
  }

  void _addTab() {
    final tab = BrowserTab(_nextTabId++);
    setState(() {
      _tabs.add(tab);
      _activeIndex = _tabs.length - 1;
      _address.clear();
    });
  }

  void _closeTab(BrowserTab tab) {
    if (_tabs.length == 1) {
      _goHome();
      return;
    }
    final index = _tabs.indexOf(tab);
    if (index < 0) return;
    final wasActive = index == _activeIndex;
    setState(() {
      _tabs.removeAt(index);
      if (wasActive) {
        _activeIndex = index < _tabs.length ? index : _tabs.length - 1;
      } else if (index < _activeIndex) {
        _activeIndex--;
      }
      _syncAddress();
    });
    unawaited(_disposeTab(tab));
  }

  Future<void> _disposeTab(BrowserTab tab) async {
    try {
      await tab.ready;
      await tab.controller.dispose();
    } catch (_) {
      // Failed filter initialization has no live WebView resources to dispose.
    }
  }

  void _activateTab(int index) {
    setState(() {
      _activeIndex = index;
      _syncAddress();
    });
    Navigator.pop(context);
  }

  void _syncAddress() {
    _address.text = _active?.url ?? '';
  }

  String _resolveAddress(String raw) {
    final value = raw.trim();
    final parsed = Uri.tryParse(value);
    if (parsed != null && (parsed.scheme == 'http' || parsed.scheme == 'https')) {
      return parsed.toString();
    }
    if (value.contains('.') && !value.contains(RegExp(r'\s'))) {
      return 'https://$value';
    }
    return 'https://www.google.com/search?q=${Uri.encodeQueryComponent(value)}';
  }

  Future<void> _navigate(String raw) async {
    final tab = _active;
    final value = raw.trim();
    if (tab == null || value.isEmpty) return;
    final url = _resolveAddress(value);
    FocusScope.of(context).unfocus();
    setState(() {
      tab.url = url;
      tab.title = url;
      tab.progress = 0;
      tab.error = null;
    });
    try {
      await tab.ready;
      if (!mounted || !_tabs.contains(tab)) return;
      await tab.controller.loadUrl(url);
    } catch (error) {
      if (mounted) setState(() => tab.error = 'Ad filters could not load: $error');
    }
  }

  Future<void> _goHome() async {
    final tab = _active;
    if (tab == null) return;
    setState(() {
      tab.url = '';
      tab.title = 'New tab';
      tab.error = null;
      tab.progress = 100;
      _address.clear();
    });
    try {
      await tab.ready;
      if (!mounted || !_tabs.contains(tab)) return;
      await tab.controller.loadData(_homeHtml);
    } catch (error) {
      if (mounted) setState(() => tab.error = 'Ad filters could not load: $error');
    }
  }

  Future<void> _goBack() async {
    final tab = _active;
    if (tab != null && await tab.controller.canGoBack()) {
      await tab.controller.goBack();
    }
  }

  Future<void> _goForward() async {
    final tab = _active;
    if (tab != null && await tab.controller.canGoForward()) {
      await tab.controller.goForward();
    }
  }

  Future<void> _showTabs() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text('${_tabs.length} tabs'),
              trailing: IconButton(
                tooltip: 'New tab',
                onPressed: () {
                  Navigator.pop(context);
                  _addTab();
                },
                icon: const Icon(Icons.add),
              ),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _tabs.length,
                itemBuilder: (context, index) {
                  final tab = _tabs[index];
                  return ListTile(
                    selected: index == _activeIndex,
                    leading: const Icon(Icons.public),
                    title: Text(tab.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(tab.url.isEmpty ? 'Start page' : tab.url,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    trailing: IconButton(
                      tooltip: 'Close tab',
                      onPressed: () {
                        Navigator.pop(context);
                        _closeTab(tab);
                      },
                      icon: const Icon(Icons.close),
                    ),
                    onTap: () => _activateTab(index),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isDownloadUrl(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) return false;
    final path = uri.path.toLowerCase();
    const extensions = {
      '.apk', '.bin', '.csv', '.doc', '.docx', '.dmg', '.epub', '.exe',
      '.gif', '.gz', '.jpeg', '.jpg', '.json', '.m4a', '.mkv', '.mov',
      '.mp3', '.mp4', '.msi', '.pdf', '.png', '.ppt', '.pptx', '.rar',
      '.tar', '.txt', '.webm', '.xls', '.xlsx', '.zip',
    };
    return extensions.any(path.endsWith) ||
        uri.queryParameters.containsKey('download');
  }

  Future<void> _startDownload(String raw) async {
    final uri = Uri.tryParse(raw);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) return;
    Map<String, String> headers = const {};
    try {
      final cookies = await WebViewCookieManager().getCookies(domain: uri);
      if (cookies.isNotEmpty) {
        headers = {
          'Cookie': cookies.map((cookie) => '${cookie.name}=${cookie.value}').join('; '),
        };
      }
    } catch (_) {
      // Public downloads still work when the platform does not expose cookies.
    }
    if (!mounted) return;
    final task = DownloadTask(
      url: uri.toString(),
      filename: '?',
      directory: 'Downloads',
      baseDirectory: BaseDirectory.applicationDocuments,
      allowPause: true,
      headers: headers,
    );
    final entry = BrowserDownload(task, uri.toString());
    setState(() => _downloads.insert(0, entry));
    _publishDownloads();
    try {
      final result = await FileDownloader().download(
        task,
        onStatus: (status) {
          entry.status = status;
          _publishDownloads();
        },
        onProgress: (progress) {
          entry.progress = progress;
          _publishDownloads();
        },
      );
      entry.status = result.status;
      if (result.status == TaskStatus.complete) {
        final sharedPath = await FileDownloader().moveToSharedStorage(
          task,
          SharedStorage.downloads,
        );
        entry.savedPath = sharedPath ?? await task.filePath();
      } else {
        entry.error = result.exception?.description ?? result.status.name;
      }
    } catch (error) {
      entry.status = TaskStatus.failed;
      entry.error = error.toString();
    }
    _publishDownloads();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(entry.status == TaskStatus.complete
              ? 'Downloaded ${entry.name}'
              : 'Download failed: ${entry.error}'),
        ),
      );
    }
  }

  void _publishDownloads() {
    if (!mounted) return;
    _downloadsNotifier.value = List.unmodifiable(_downloads);
  }

  Future<void> _openDownload(BrowserDownload download) async {
    if (download.status != TaskStatus.complete) return;
    final opened = await FileDownloader().openFile(
      filePath: download.savedPath ?? await download.task.filePath(),
    );
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No app found to open this file.')),
      );
    }
  }

  Future<void> _showDownloads() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.65,
          child: Column(
            children: [
              const ListTile(title: Text('Downloads')),
              Expanded(
                child: ValueListenableBuilder<List<BrowserDownload>>(
                  valueListenable: _downloadsNotifier,
                  builder: (context, downloads, _) {
                    if (downloads.isEmpty) {
                      return const Center(child: Text('Downloads will appear here.'));
                    }
                    return ListView.builder(
                      itemCount: downloads.length,
                      itemBuilder: (context, index) {
                        final download = downloads[index];
                        final complete = download.status == TaskStatus.complete;
                        final running = !download.status.isFinalState;
                        return ListTile(
                          leading: Icon(complete ? Icons.check_circle_outline : Icons.download_outlined),
                          title: Text(download.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: running
                              ? LinearProgressIndicator(value: download.progress > 0 ? download.progress : null)
                              : Text(download.error ?? download.status.name),
                          onTap: complete ? () => _openDownload(download) : null,
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showProtectionInfo() {
    final count = _active?.controller.statistics.blockedResourceCount ?? 0;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.shield_outlined, color: Color(0xFF72DFBB)),
        title: const Text('Ad blocking is on'),
        content: Text('$count ad or tracker requests blocked in this tab.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final active = _active;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _address,
                      autocorrect: false,
                      enableSuggestions: false,
                      keyboardType: TextInputType.url,
                      textInputAction: TextInputAction.go,
                      onSubmitted: _navigate,
                      decoration: InputDecoration(
                        hintText: 'Search or enter address',
                        prefixIcon: Icon(
                          active?.url.startsWith('https://') == true
                              ? Icons.lock_outline
                              : Icons.search,
                          size: 19,
                        ),
                        filled: true,
                        fillColor: const Color(0xFF1A2330),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(15),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 5),
                  IconButton(
                    tooltip: 'Ad and tracker blocking',
                    onPressed: _showProtectionInfo,
                    color: const Color(0xFF72DFBB),
                    icon: Badge(
                      label: Text('${_active?.controller.statistics.blockedResourceCount ?? 0}'),
                      isLabelVisible: (_active?.controller.statistics.blockedResourceCount ?? 0) > 0,
                      child: const Icon(Icons.shield_outlined),
                    ),
                  ),
                ],
              ),
            ),
            if (active != null && active.progress < 100 && active.progress > 0)
              LinearProgressIndicator(value: active.progress / 100),
            Expanded(
              child: IndexedStack(
                index: _activeIndex,
                children: [
                  for (final tab in _tabs)
                    FutureBuilder<void>(
                      future: tab.ready,
                      builder: (context, snapshot) {
                        if (snapshot.hasError) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text('Could not load ad filters. Check your connection and restart SwiftBrowse.\n\n${snapshot.error}', textAlign: TextAlign.center),
                            ),
                          );
                        }
                        if (snapshot.connectionState != ConnectionState.done) {
                          return const Center(child: CircularProgressIndicator());
                        }
                        return AdBlockerWebview(
                          key: ValueKey('webview-${tab.id}'),
                          url: tab.url.isEmpty ? null : Uri.parse(tab.url),
                          initialHtmlData: tab.url.isEmpty ? _homeHtml : null,
                          shouldBlockAds: true,
                          shouldDownloadUrl: _isDownloadUrl,
                          onDownloadStart: _startDownload,
                          adBlockerWebviewController: tab.controller,
                          onLoadStart: (url) {
                            setState(() {
                              tab.progress = 1;
                              tab.error = null;
                              if (url != null && url.startsWith('http')) tab.url = url;
                              if (identical(tab, _active)) _syncAddress();
                            });
                          },
                          onLoadFinished: (url) async {
                            final title = await tab.controller.getTitle();
                            if (!mounted) return;
                            setState(() {
                              tab.progress = 100;
                              tab.title = title?.trim().isNotEmpty == true ? title! : (url ?? tab.url);
                              if (url != null && url.startsWith('http')) tab.url = url;
                              if (identical(tab, _active)) _syncAddress();
                            });
                          },
                          onProgress: (progress) => setState(() => tab.progress = progress),
                          onLoadError: (url, code) => setState(() {
                            tab.error = 'Page load failed ($code)';
                            tab.progress = 100;
                          }),
                          onUrlChanged: (url) {
                            if (url == null) return;
                            setState(() {
                              tab.url = url.startsWith('file:') ? '' : url;
                              if (identical(tab, _active)) _syncAddress();
                            });
                          },
                        );
                      },
                    ),
                ],
              ),
            ),
            if (active?.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Text(active!.error!, style: const TextStyle(color: Colors.orangeAccent)),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 4, 10, 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  IconButton(tooltip: 'Back', onPressed: _goBack, icon: const Icon(Icons.arrow_back)),
                  IconButton(tooltip: 'Forward', onPressed: _goForward, icon: const Icon(Icons.arrow_forward)),
                  IconButton(tooltip: 'Home', onPressed: _goHome, icon: const Icon(Icons.home_outlined)),
                  IconButton(
                    tooltip: 'Reload',
                    onPressed: active == null ? null : () => active.controller.reload(),
                    icon: const Icon(Icons.refresh),
                  ),
                  IconButton(
                    tooltip: 'Tabs',
                    onPressed: _showTabs,
                    icon: Badge(label: Text('${_tabs.length}'), child: const Icon(Icons.tab_outlined)),
                  ),
                  IconButton(
                    tooltip: 'Downloads',
                    onPressed: _showDownloads,
                    icon: Badge(
                      isLabelVisible: _downloads.isNotEmpty,
                      label: Text('${_downloads.length}'),
                      child: const Icon(Icons.download_outlined),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
