import 'package:flutter/material.dart';

import 'app_state.dart';
import 'theme/material3_theme.dart';
import 'ui/login_page.dart';
import 'ui/mail_home_page.dart';
import 'ui/mfa_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final model = await ElvishAppState.create();
  await model.bootstrap();
  runApp(ElvishMailApp(model: model));
}

class ElvishMailApp extends StatelessWidget {
  const ElvishMailApp({super.key, required this.model});

  final ElvishAppState model;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ELVish Mail',
      theme: ElvishMaterial3Theme.light(),
      darkTheme: ElvishMaterial3Theme.dark(),
      themeMode: ThemeMode.system,
      home: ListenableBuilder(
        listenable: model,
        builder: (context, _) {
          if (model.mfaChallenge != null) {
            return MfaPage(model: model, challenge: model.mfaChallenge!);
          }
          if (model.currentUser == null) {
            return LoginPage(model: model);
          }
          return MailHomePage(model: model);
        },
      ),
    );
  }
}
