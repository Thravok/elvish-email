import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// SRP-6a client matching `IOS/IOS/Auth/ElvishSRPClient.swift`, `static/auth/srp.js`,
/// and `internal/pake` (RFC 5054 2048-bit group, SHA-256).
class ElvishSrpLoginState {
  ElvishSrpLoginState({
    required this.username,
    required this.password,
    required this.a,
    required this.bigA,
    required this.clientPublicB64,
  });

  final String username;
  final String password;
  final BigInt a;
  final BigInt bigA;
  final String clientPublicB64;
}

class ElvishSrpClient {
  static const String nHex =
      'AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6096BEECFB71744F9A5B7CDBD7B3E8C94BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF';

  static final BigInt groupN = BigInt.parse(nHex, radix: 16);
  static final BigInt groupG = BigInt.two;
  static final int padLen = (nHex.length + 1) ~/ 2;

  /// [deterministicPrivateExponent] — tests only (matches Swift `deterministicPrivateExponent`).
  static ElvishSrpLoginState beginLogin(
    String username,
    String password, {
    BigInt? deterministicPrivateExponent,
  }) {
    final a = deterministicPrivateExponent ?? _randomPrivateExponent();
    final bigA = groupG.modPow(a, groupN);
    if (bigA % groupN == BigInt.zero) {
      throw StateError('invalid public');
    }
    final pub = padBig(bigA);
    return ElvishSrpLoginState(
      username: username,
      password: password,
      a: a,
      bigA: bigA,
      clientPublicB64: base64Encode(pub),
    );
  }

  static ({String clientProofB64, String expectedServerProofB64}) clientProof({
    required ElvishSrpLoginState state,
    required String saltB64,
    required String serverPublicB64,
  }) {
    final salt = Uint8List.fromList(base64Decode(saltB64));
    final serverPubBytes = Uint8List.fromList(base64Decode(serverPublicB64));
    final bigB = _bytesToBigUnsigned(serverPubBytes);
    if (bigB == BigInt.zero || bigB % groupN == BigInt.zero) {
      throw StateError('invalid public');
    }

    final k = _bytesToBigUnsigned(Uint8List.fromList(_digestParts([padBig(groupN), padBig(groupG)])));
    final u = _bytesToBigUnsigned(Uint8List.fromList(_digestParts([padBig(state.bigA), padBig(bigB)])));
    if (u == BigInt.zero) {
      throw StateError('zero scramble');
    }

    final x = _computeX(state.username, state.password, salt);
    final gx = groupG.modPow(x, groupN);
    final kgx = (k * gx) % groupN;
    final base = _modSubtract(bigB, kgx, groupN);
    final exp = state.a + u * x;
    final s = base.modPow(exp, groupN);
    final kSession = _digestParts([padBig(s)]);

    final hN = _digestParts([padBig(groupN)]);
    final hG = _digestParts([padBig(groupG)]);
    final xor = Uint8List(hN.length);
    for (var i = 0; i < xor.length; i++) {
      xor[i] = hN[i] ^ hG[i];
    }
    final userHash = _digestParts([utf8.encode(state.username)]);
    final m1 = _digestParts([xor, userHash, salt, padBig(state.bigA), padBig(bigB), kSession]);
    final m2 = _digestParts([
      _trimLeadingZeros(Uint8List.fromList(padBig(state.bigA))),
      Uint8List.fromList(m1),
      kSession,
    ]);
    return (
      clientProofB64: base64Encode(m1),
      expectedServerProofB64: base64Encode(m2),
    );
  }

  static BigInt _randomPrivateExponent() {
    final max = groupN - BigInt.two;
    final rnd = Random.secure();
    final bytes = Uint8List(32);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = rnd.nextInt(256);
    }
    final x = _bytesToBigUnsigned(bytes);
    final r = x % max;
    return r == BigInt.zero ? BigInt.one : r;
  }

  static BigInt _computeX(String username, String password, Uint8List salt) {
    final inner = _digestParts([utf8.encode('$username:$password')]);
    final outer = _digestParts([salt, Uint8List.fromList(inner)]);
    return _bytesToBigUnsigned(Uint8List.fromList(outer));
  }

  static List<int> _digestParts(List<List<int>> parts) {
    final b = BytesBuilder(copy: false);
    for (final p in parts) {
      b.add(p);
    }
    return sha256.convert(b.toBytes()).bytes;
  }

  static Uint8List padBig(BigInt v) => _toBytesBE(v, padLen);

  static Uint8List _toBytesBE(BigInt v, int length) {
    var hex = v.toRadixString(16);
    if (hex.length.isOdd) {
      hex = '0$hex';
    }
    final raw = <int>[];
    for (var i = 0; i < hex.length; i += 2) {
      raw.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    final d = Uint8List.fromList(raw);
    if (d.length >= length) {
      return d;
    }
    return Uint8List(length)
      ..setRange(0, length - d.length, List.filled(length - d.length, 0))
      ..setRange(length - d.length, length, d);
  }

  static Uint8List _trimLeadingZeros(Uint8List d) {
    var i = 0;
    while (i < d.length && d[i] == 0) {
      i++;
    }
    if (i >= d.length) {
      return Uint8List.fromList([0]);
    }
    return Uint8List.sublistView(d, i);
  }

  static BigInt _modSubtract(BigInt b, BigInt t, BigInt n) {
    final tm = t % n;
    return (b + n - tm) % n;
  }

  static BigInt _bytesToBigUnsigned(Uint8List bytes) {
    var result = BigInt.zero;
    for (final byte in bytes) {
      result = (result << 8) + BigInt.from(byte);
    }
    return result;
  }
}
