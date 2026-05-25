import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/mail_dtos.dart';
import '../app_state.dart';
import '../crypto/protected_link_crypto.dart';
import '../mime/mail_compose_mime.dart';

enum ComposeSendMode { pgp, link }

class ComposePage extends StatefulWidget {
  const ComposePage({super.key, required this.model});

  final ElvishAppState model;

  @override
  State<ComposePage> createState() => _ComposePageState();
}

class _ComposePageState extends State<ComposePage> {
  ComposeSendMode _mode = ComposeSendMode.pgp;
  String _from = '';
  final _to = TextEditingController();
  final _cc = TextEditingController();
  final _bcc = TextEditingController();
  final _subject = TextEditingController();
  final _body = TextEditingController();
  final _recipientKey = TextEditingController();
  String _keyStatus = 'idle';
  String? _keyError;
  bool _lookupBusy = false;
  final _linkPassword = TextEditingController();
  final _linkPasswordConfirm = TextEditingController();
  int _ttlSeconds = 7 * 24 * 3600;
  int _maxViews = 0;
  bool _notify = true;
  String? _linkResultUrl;
  String? _sendError;
  bool _sending = false;

  @override
  void dispose() {
    _to.dispose();
    _cc.dispose();
    _bcc.dispose();
    _subject.dispose();
    _body.dispose();
    _recipientKey.dispose();
    _linkPassword.dispose();
    _linkPasswordConfirm.dispose();
    super.dispose();
  }

  List<String> get _fromOptions {
    final rows = widget.model.mailIdentities;
    if (rows.isNotEmpty) {
      return rows.map((e) => e.email).toList();
    }
    final u = widget.model.currentUser?.email;
    if (u != null) {
      return [u];
    }
    return [];
  }

