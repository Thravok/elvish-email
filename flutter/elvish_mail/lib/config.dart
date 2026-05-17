import 'package:flutter/foundation.dart';

/// Resolves API root (no trailing slash). Same role as `IOS/IOS/Config/AppEnvironment.swift`.
String resolveApiBaseUrl() {
  const fromDefine = String.fromEnvironment('ELVISH_API_BASE', defaultValue: '');
  if (fromDefine.isNotEmpty) {
    return fromDefine.replaceAll(RegExp(r'/+$'), '');
  }
  if (kIsWeb) {
    return '';
  }
  // Android emulator → host machine (default `make dev` port).
  return 'http://10.0.2.2:8765';
}
