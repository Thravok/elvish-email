import 'package:flutter/foundation.dart';

import 'api/auth_dtos.dart';
import 'api/auth_service.dart';
import 'api/elvish_api_client.dart';
import 'api/mail_dtos.dart';
import 'api/compose_service.dart';
import 'api/mail_service.dart';
import 'keyvault/elvish_key_vault.dart';

/// App-wide session + mailbox state (Swift `AppModel` analogue).
class ElvishAppState extends ChangeNotifier {
  ElvishAppState._(this._api, this.auth, this.mail);

  static Future<ElvishAppState> create() async {
    final api = await ElvishApiClient.create();
    return ElvishAppState._(api, AuthService(api), MailService(api));
  }

  final ElvishApiClient _api;
  final AuthService auth;
  final MailService mail;
  final ElvishKeyVault keyVault = ElvishKeyVault();

  /// Same origin as JSON API calls; used to load `/auth/cap-embed.html` for Cap.
  String get apiBaseForWebView => _api.apiRoot;

  String mailDomain = '';
  String? authCapWidgetEndpoint;
  AuthUserDto? currentUser;
  List<MailFolderDto> mailFolders = [];
  String selectedMailboxFolder = 'inbox';
  List<MailInboxRow> inboxRows = [];
  bool mailKeysUnlocked = false;
  List<IdentityRowDto> get mailIdentities => keyVault.identityRows;

  ComposeService get composeService => ComposeService(mail: mail, vault: keyVault);
  String? lastError;
  bool isBusy = false;
  LoginMfaRequired? mfaChallenge;
  String? _pendingVaultPassword;

  void _syncVaultFlag() {
    mailKeysUnlocked = keyVault.isUnlocked;
  }

