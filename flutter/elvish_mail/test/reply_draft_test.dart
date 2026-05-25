import 'package:elvish_mail/mail/reply_draft.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('replySubjectLine prefixes Re', () {
    expect(replySubjectLine('Hello'), 'Re: Hello');
    expect(replySubjectLine('Re: Hi'), 'Re: Hi');
    expect(replySubjectLine(''), 'Re: ');
  });

  test('inbound reply addresses sender', () {
    final draft = buildReplyComposeDraft(
      message: ReplyMessageSource(
        fromAddr: 'other@elvish.test',
        toAddrs: ['me@elvish.test'],
        subject: 'Question',
        rfcMessageId: '<abc@elvish.test>',
      ),
      identityEmails: ['me@elvish.test'],
      accountEmail: 'me@elvish.test',
      replyAll: false,
    );
    expect(draft.to.toLowerCase(), contains('other@elvish.test'));
    expect(draft.subject, 'Re: Question');
    expect(draft.inReplyTo, '<abc@elvish.test>');
  });

  test('outgoing reply targets other recipients', () {
    final draft = buildReplyComposeDraft(
      message: ReplyMessageSource(
        fromAddr: 'me@elvish.test',
        toAddrs: ['a@elvish.test', 'b@elvish.test'],
        subject: 'Team',
      ),
      identityEmails: ['me@elvish.test'],
      accountEmail: 'me@elvish.test',
      replyAll: false,
    );
    expect(draft.to.toLowerCase(), contains('a@elvish.test'));
    expect(draft.to.toLowerCase(), isNot(contains('me@elvish.test')));
  });
}
