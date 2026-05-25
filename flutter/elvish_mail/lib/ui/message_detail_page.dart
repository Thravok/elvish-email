import 'package:flutter/material.dart';

import '../api/mail_dtos.dart';
import '../app_state.dart';
import '../mail/reply_draft.dart';
import '../mime/mail_mime_present.dart';
import 'compose_page.dart';

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
  ReplyMessageSource? _replySource;

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
      final presented = MailPresentedMessage.present(raw);
      setState(() {
        _presented = presented;
        _replySource = ReplyMessageSource.fromParsedHeaders(
          from: presented.from.isNotEmpty ? presented.from : (widget.row.fromAddr ?? ''),
          to: presented.to,
          cc: presented.cc,
          subject: presented.subject.isNotEmpty ? presented.subject : (widget.row.subject ?? ''),
          messageId: presented.messageId,
          inReplyTo: presented.inReplyTo,
          references: presented.references,
          replyTo: presented.replyTo,
        );
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _replySource = ReplyMessageSource.fromInboxRow(widget.row);
        _loading = false;
      });
    }
  }

  void _openCompose({required bool replyAll}) {
    final src = _replySource ?? ReplyMessageSource.fromInboxRow(widget.row);
    final account = widget.model.currentUser?.email ?? '';
    final identities = widget.model.mailIdentities.map((e) => e.email).toList();
    final draft = buildReplyComposeDraft(
      message: src,
      identityEmails: identities,
      accountEmail: account,
      replyAll: replyAll,
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ComposePage(model: widget.model, initialDraft: draft),
      ),
    );
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
        actions: [
          if (widget.row.read == true)
            TextButton(
              onPressed: widget.model.isBusy
                  ? null
                  : () async {
                      await widget.model.markMessageUnread(widget.row.id);
                      if (!context.mounted) {
                        return;
                      }
                      Navigator.pop(context);
                    },
              child: const Text('Unread'),
            ),
          if (widget.model.mailKeysUnlocked) ...[
            IconButton(
              tooltip: 'Reply',
              onPressed: () => _openCompose(replyAll: false),
              icon: const Icon(Icons.reply),
            ),
            IconButton(
              tooltip: 'Reply all',
              onPressed: () => _openCompose(replyAll: true),
              icon: const Icon(Icons.reply_all),
            ),
          ],
        ],
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
                              _presented!.date.isNotEmpty)) ...[
                        if (_presented!.from.isNotEmpty)
                          _labeled(context, 'From', _presented!.from),
                        if (_presented!.to.isNotEmpty) _labeled(context, 'To', _presented!.to),
                        if (_presented!.cc.isNotEmpty) _labeled(context, 'Cc', _presented!.cc),
                        if (_presented!.date.isNotEmpty) _labeled(context, 'Date', _presented!.date),
                        const Divider(height: 24),
                      ],
                      SelectableText(
                        _presented?.body.isNotEmpty == true ? _presented!.body : '(empty body)',
                        style: textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _labeled(BuildContext context, String label, String value) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          SelectableText(value, style: textTheme.bodyMedium),
        ],
      ),
    );
  }
}
