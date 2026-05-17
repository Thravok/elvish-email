import 'package:flutter/material.dart';

import '../app_state.dart';
import 'auth_cap_webview.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.model});

  final ElvishAppState model;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _user = TextEditingController();
  final _pass = TextEditingController();
  var _capToken = '';
  var _capEmbedKey = 0;
  String? _capBridgeError;
  String? _lastHandledCaptchaError;

  @override
  void initState() {
    super.initState();
    _user.addListener(() => setState(() {}));
    widget.model.addListener(_onModel);
  }

  @override
  void dispose() {
    widget.model.removeListener(_onModel);
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(LoginPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.model != widget.model) {
      oldWidget.model.removeListener(_onModel);
      widget.model.addListener(_onModel);
    }
  }

  void _onModel() {
    if (!mounted) {
      return;
    }
    final err = widget.model.lastError;
    setState(() {
      if (err == null) {
        _lastHandledCaptchaError = null;
      } else if (err != _lastHandledCaptchaError &&
          err.toLowerCase().contains('captcha') &&
          widget.model.authCapWidgetEndpoint != null) {
        _lastHandledCaptchaError = err;
        _capToken = '';
        _capEmbedKey++;
      }
    });
  }

  Uri? _capEmbedUri() {
    final ep = widget.model.authCapWidgetEndpoint;
    if (ep == null || ep.isEmpty) {
      return null;
    }
    final base = widget.model.apiBaseForWebView;
    return Uri.parse('$base/auth/cap-embed.html').replace(queryParameters: {'endpoint': ep});
  }

  bool get _capSatisfied {
    if (widget.model.authCapWidgetEndpoint == null) {
      return true;
    }
    return _capToken.trim().isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final domain = m.mailDomain;
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final capEp = m.authCapWidgetEndpoint;
    final embed = _capEmbedUri();

    return Scaffold(
      appBar: AppBar(title: const Text('ELVish Mail')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Sign in', style: textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(
                    'Use the same account as the web or iOS client.',
                    style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _user,
                    decoration: const InputDecoration(labelText: 'Username'),
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.none,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _pass,
                    decoration: const InputDecoration(labelText: 'Password'),
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                  ),
                  if (domain.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Your address will be ${_user.text.trim().isEmpty ? 'you' : _user.text.trim()}@$domain',
                      style: textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                  if (capEp != null) ...[
                    const SizedBox(height: 16),
                    Text('Human verification', style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    if (embed != null)
                      SizedBox(
                        height: 58,
                        child: AuthCapWebView(
                          key: ValueKey(_capEmbedKey),
                          embedUri: embed,
                          onToken: (t) {
                            setState(() {
                              _capBridgeError = null;
                              _capToken = t?.trim() ?? '';
                            });
                          },
                          onBridgeError: (msg) {
                            setState(() {
                              _capToken = '';
                              _capBridgeError = msg;
                            });
                          },
                        ),
                      )
                    else
                      Text(
                        'Human verification is required but the captcha URL is invalid.',
                        style: textTheme.bodyMedium?.copyWith(color: scheme.error),
                      ),
                    if (_capBridgeError != null) ...[
                      const SizedBox(height: 6),
                      Text(_capBridgeError!, style: textTheme.bodySmall?.copyWith(color: scheme.error)),
                    ],
                  ],
                  if (m.lastError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      m.lastError!,
                      style: textTheme.bodyMedium?.copyWith(color: scheme.error),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: m.isBusy || !_capSatisfied ? null : _submit,
                    child: m.isBusy
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Log in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _submit() {
    widget.model.login(_user.text, _pass.text, capToken: _capToken);
  }
}
