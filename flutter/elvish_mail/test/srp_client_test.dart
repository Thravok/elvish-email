import 'package:elvish_mail/crypto/srp_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('SRP vectors match IOS/IOSTests/ElvishSRPClientTests.swift', () {
    const aHex = '1234567890123456';
    final a = BigInt.parse(aHex, radix: 10);
    final state = ElvishSrpClient.beginLogin(
      'alice',
      'correct horse battery staple',
      deterministicPrivateExponent: a,
    );
    expect(
      state.clientPublicB64,
      'AHPQ/ZOwjW/UiKdsuslstkCJyOhFWUdJaTC8Nxds+2LJsyDNNTJB9V5H7WyvQ4AwDwiRkeKtPqQfKljCMSciODOQGo1OwEDl1M+k/xKR89qauOho2rdr+PVnD5IzVfFJqmw2oeRvMUnhRqKdkWZDGtD0ls4X9CJq0Y9qpIinKjRRG5OU71/zUwOX',
    );
    final proof = ElvishSrpClient.clientProof(
      state: state,
      saltB64: 'BwoNEBMWGRwfIiUoKy4xNA==',
      serverPublicB64:
          'CbZ7yCw5cg6s95+tacMFT6gtwHWqZsPbEX6bIZr9CqJnvN5r/fd31bJbLFxRAZ0IpaG9BYoK/6hOOYbga2NrTScI+5iUZ82flrstlOJL+fX/fE1cZvEVsh6pTZcOGHSg+GXQNdwKLvOuMQJztCRTMX+aw+dgrbtrV7rMiM3AoyBg9DDhrYtPBuim',
    );
    expect(proof.clientProofB64, 'XaQQlEWw9Y374aQpW6Bi5QiZgrhhPLht+feUhGcms0s=');
    expect(proof.expectedServerProofB64, 'vqfmEejEQ9xHH30uKhomVMf6CyN+2wLPKdg1MERhzFY=');
  });
}
