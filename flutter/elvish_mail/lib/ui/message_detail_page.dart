import 'package:flutter/material.dart';

import '../api/mail_dtos.dart';
import '../app_state.dart';
import '../mime/mail_mime_present.dart';

class MessageDetailPage extends StatefulWidget {
  const MessageDetailPage({super.key, required this.model, required this.row});

  final ElvishAppState model;
  final MailInboxRow row;

  @override
  State<MessageDetailPage> createState() => _MessageDetailPageState();
}

class _MessageDetailPageState extends State<MessageDetailPage> {
  bool _loading = true;
  String? _error;
  MailPresentedMessage? _presented;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (widget.row.read != true) {
        await widget.model.markMessageRead(widget.row.id);
      }
      final raw = await widget.model.loadDecryptedBody(widget.row.id);
      setState(() {
        _presented = MailPresentedMessage.present(raw);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final title = _presented?.subject.trim().isNotEmpty == true
        ? _presented!.subject
        : (widget.row.subject?.trim().isNotEmpty == true ? widget.row.subject! : 'Message');
    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: textTheme.bodyLarge?.copyWith(color: scheme.error),
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_presented != null &&
                          (_presented!.from.isNotEmpty ||
                              _presented!.to.isNotEmpty ||
                              _presented!.cc.isNotEmpty ||
                              _presented!.date.isNotEmpty))
                        Card.filled(
                          margin: EdgeInsets.zero,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (_presented!.from.isNotEmpty) _kv(context, 'From', _presented!.from),
                                if (_presented!.to.isNotEmpty) _kv(context, 'To', _presented!.to),
                                if (_presented!.cc.isNotEmpty) _kv(context, 'Cc', _presented!.cc),
                                if (_presented!.date.isNotEmpty) _kv(context, 'Date', _presented!.date),
                              ],
                            ),
                          ),
                        ),
                      if (_presented != null &&
                          (_presented!.from.isNotEmpty ||
                              _presented!.to.isNotEmpty ||
                              _presented!.cc.isNotEmpty ||
                              _presented!.date.isNotEmpty))
                        const SizedBox(height: 16),
                      SelectableText(
                        _presented?.body ?? '',
                        style: textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _kv(BuildContext context, String k, String v) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            k,
            style: textTheme.labelLarge?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 2),
          SelectableText(v, style: textTheme.bodyMedium),
        ],
      ),
    );
  }
}
