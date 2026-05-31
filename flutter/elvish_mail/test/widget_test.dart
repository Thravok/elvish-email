import 'package:flutter_test/flutter_test.dart';

import 'package:elvish_mail/theme/material3_theme.dart';

void main() {
  test('ElvishMaterial3Theme builds light and dark themes', () {
    expect(ElvishMaterial3Theme.light(), isNotNull);
    expect(ElvishMaterial3Theme.dark(), isNotNull);
  });
}