  @override
  void initState() {
    super.initState();
    final def = widget.model.mailIdentities.where((e) => e.isDefault == true).map((e) => e.email).firstOrNull;
    _from = def ?? _fromOptions.firstOrNull ?? '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Compose'),
        actions: [
          TextButton(
            onPressed: _sending || !widget.model.mailKeysUnlocked ? null : _send,
            child: _sending
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Send'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (!widget.model.mailKeysUnlocked)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  'Mail keys are locked. Sign out and sign in again with your password.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
          SegmentedButton<ComposeSendMode>(
            segments: const [
              ButtonSegment(value: ComposeSendMode.pgp, label: Text('PGP Direct')),
              ButtonSegment(value: ComposeSendMode.link, label: Text('Protected link')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          const SizedBox(height: 16),
          DropdownMenu<String>(
            label: const Text('From'),
            initialSelection: _from.isEmpty ? null : _from,
            dropdownMenuEntries: [
              for (final e in _fromOptions) DropdownMenuEntry(value: e, label: e),
            ],
            onSelected: (v) => setState(() => _from = v ?? ''),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _to,
            decoration: const InputDecoration(labelText: 'To'),
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            onChanged: (_) {
              if (_mode == ComposeSendMode.pgp) {
                _scheduleLookup();
              }
            },
          ),
          if (_mode == ComposeSendMode.pgp) ...[
            TextField(
              controller: _cc,
              decoration: const InputDecoration(labelText: 'Cc (headers only)'),
              autocorrect: false,
            ),
            TextField(
              controller: _bcc,
              decoration: const InputDecoration(labelText: 'Bcc (headers only)'),
              autocorrect: false,
            ),
            if (_lookupBusy) const LinearProgressIndicator(),
            if (_keyStatus.isNotEmpty && _keyStatus != 'idle')
              Text(_keyStatusLabel, style: Theme.of(context).textTheme.bodySmall),
            if (_keyError != null) Text(_keyError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            TextField(
              controller: _recipientKey,
              decoration: const InputDecoration(labelText: 'Or paste armored public key'),
              maxLines: 4,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            ),
          ] else
            TextField(
              controller: _cc,
              decoration: const InputDecoration(labelText: 'Cc'),
              autocorrect: false,
            ),
          TextField(
            controller: _subject,
            decoration: const InputDecoration(labelText: 'Subject'),
          ),
          TextField(
            controller: _body,
            decoration: const InputDecoration(labelText: 'Body'),
            maxLines: 8,
          ),
          if (_mode == ComposeSendMode.link) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _linkPassword,
              decoration: const InputDecoration(labelText: 'Password (min 12)'),
              obscureText: true,
            ),
            TextField(
              controller: _linkPasswordConfirm,
              decoration: const InputDecoration(labelText: 'Confirm password'),
              obscureText: true,
            ),
            DropdownMenu<int>(
              label: const Text('Expires'),
              initialSelection: _ttlSeconds,
              dropdownMenuEntries: const [
                DropdownMenuEntry(value: 3600, label: '1 hour'),
                DropdownMenuEntry(value: 86400, label: '24 hours'),
                DropdownMenuEntry(value: 604800, label: '7 days'),
                DropdownMenuEntry(value: 2592000, label: '30 days'),
              ],
              onSelected: (v) => setState(() => _ttlSeconds = v ?? _ttlSeconds),
            ),
            DropdownMenu<int>(
              label: const Text('Max views'),
              initialSelection: _maxViews,
              dropdownMenuEntries: const [
                DropdownMenuEntry(value: 0, label: 'Unlimited'),
                DropdownMenuEntry(value: 1, label: '1 (burn after read)'),
                DropdownMenuEntry(value: 5, label: '5'),
                DropdownMenuEntry(value: 10, label: '10'),
              ],
              onSelected: (v) => setState(() => _maxViews = v ?? _maxViews),
            ),
            SwitchListTile(
              title: const Text('Notify recipients by email'),
              value: _notify,
              onChanged: (v) => setState(() => _notify = v),
            ),
          ],
          if (_linkResultUrl != null) ...[
            const SizedBox(height: 16),
            Text('Link created', style: Theme.of(context).textTheme.titleSmall),
            SelectableText(_linkResultUrl!, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
            FilledButton.icon(
              onPressed: () => Clipboard.setData(ClipboardData(text: _linkResultUrl!)),
              icon: const Icon(Icons.copy),
              label: const Text('Copy link'),
            ),
          ],
          if (_sendError != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_sendError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
        ],
      ),
    );
  }

  String get _keyStatusLabel {
    switch (_keyStatus) {
      case 'checking':
        return 'Checking for recipient key…';
      case 'found':
        return 'Recipient key found';
      case 'missing':
        return 'No key found — paste a public key';
      case 'manual':
        return 'Using pasted public key';
      default:
        return '';
    }
  }

  void _scheduleLookup() {
    Future<void>.delayed(const Duration(milliseconds: 350), () {
      if (!mounted) {
        return;
      }
      _lookupKey();
    });
  }

  Future<void> _lookupKey() async {
    final recipients = MailComposeMime.splitAddressList(_to.text)
        .map(MailComposeMime.canonicalEmailToken)
        .where((e) => e.isNotEmpty)
        .toList();
    if (recipients.length != 1) {
      setState(() {
        _keyStatus = recipients.length > 1 ? 'needs-single' : 'idle';
      });
      return;
    }
    setState(() {
      _lookupBusy = true;
      _keyStatus = 'checking';
      _keyError = null;
    });
    try {
      final hit = await widget.model.composeService.resolveRecipientKey(recipients.first);
      if (!mounted) {
        return;
      }
      setState(() {
        if (hit?.armoredPublic != null && hit!.armoredPublic!.isNotEmpty) {
          _recipientKey.text = hit.armoredPublic!;
          _keyStatus = 'found';
        } else if (_recipientKey.text.trim().isNotEmpty) {
          _keyStatus = 'manual';
        } else {
          _keyStatus = 'missing';
        }
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _keyError = '$e';
        _keyStatus = 'missing';
      });
    } finally {
      if (mounted) {
        setState(() => _lookupBusy = false);
      }
    }
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _sendError = null;
    });
    try {
      if (_mode == ComposeSendMode.pgp) {
        await _sendPgp();
      } else {
        await _sendLink();
      }
    } catch (e) {
      setState(() => _sendError = '$e');
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _sendPgp() async {
    final recipients = MailComposeMime.splitAddressList(_to.text)
        .map(MailComposeMime.canonicalEmailToken)
        .where((e) => e.isNotEmpty)
        .toList();
    if (recipients.length != 1) {
      throw Exception('PGP direct requires exactly one To address');
    }
    final recipient = recipients.first;
    final armored = _recipientKey.text.trim();
    if (armored.isEmpty) {
      throw Exception('Recipient public key required');
    }
    final sender = widget.model.mailIdentities.where((i) => i.email == _from).firstOrNull;
    if (sender?.armoredPublic == null ||
        sender!.armoredPublic!.isEmpty ||
        sender.fingerprint == null ||
        sender.fingerprint!.isEmpty) {
      throw Exception('Sender identity unavailable');
    }
    final hit = await widget.model.composeService.resolveRecipientKey(recipient);
    final localDelivery =
        hit?.source == 'local' && hit?.email?.trim().toLowerCase() == recipient;
    final result = await widget.model.composeService.sendPgpDirect(
      from: _from,
      recipient: recipient,
      subject: _subject.text,
      body: _body.text,
      recipientArmored: armored,
      senderArmored: sender.armoredPublic!,
      senderFingerprint: sender.fingerprint!,
      localDelivery: localDelivery,
      cc: MailComposeMime.splitAddressList(_cc.text),
      bcc: MailComposeMime.splitAddressList(_bcc.text),
    );
    widget.model.selectedMailboxFolder = 'sent';
    await widget.model.refreshMailbox();
    if (!mounted) {
      return;
    }
    if (result.localDelivery) {
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Queued for delivery (outbox ${result.outboxId?.substring(0, 8) ?? ''})')),
      );
      Navigator.pop(context);
    }
  }

  Future<void> _sendLink() async {
    if (_linkPassword.text.length < 12) {
      throw ProtectedLinkCryptoException('Password must be at least 12 characters.');
    }
    if (_linkPassword.text != _linkPasswordConfirm.text) {
      throw Exception('Passwords do not match');
    }
    final res = await widget.model.composeService.sendProtectedLink(
      from: _from,
      to: _to.text,
      cc: _cc.text,
      subject: _subject.text,
      body: _body.text,
      password: _linkPassword.text,
      ttlSeconds: _ttlSeconds,
      maxViews: _maxViews,
      notify: _notify,
    );
    setState(() => _linkResultUrl = res.url);
  }
}
