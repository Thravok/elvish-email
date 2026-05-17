import 'package:flutter/material.dart';

import '../api/auth_service.dart';
import '../app_state.dart';

class MfaPage extends StatefulWidget {
  const MfaPage({super.key, required this.model, required this.challenge});

  final ElvishAppState model;
  final LoginMfaRequired challenge;

  @override
  State<MfaPage> createState() => _MfaPageState();
}

class _MfaPageState extends State<MfaPage> {
  final _code = TextEditingController();
  bool _useRecovery = false;

  @override
  void initState() {
    super.initState();
    final m = widget.challenge.methods;
    if (!m.contains('totp') && m.contains('recovery')) {
      _useRecovery = true;
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ch = widget.challenge;
    final m = widget.model;
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final onlyWebAuthn =
        !ch.methods.contains('totp') && !ch.methods.contains('recovery') && ch.methods.contains('webauthn');

    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    ch.user?.email ?? 'Your account',
                    style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Enter your second factor to finish signing in.',
                    style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 20),
                  if (onlyWebAuthn)
                    Text(
                      'Security key sign-in is not available in this app yet. Use the web client or add TOTP/recovery.',
                      style: textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                    )
                  else ...[
                    if (ch.methods.contains('totp') && ch.methods.contains('recovery'))
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(value: false, label: Text('Authenticator'), icon: Icon(Icons.phone_android_outlined)),
                          ButtonSegment(value: true, label: Text('Recovery'), icon: Icon(Icons.key_outlined)),
                        ],
                        selected: {_useRecovery},
                        onSelectionChanged: (s) {
                          if (s.isNotEmpty) {
                            setState(() => _useRecovery = s.first);
                          }
                        },
                      ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _code,
                      decoration: InputDecoration(
                        labelText: _useRecovery ? 'Recovery code' : 'Authenticator code',
                      ),
                      onSubmitted: (_) => _verify(),
                    ),
                  ],
                  if (m.lastError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      m.lastError!,
                      style: textTheme.bodyMedium?.copyWith(color: scheme.error),
                    ),
                  ],
                  const SizedBox(height: 24),
                  if (!onlyWebAuthn)
                    FilledButton(
                      onPressed: m.isBusy || _code.text.trim().isEmpty ? null : _verify,
                      child: m.isBusy
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Verify'),
                    ),
                  const SizedBox(height: 8),
                  TextButton(onPressed: m.isBusy ? null : () => m.cancelMfa(), child: const Text('Back')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _verify() {
    widget.model.submitMfa(_code.text, useRecovery: _useRecovery);
  }
}