  void clearError() {
    lastError = null;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    isBusy = true;
    lastError = null;
    notifyListeners();
    try {
      final cfg = await auth.fetchSignupConfig();
      mailDomain = cfg.mailDomain;
      authCapWidgetEndpoint = cfg.activeCapWidgetEndpoint;
      final sessionUser = await auth.fetchMe();
      if (sessionUser != null) {
        _pendingVaultPassword = null;
        await keyVault.restoreFromKeychainIfPossible(api: _api, sessionEmail: sessionUser.email);
        _syncVaultFlag();
        currentUser = sessionUser;
        await refreshFolders();
        await refreshMailbox();
      } else {
        currentUser = null;
        keyVault.zero();
        _syncVaultFlag();
      }
    } catch (e) {
      lastError = '$e';
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  Future<void> login(String username, String password, {String capToken = ''}) async {
    isBusy = true;
    lastError = null;
    mfaChallenge = null;
    notifyListeners();
    final u = username.trim().toLowerCase();
    final trimmedCap = capToken.trim();
    final capTok = authCapWidgetEndpoint == null ? null : (trimmedCap.isEmpty ? null : trimmedCap);
    try {
      final outcome = await auth.loginSrp(u, password, capToken: capTok);
      if (outcome is LoginMfaRequired) {
        _pendingVaultPassword = password;
        mfaChallenge = outcome;
      } else if (outcome is LoginSuccess) {
        _pendingVaultPassword = password;
        currentUser = outcome.user;
        await _unlockMailKeysAndRefresh(sessionEmail: outcome.user.email);
      }
    } catch (e) {
      lastError = '$e';
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  Future<void> submitMfa(String code, {required bool useRecovery}) async {
    final ch = mfaChallenge;
    if (ch == null) {
      return;
    }
    isBusy = true;
    lastError = null;
    notifyListeners();
    try {
      final user = useRecovery
          ? await auth.completeMfaRecovery(challengeId: ch.challengeId, code: code.trim())
          : await auth.completeMfaTotp(challengeId: ch.challengeId, code: code.trim());
      mfaChallenge = null;
      currentUser = user;
      await _unlockMailKeysAndRefresh(sessionEmail: user.email);
    } catch (e) {
      lastError = '$e';
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  void cancelMfa() {
    mfaChallenge = null;
    _pendingVaultPassword = null;
    notifyListeners();
  }

  Future<void> logout() async {
    isBusy = true;
    lastError = null;
    notifyListeners();
    try {
      final email = currentUser?.email;
      await auth.logout();
      if (email != null) {
        await keyVault.deletePersistedAccount(email);
      }
      currentUser = null;
      inboxRows = [];
      mailFolders = [];
      selectedMailboxFolder = 'inbox';
      mfaChallenge = null;
      _pendingVaultPassword = null;
      keyVault.zero();
      _syncVaultFlag();
    } catch (e) {
      lastError = '$e';
    } finally {
      isBusy = false;
      notifyListeners();
    }
  }

  Future<void> refreshFolders() async {
    try {
      final r = await mail.listFolders();
      mailFolders = r.folders;
      final names = mailFolders.map((f) => f.id).toSet();
      if (!names.contains(selectedMailboxFolder)) {
        selectedMailboxFolder = 'inbox';
      }
    } catch (e) {
      if (mailFolders.isEmpty) {
        mailFolders = MailFolderDto.standardPlaceholders();
      }
      lastError = '$e';
    }
    notifyListeners();
  }

  Future<void> refreshMailbox() async {
    try {
      final r = await mail.messages(folder: selectedMailboxFolder);
      inboxRows = _buildInboxRows(r.messages);
    } catch (e) {
      inboxRows = [];
      lastError = '$e';
    }
    notifyListeners();
  }

  Future<void> selectFolder(String folder) async {
    selectedMailboxFolder = folder.toLowerCase().trim();
    notifyListeners();
    await refreshMailbox();
  }

  Future<void> markMessageRead(String id) async {
    try {
      await mail.setMessageRead(id: id, read: true);
      await refreshMailbox();
    } catch (_) {}
  }

  Future<String> loadDecryptedBody(String messageId) async {
    final blob = await mail.messageBlob(messageId);
    return keyVault.decryptMessageBody(blob);
  }

  Future<void> _unlockMailKeysAndRefresh({String? sessionEmail}) async {
    final pw = _pendingVaultPassword;
    _pendingVaultPassword = null;
    await refreshFolders();
    if (pw == null) {
      await refreshMailbox();
      _syncVaultFlag();
      return;
    }
    try {
      await keyVault.unlock(api: _api, password: pw, sessionEmail: sessionEmail);
    } catch (e) {
      lastError = '$e';
    }
    _syncVaultFlag();
    await refreshMailbox();
  }

  List<MailInboxRow> _buildInboxRows(List<MailManifestRow> manifests) {
    return manifests.map((m) {
      var subject = m.subject?.isEmpty == true ? null : m.subject;
      var fromAddr = m.fromAddr?.isEmpty == true ? null : m.fromAddr;
      var toAddrs = m.toAddrs;
      var decrypted = false;
      final b64 = m.headerCiphertextB64;
      if (b64 != null && b64.isNotEmpty && keyVault.isUnlocked) {
        final stub = keyVault.decryptMailHeader(b64);
        if (stub != null) {
          final s = stub.subject?.trim();
          if (s != null && s.isNotEmpty) {
            subject = subject ?? s;
          }
          final f = stub.from?.trim();
          if (f != null && f.isNotEmpty) {
            fromAddr = fromAddr ?? f;
          }
          final t = stub.to;
          if (t != null && t.isNotEmpty && (toAddrs == null || toAddrs.isEmpty)) {
            toAddrs = t;
          }
          decrypted = true;
        }
      }
      final hasCipher = b64 != null && b64.isNotEmpty;
      final hasAtt = m.hasAttachments ?? false;
      return MailInboxRow(
        id: m.id,
        subject: subject,
        fromAddr: fromAddr,
        toAddrs: toAddrs,
        receivedAt: m.receivedAt,
        read: m.read,
        headerDecrypted: decrypted,
        hasHeaderCiphertext: hasCipher,
        hasAttachments: hasAtt,
      );
    }).toList();
  }
}
