import 'package:flutter/material.dart';

import '../api/mail_dtos.dart';
import '../app_state.dart';
import 'compose_page.dart';
import 'message_detail_page.dart';

class MailHomePage extends StatelessWidget {
  const MailHomePage({super.key, required this.model});

  final ElvishAppState model;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        final folders =
            model.mailFolders.isEmpty ? MailFolderDto.standardPlaceholders() : model.mailFolders;
        final rawIdx = folders.indexWhere((f) => f.id == model.selectedMailboxFolder);
        final selectedIdx = rawIdx < 0 ? 0 : rawIdx;
        final folder = model.selectedMailboxFolder.toLowerCase();

        return Scaffold(
          floatingActionButton: model.mailKeysUnlocked
              ? FloatingActionButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ComposePage(model: model),
                      ),
                    );
                  },
                  child: const Icon(Icons.edit),
                )
              : null,
          appBar: AppBar(
            title: const Text('Mail'),
            actions: [
              IconButton(
                tooltip: 'Refresh',
                onPressed: model.isBusy ? null : () => model.refreshMailData(),
                icon: const Icon(Icons.refresh),
              ),
              if (!model.mailKeysUnlocked)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Tooltip(
                    message:
                        'Mail keys are locked. Sign out and sign in with your password to read encrypted mail.',
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline, size: 20, color: scheme.onSurfaceVariant),
                        const SizedBox(width: 4),
                        Text(
                          'Locked',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ),
              IconButton(
                tooltip: 'Log out',
                onPressed: model.isBusy ? null : () => model.logout(),
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          drawer: NavigationDrawer(
            selectedIndex: selectedIdx,
            onDestinationSelected: (index) {
              Navigator.pop(context);
              if (index >= 0 && index < folders.length) {
                model.selectFolder(folders[index].id);
              }
            },
            children: [
              for (final f in folders)
                NavigationDrawerDestination(
                  icon: Icon(_folderIconOutlined(f.name)),
                  selectedIcon: Icon(_folderIconFilled(f.name)),
                  label: Text(_folderTitle(f.name)),
                ),
            ],
          ),
          body: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (model.lastError != null)
                MaterialBanner(
                  content: Text(model.lastError!),
                  actions: [
                    TextButton(onPressed: () => model.clearError(), child: const Text('Dismiss')),
                  ],
                ),
              Expanded(
                child: model.inboxRows.isEmpty
                    ? Center(
                        child: Text(
                          'No messages',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: model.inboxRows.length,
                        itemBuilder: (context, i) {
                          final row = model.inboxRows[i];
                          return _MessageRow(
                            model: model,
                            row: row,
                            folder: folder,
                            onOpen: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => MessageDetailPage(model: model, row: row),
                                ),
                              );
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  static IconData _folderIconOutlined(String name) {
    switch (name.toLowerCase()) {
      case 'inbox':
        return Icons.inbox_outlined;
      case 'sent':
        return Icons.send_outlined;
      case 'drafts':
        return Icons.drafts_outlined;
      case 'trash':
        return Icons.delete_outline;
      case 'archive':
        return Icons.archive_outlined;
      default:
        return Icons.folder_outlined;
    }
  }

  static IconData _folderIconFilled(String name) {
    switch (name.toLowerCase()) {
      case 'inbox':
        return Icons.inbox;
      case 'sent':
        return Icons.send;
      case 'drafts':
        return Icons.drafts;
      case 'trash':
        return Icons.delete;
      case 'archive':
        return Icons.archive;
      default:
        return Icons.folder;
    }
  }

  static String _folderTitle(String name) {
    switch (name.toLowerCase()) {
      case 'inbox':
        return 'Inbox';
      case 'sent':
        return 'Sent';
      case 'drafts':
        return 'Drafts';
      case 'trash':
        return 'Trash';
      case 'archive':
        return 'Archive';
      default:
        return name;
    }
  }
}

class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.model,
    required this.row,
    required this.folder,
    required this.onOpen,
  });

  final ElvishAppState model;
  final MailInboxRow row;
  final String folder;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final card = Card.filled(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: scheme.secondaryContainer,
          foregroundColor: scheme.onSecondaryContainer,
          child: Text(
            (row.fromAddr ?? row.subject ?? '?').trim().isEmpty
                ? '?'
                : (row.fromAddr ?? row.subject ?? '?').trim()[0].toUpperCase(),
          ),
        ),
        title: Text(row.subject ?? '(no subject)', maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Text(row.fromAddr ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: row.read == true
            ? null
            : Icon(Icons.mark_email_unread_outlined, color: scheme.primary, size: 22),
        onTap: onOpen,
      ),
    );

    if (folder == 'trash') {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Dismissible(
          key: ValueKey('inbox-${row.id}'),
          direction: DismissDirection.startToEnd,
          background: Container(
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 20),
            color: scheme.primaryContainer,
            child: Icon(Icons.inbox, color: scheme.onPrimaryContainer),
          ),
          confirmDismiss: (_) async {
            await model.moveMessage(row.id, 'inbox');
            return false;
          },
          child: card,
        ),
      );
    }

    if (folder == 'archive') {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        child: Dismissible(
          key: ValueKey('inbox-${row.id}'),
          direction: DismissDirection.startToEnd,
          background: Container(
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.only(left: 20),
            color: scheme.primaryContainer,
            child: Icon(Icons.inbox, color: scheme.onPrimaryContainer),
          ),
          confirmDismiss: (_) async {
            await model.moveMessage(row.id, 'inbox');
            return false;
          },
          child: card,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: Dismissible(
        key: ValueKey('row-${row.id}'),
        direction: DismissDirection.horizontal,
        background: folder == 'inbox'
            ? Container(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.only(left: 20),
                color: scheme.tertiaryContainer,
                child: Icon(Icons.archive, color: scheme.onTertiaryContainer),
              )
            : null,
        secondaryBackground: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 20),
          color: scheme.errorContainer,
          child: Icon(Icons.delete, color: scheme.onErrorContainer),
        ),
        confirmDismiss: (direction) async {
          if (direction == DismissDirection.endToStart) {
            await model.moveMessage(row.id, 'trash');
          } else if (direction == DismissDirection.startToEnd && folder == 'inbox') {
            await model.moveMessage(row.id, 'archive');
          }
          return false;
        },
        child: card,
      ),
    );
  }
}
