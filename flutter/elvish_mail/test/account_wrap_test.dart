import 'package:flutter_test/flutter_test.dart';

import 'package:elvish_mail/crypto/account_wrap.dart';

void main() {
  test('aesWrap round-trip matches aesUnwrap', () async {
    const password = 'correct horse battery staple';
    final salt = ElvishAccountWrap.randomBytes(16);
    final derived = await ElvishAccountWrap.deriveKekWithMetadata(password: password, salt: salt);
    final plain = ElvishAccountWrap.randomBytes(32);
    final wrapped = await ElvishAccountWrap.aesWrap(kek: derived.kek, plaintext: plain);
    final clear = await ElvishAccountWrap.aesUnwrap(kek: derived.kek, wrapped: wrapped);
    expect(clear, plain);
  });
}
