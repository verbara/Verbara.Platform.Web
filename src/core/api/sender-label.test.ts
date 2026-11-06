import { describe, expect, it } from 'vitest';
import { mapPlatformMessage } from './platform-message';
import { senderLabel } from './sender-label';
import { historyNewestMessage, historySecondMessage } from '@/tests/utils/contract-doubles';

const t = (key: string) => `t:${key}`;
const agentReply = mapPlatformMessage(historyNewestMessage);
const customerMessage = mapPlatformMessage(historySecondMessage);
const OWN_AGENT = 'a-9e8d7c6b5a493827';

describe('senderLabel', () => {
  it('senderLabel_ShouldBeYou_WhenTheReplyIsTheSignedInAgents', () => {
    expect(senderLabel(agentReply, { ownAgentId: OWN_AGENT }, t)).toBe('t:composer.you');
  });

  it('senderLabel_ShouldBeTheGenericAgentLabel_WhenTheReplyIsAnotherAgents', () => {
    expect(senderLabel(agentReply, { ownAgentId: 'a-other' }, t)).toBe(
      't:history.direction.outbound',
    );
    expect(senderLabel(agentReply, {}, t)).toBe('t:history.direction.outbound');
  });

  it('senderLabel_ShouldBeTheContactName_WhenTheMessageIsTheCustomers', () => {
    expect(senderLabel(customerMessage, { contactName: 'Ana Pereira' }, t)).toBe('Ana Pereira');
  });

  it('senderLabel_ShouldBeTheGenericCustomerLabel_WhenTheContactNameIsUnknown', () => {
    expect(senderLabel(customerMessage, { contactName: '' }, t)).toBe(
      't:history.direction.inbound',
    );
  });

  it('senderLabel_ShouldNeverBeTheSenderId_WhenAnInboundMessageCarriesOne', () => {
    const fromAddress = { ...customerMessage, senderId: '+5215512345678' };
    expect(senderLabel(fromAddress, {}, t)).toBe('t:history.direction.inbound');
    expect(senderLabel(fromAddress, { contactName: 'Ana Pereira' }, t)).toBe('Ana Pereira');
  });

  it('senderLabel_ShouldBeYou_WhenTheRowIsTheComposersPendingSend', () => {
    expect(senderLabel({ sender: 'agent', status: 'sending' }, { ownAgentId: OWN_AGENT }, t)).toBe(
      't:composer.you',
    );
  });

  it('senderLabel_ShouldBeNone_WhenTheMessageIsASystemRow', () => {
    expect(senderLabel({ sender: 'system' }, {}, t)).toBeNull();
  });
});
