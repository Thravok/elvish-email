import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Loads `/auth/cap-embed.html` on the API origin and forwards Cap tokens to Flutter.
class AuthCapWebView extends StatefulWidget {
  const AuthCapWebView({
    super.key,
    required this.embedUri,
    required this.onToken,
    this.onBridgeError,
  });

  final Uri embedUri;
  final void Function(String? token) onToken;
  final void Function(String message)? onBridgeError;

  @override
  State<AuthCapWebView> createState() => _AuthCapWebViewState();
}

class _AuthCapWebViewState extends State<AuthCapWebView> {
  WebViewController? _controller;

  @override
  void initState() {
    super.initState();
    _bindController(widget.embedUri);
  }

  @override
  void didUpdateWidget(AuthCapWebView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.embedUri != widget.embedUri) {
      _bindController(widget.embedUri);
    }
  }

  void _bindController(Uri embedUri) {
    final c = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'ElvishCap',
        onMessageReceived: (JavaScriptMessage message) {
          final raw = message.message;
          try {
            final dynamic j = jsonDecode(raw);
            if (j is! Map<String, dynamic>) {
              return;
            }
            final type = j['type'] as String?;
            if (type == 'token') {
              widget.onToken(j['token'] as String?);
            } else if (type == 'reset') {
              widget.onToken(null);
            } else if (type == 'error') {
              widget.onBridgeError?.call(j['detail'] as String? ?? 'captcha error');
            }
          } catch (_) {
            widget.onBridgeError?.call('invalid captcha response');
          }
        },
      )
      ..loadRequest(embedUri);
    setState(() {
      _controller = c;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    if (c == null) {
      return const SizedBox(height: 52, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    return WebViewWidget(controller: c);
  }
}
