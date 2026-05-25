import 'package:elvish_mail/api/mail_dtos.dart';
import 'package:elvish_mail/mail/mail_filter_engine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('subject contains matches', () {
    final cond = MailFilterConditionDto(type: 'subject', op: 'contains', value: 'news');
    final ctx = MailFilterMessageContext(
      subject: 'Daily Newsletter',
      from: '',
      to: [],
      hasAttachments: false,
    );
    expect(MailFilterEngine.conditionMatches(cond, ctx), isTrue);
  });

  test('body missing fails', () {
    final cond = MailFilterConditionDto(type: 'body', op: 'contains', value: 'x');
    final ctx = MailFilterMessageContext(
      subject: '',
      from: '',
      to: [],
      hasAttachments: false,
    );
    expect(MailFilterEngine.conditionMatches(cond, ctx), isFalse);
  });

  test('pickFirstByPriority', () {
    final low = MailFilterRuleDto(
      id: 'a',
      name: 'low',
      enabled: true,
      priority: 10,
      conditions: [MailFilterConditionDto(type: 'subject', op: 'contains', value: 'a')],
      actions: [MailFilterActionDto(type: 'mark_read')],
      createdAt: '2020-01-01T00:00:00Z',
    );
    final high = MailFilterRuleDto(
      id: 'b',
      name: 'high',
      enabled: true,
      priority: 90,
      conditions: [MailFilterConditionDto(type: 'subject', op: 'contains', value: 'a')],
      actions: [MailFilterActionDto(type: 'move', value: 'archive')],
      createdAt: '2020-01-02T00:00:00Z',
    );
    final rules = MailFilterEngine.normalizeRules([low, high]);
    final ctx = MailFilterMessageContext(
      subject: 'aha',
      from: '',
      to: [],
      hasAttachments: false,
    );
    final hit = MailFilterEngine.pickFirstMatchingRule(rules, ctx);
    expect(hit?.id, 'b');
  });

  test('empty conditions never matches', () {
    final rule = MailFilterRuleDto(
      id: 'z',
      name: 'empty',
      enabled: true,
      priority: 100,
      conditions: [],
      actions: [MailFilterActionDto(type: 'mark_read')],
    );
    final ctx = MailFilterMessageContext(
      subject: 'x',
      from: '',
      to: [],
      hasAttachments: false,
    );
    expect(MailFilterEngine.ruleMatches(rule, ctx), isFalse);
  });
}
