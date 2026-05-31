import 'package:flutter/material.dart';

/// Material Design 3 application theming.
///
/// Reference: [Material Design 3 for Flutter](https://m3.material.io/develop/flutter)
/// (use `ThemeData.useMaterial3`, `ColorScheme.fromSeed`, and M3 components such as
/// [NavigationDrawer], [FilledButton], [SegmentedButton], [Card.filled]).
class ElvishMaterial3Theme {
  ElvishMaterial3Theme._();

  /// Seed tuned for a mail / “forest” identity while staying within M3 tonal palettes.
  static const Color seedColor = Color(0xFF386A20);

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: seedColor,
      brightness: brightness,
    );

    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      visualDensity: VisualDensity.standard,
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 3,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        surfaceTintColor: colorScheme.surfaceTint,
      ),
      navigationDrawerTheme: NavigationDrawerThemeData(
        indicatorShape: shape,
        indicatorColor: colorScheme.secondaryContainer,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        clipBehavior: Clip.antiAlias,
        color: colorScheme.surfaceContainerLow,
        surfaceTintColor: colorScheme.surfaceTint,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surfaceContainerHighest.withOpacity(brightness == Brightness.dark ? 0.35 : 0.5),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colorScheme.error),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      materialBannerTheme: MaterialBannerThemeData(
        backgroundColor: colorScheme.errorContainer,
        contentTextStyle: TextStyle(color: colorScheme.onErrorContainer),
        dividerColor: Colors.transparent,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colorScheme.primary,
        circularTrackColor: colorScheme.surfaceContainerHighest,
      ),
      dividerTheme: DividerThemeData(color: colorScheme.outlineVariant, thickness: 1),
    );
  }
}
