import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebChatApi, type InitConfig, type WebChatApi } from './api';
import { subjectMac } from './visitor-subject';
import { forgetVisitorData } from '@/webchat/embed/forget-visitor';

const SDK = 'https://console.customer.com/webchat/v1/verbara-webchat.js';
const EMBED = 'https://console.customer.com';
const TENANT = 't-demo-0001';
const RECORD = `verbara-webchat-subject:${TENANT}`;
const VISITOR = `verbara-webchat-visitor:${TENANT}`;
const PROFILE = `verbara-webchat-profile:${TENANT}`;

function segment(value: unknown): string {
  return btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
/** Not signed: the SDK never checks a token, and these stay in this test. */
function tokenFor(externalId: string, nonce = 'n1'): string {
  return `${segment({ alg: 'HS256' })}.${segment({ external_id: externalId, nonce })}.signature`;
}
const A = 'cust-a';
const B = 'cust-b';
const UNREADABLE = 'unreadable-token-value';

interface Sent {
  frame: HTMLIFrameElement;
  type: string;
  payload?: Record<string, unknown>;
}
let sent: Sent[] = [];
let frameAnswersForget = true;
/** The frame also clears what it was asked to, on the storage this test can read: frames and page share it here. */
let frameClears = false;
const apis: WebChatApi[] = [];

function fromFrame(frame: HTMLIFrameElement, type: string, payload?: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: EMBED,
      source: frame.contentWindow,
      data: { source: 'verbara-webchat-iframe', type, payload },
    }),
  );
}

function frames(): HTMLIFrameElement[] {
  return [...document.querySelectorAll<HTMLIFrameElement>('iframe[data-verbara-webchat-iframe]')];
}

function sentTo(frame: HTMLIFrameElement, type: string): Array<Record<string, unknown>> {
  return sent.filter((m) => m.frame === frame && m.type === type).map((m) => m.payload ?? {});
}

function allSent(type: string): Sent[] {
  return sent.filter((m) => m.type === type);
}

const realSubtle = crypto.subtle;

/** Lets the digests and the forget exchanges finish: each round goes through the same worker the digests use. */
async function settle() {
  for (let i = 0; i < 6; i++) {
    await realSubtle.digest('SHA-256', new Uint8Array(1));
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

function api(): WebChatApi {
  const created = createWebChatApi({ scriptSrc: SDK, forgetTimeoutMs: 20 });
  apis.push(created);
  return created;
}

/** A tab whose widget is open and got its config: what a tab chatting looks like to the SDK. */
async function chattingTab(config: Partial<InitConfig>) {
  const known = new Set(frames());
  const tabApi = api();
  tabApi.init({ tenantId: TENANT, ...config });
  tabApi.open();
  await settle();
  const frame = frames().find((f) => !known.has(f))!;
  fromFrame(frame, 'ready');
  await settle();
  return { api: tabApi, frame, config: sentTo(frame, 'init-config')[0]! };
}

/** The frame that replaced `old`, once it has announced itself and got its config. */
async function nextFrame(old: HTMLIFrameElement, known: HTMLIFrameElement[]) {
  await settle();
  expect(old.isConnected).toBe(false);
  const frame = frames().find((f) => !known.includes(f))!;
  fromFrame(frame, 'ready');
  await settle();
  return { frame, config: sentTo(frame, 'init-config')[0]! };
}

/** What the browser delivers to every other tab when one writes the record. */
function otherTabWroteTheRecord(oldValue: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key: RECORD, oldValue, newValue }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sent = [];
  frameAnswersForget = true;
  frameClears = false;
  const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    const added = append(node);
    if (node instanceof HTMLIFrameElement) {
      vi.spyOn(node.contentWindow!, 'postMessage').mockImplementation((message: unknown) => {
        const msg = message as Omit<Sent, 'frame'>;
        sent.push({ frame: node, type: msg.type, payload: msg.payload });
        if (msg.type === 'forget-visitor' && frameClears) {
          forgetVisitorData(
            String(msg.payload?.['tenantId']),
            msg.payload?.['visitorId'] as string | undefined,
          );
        }
        if (msg.type === 'forget-visitor' && frameAnswersForget) {
          queueMicrotask(() =>
            fromFrame(node, 'visitor-forgotten', { tenantId: msg.payload?.['tenantId'] }),
          );
        }
      });
    }
    return added;
  });
});

afterEach(async () => {
  await Promise.all(apis.splice(0).map((a) => a.destroy()));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the forget table, on init', () => {
  it('Init_ShouldDoNothing_WhenNoCustomerWasSeenAndNoTokenCame', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(VISITOR, 'v-anon');
    api().init({ tenantId: TENANT });
    await settle();
    expect(allSent('forget-visitor')).toEqual([]);
    expect(localStorage.getItem(VISITOR)).toBe('v-anon');
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('Init_ShouldRecordAndKeepEverything_WhenTheFirstTokenComesWithNoPriorState', async () => {
    api().init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();
    expect(allSent('forget-visitor')).toEqual([]);
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, A));
  });

  it('Init_ShouldForgetAndRecord_WhenTheFirstTokenComesOverPriorState', async () => {
    localStorage.setItem(VISITOR, 'v-anon');
    const site = api();
    site.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();

    expect(allSent('forget-visitor')[0]?.payload).toEqual({ tenantId: TENANT });
    expect(localStorage.getItem(VISITOR)).toBeNull();
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, A));

    site.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    const config = sentTo(frame, 'init-config')[0]!;
    expect(config['visitorId']).not.toBe('v-anon');
    expect(config['identityToken']).toBe(tokenFor(A));
  });

  it('Init_ShouldForgetNothing_WhenTheSameCustomerComesWithANewerToken', async () => {
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    const before = localStorage.getItem(RECORD);
    api().init({ tenantId: TENANT, identityToken: tokenFor(A, 'newer') });
    await settle();
    expect(allSent('forget-visitor')).toEqual([]);
    expect(localStorage.getItem(VISITOR)).toBe('v-a');
    expect(localStorage.getItem(RECORD)).toBe(before);
  });

  it('Init_ShouldForgetAndRecordTheNewCustomer_WhenTheCustomerChanged', async () => {
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    api().init({ tenantId: TENANT, identityToken: tokenFor(B) });
    await settle();
    expect(allSent('forget-visitor')).toHaveLength(1);
    expect(localStorage.getItem(VISITOR)).toBeNull();
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
  });

  it('Init_ShouldKeepTheNewCustomersProfile_WhenItForgets', async () => {
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(PROFILE, JSON.stringify({ name: 'Ana', email: 'ana@x.com' }));
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    const visitor = { name: 'Bea', email: 'bea@x.com' };
    api().init({ tenantId: TENANT, identityToken: tokenFor(B), visitor });
    await settle();
    expect(JSON.parse(localStorage.getItem(PROFILE)!)).toEqual(visitor);
  });

  it('Init_ShouldForgetSilently_WhenTheTokenIsNull', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    api().init({ tenantId: TENANT, identityToken: null });
    await settle();
    expect(allSent('forget-visitor')).toHaveLength(1);
    expect(localStorage.getItem(VISITOR)).toBeNull();
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('Init_ShouldForgetAndWarn_WhenTheTokenIsOmittedAfterASignIn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    api().init({ tenantId: TENANT });
    await settle();
    expect(allSent('forget-visitor')).toHaveLength(1);
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const text = String(warn.mock.calls[0]![0]);
    expect(text).toContain('no identityToken was passed');
    expect(text).toContain('destroy()');
  });

  it('Init_ShouldDoNothing_WhenAnUndecodableTokenComesWithNoCustomerRecorded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(VISITOR, 'v-anon');
    const site = api();
    site.init({ tenantId: TENANT, identityToken: UNREADABLE });
    await settle();
    expect(allSent('forget-visitor')).toEqual([]);
    expect(localStorage.getItem(VISITOR)).toBe('v-anon');
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).not.toHaveBeenCalled();

    site.open();
    await settle();
    fromFrame(frames().at(-1)!, 'ready');
    expect(sentTo(frames().at(-1)!, 'init-config')[0]?.['identityToken']).toBe(UNREADABLE);
  });

  it('Init_ShouldForgetAndWarnWithItsOwnText_WhenAnUndecodableTokenComesAfterASignIn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    api().init({ tenantId: TENANT, identityToken: UNREADABLE });
    await settle();
    expect(allSent('forget-visitor')).toHaveLength(1);
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const text = String(warn.mock.calls[0]![0]);
    expect(text).toContain('payload could not be read');
    expect(text).not.toContain('no identityToken was passed');
    expect(text).not.toContain(UNREADABLE);
  });

  it('Open_ShouldCreateTheFrame_OnlyAfterTheForgetHasFinished', async () => {
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    frameAnswersForget = false;
    const site = api();
    site.init({ tenantId: TENANT, identityToken: tokenFor(B) });
    site.open();
    await settle();

    const forgetting = frames();
    expect(forgetting).toHaveLength(1);
    expect(forgetting[0]!.style.display).toBe('none');

    await vi.waitFor(() => expect(forgetting[0]!.isConnected).toBe(false));
    await vi.waitFor(() => expect(frames()).toHaveLength(1));
    expect(frames()[0]!.style.display).toBe('block');
  });

  it('Init_ShouldNotForget_WhenTheSameCustomerInitializesTheRunningWidgetAgain', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const visitorId = tab.config['visitorId'];

    tab.api.init({ tenantId: TENANT, identityToken: tokenFor(A, 'newer') });
    await settle();

    expect(allSent('forget-visitor')).toEqual([]);
    expect(localStorage.getItem(VISITOR)).toBe(visitorId);
    expect(tab.frame.isConnected).toBe(false);
  });

  it('Init_ShouldForget_WhenAnotherCustomerInitializesTheRunningWidget', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });

    tab.api.init({ tenantId: TENANT, identityToken: tokenFor(B) });
    await settle();

    expect(allSent('forget-visitor').length).toBeGreaterThan(0);
    expect(localStorage.getItem(VISITOR)).not.toBe(tab.config['visitorId']);
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
  });
});

describe('the forget table, on setVisitor', () => {
  it('SetVisitor_ShouldEndTheChatAndStartAtOnce_WhenTheFirstTokenComesOverAnAnonymousChat', async () => {
    const tab = await chattingTab({});
    const known = frames();

    tab.api.setVisitor({ identityToken: tokenFor(A) });
    const next = await nextFrame(tab.frame, known);

    expect(sentTo(tab.frame, 'forget-visitor')[0]).toEqual({ tenantId: TENANT });
    expect(next.config['visitorId']).not.toBe(tab.config['visitorId']);
    expect(next.config['identityToken']).toBe(tokenFor(A));
    expect(next.config['startSession']).toBe(true);
    expect(next.frame.style.display).toBe('block');
  });

  it('SetVisitor_ShouldLeaveTheLiveWidgetAlone_WhenTheSameCustomersTokenIsRefreshed', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const refreshed = tokenFor(A, 'newer');

    tab.api.setVisitor({ identityToken: refreshed });
    await settle();

    expect(tab.frame.isConnected).toBe(true);
    expect(allSent('forget-visitor')).toEqual([]);
    expect(sentTo(tab.frame, 'set-visitor')).toEqual([{ identityToken: refreshed }]);
    expect(localStorage.getItem(VISITOR)).toBe(tab.config['visitorId']);
  });

  it('SetVisitor_ShouldForget_AndStartTheNewCustomerAtOnce_WhenTheCustomerChanges', async () => {
    const tab = await chattingTab({
      identityToken: tokenFor(A),
      visitor: { name: 'Ana', email: 'ana@x.com' },
    });
    const known = frames();

    tab.api.setVisitor({ identityToken: tokenFor(B) });
    const next = await nextFrame(tab.frame, known);

    expect(next.config['visitorId']).not.toBe(tab.config['visitorId']);
    expect(next.config['identityToken']).toBe(tokenFor(B));
    expect(next.config['startSession']).toBe(true);
    expect(next.config['visitor']).toBeUndefined();
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
  });

  it('SetVisitor_ShouldForgetWithoutAWarning_AndNotStartASession_WhenTheCustomerSignsOut', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();

    tab.api.setVisitor({ identityToken: null });
    const next = await nextFrame(tab.frame, known);

    expect(next.config['identityToken']).toBeUndefined();
    expect(next.config['startSession']).toBeUndefined();
    expect(next.config['visitorId']).not.toBe(tab.config['visitorId']);
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('SetVisitor_ShouldChangeNothing_WhenTheTokenIsOmitted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const record = localStorage.getItem(RECORD);

    tab.api.setVisitor({ name: 'Ana' });
    await settle();

    expect(tab.frame.isConnected).toBe(true);
    expect(allSent('forget-visitor')).toEqual([]);
    expect(localStorage.getItem(RECORD)).toBe(record);
    expect(warn).not.toHaveBeenCalled();
  });

  it('SetVisitor_ShouldReplaceTheTokenAndSendItUnchanged_WhenItDoesNotDecode_WithNoCustomerRecorded', async () => {
    const tab = await chattingTab({ identityToken: 'earlier-unreadable' });

    tab.api.setVisitor({ identityToken: UNREADABLE });
    await settle();

    expect(tab.frame.isConnected).toBe(true);
    expect(sentTo(tab.frame, 'set-visitor')).toEqual([{ identityToken: UNREADABLE }]);
    expect(localStorage.getItem(RECORD)).toBeNull();
  });

  it('SetVisitor_ShouldForgetWarnAndCarryTheTokenUnchanged_WhenItDoesNotDecode_AfterASignIn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();

    tab.api.setVisitor({ identityToken: UNREADABLE });
    const next = await nextFrame(tab.frame, known);

    expect(next.config['identityToken']).toBe(UNREADABLE);
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('payload could not be read');
    expect(String(warn.mock.calls[0]![0])).not.toContain(UNREADABLE);
  });

  it('SetVisitor_ShouldApplyTheStatementsInTheOrderTheSiteMadeThem', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();

    tab.api.setVisitor({ identityToken: tokenFor(B) });
    tab.api.setVisitor({ identityToken: null });
    const next = await nextFrame(tab.frame, known);

    expect(next.config['identityToken']).toBeUndefined();
    expect(localStorage.getItem(RECORD)).toBeNull();
  });

  it('Ready_ShouldWaitForAPendingDecision_WhenTheFrameAnnouncesItselfMeanwhile', async () => {
    localStorage.setItem(VISITOR, 'v-anon');
    const site = api();
    site.init({ tenantId: TENANT });
    site.open();
    const frame = frames()[0]!;

    site.setVisitor({ identityToken: tokenFor(A) });
    fromFrame(frame, 'ready');

    expect(sentTo(frame, 'init-config')).toEqual([]);
    await settle();
    expect(frame.isConnected).toBe(false);
    expect(sentTo(frame, 'init-config')).toEqual([]);
  });

  it('Message_ShouldNotSurviveTheForget_WhenTheSiteQueuedOneBeforeTheFrameWasReady', async () => {
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    const site = api();
    site.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    site.sendMessage('from A');
    await settle();
    site.setVisitor({ identityToken: tokenFor(B) });
    await settle();
    site.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'send-message')).toEqual([]);
  });
});

describe('what the browser keeps of a customer', () => {
  it('Record_ShouldHoldNeitherTheIdNorTheToken', async () => {
    const token = tokenFor('cust-48151623');
    api().init({ tenantId: TENANT, identityToken: token });
    await settle();
    const held = Object.keys(localStorage)
      .flatMap((key) => [key, localStorage.getItem(key)])
      .join('|');
    expect(held).not.toContain('cust-48151623');
    for (const part of token.split('.')) expect(held).not.toContain(part);
  });

  it('Record_ShouldDiffer_BetweenTwoBrowsersOfTheSameCustomer', async () => {
    const one = api();
    one.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();
    const first = localStorage.getItem(RECORD);
    localStorage.clear(); // the second browser: nothing shared
    const two = api();
    two.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();
    expect(localStorage.getItem(RECORD)).not.toBeNull();
    expect(localStorage.getItem(RECORD)).not.toBe(first);
  });

  it('Destroy_ShouldEmptyTheRecord_SoTheNextAnonymousInitDoesNotWarn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    await tab.api.destroy();
    expect(localStorage.getItem(RECORD)).toBeNull();

    tab.api.init({ tenantId: TENANT });
    await settle();
    expect(warn).not.toHaveBeenCalled();
  });

  it('InsecurePage_ShouldKeepNoRecord_WarnOnce_AndStillSendTheToken', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', { randomUUID: () => 'v-insecure' });
    const tab = await chattingTab({ identityToken: tokenFor(A) });

    tab.api.setVisitor({ identityToken: tokenFor(B) });
    await settle();

    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(tab.frame.isConnected).toBe(true);
    expect(tab.config['identityToken']).toBe(tokenFor(A));
    expect(sentTo(tab.frame, 'set-visitor')).toEqual([{ identityToken: tokenFor(B) }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('https');
  });

  it('InsecurePage_ShouldNotWarn_WhenNoTokenIsPassed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', { randomUUID: () => 'v-insecure' });
    await chattingTab({});
    expect(warn).not.toHaveBeenCalled();
  });
});

// Every tab of the host origin shares the record, and each tab's widget, socket and messages are its own: the audit's
// case is a tab that compares only with the record, finds it already updated, and keeps showing the previous customer.
describe('each open widget answers for itself', () => {
  it('TwoTabs_ShouldBothDiscardCustomerA_WhenBsTokenReachesThemOneAfterTheOther', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });
    const visitorA = tab1.config['visitorId'];
    expect(tab2.config['visitorId']).toBe(visitorA);

    let known = frames();
    tab1.api.setVisitor({ identityToken: tokenFor(B) });
    const next1 = await nextFrame(tab1.frame, known);
    expect(tab2.frame.isConnected).toBe(true); // the site has told only tab 1, and the browser has not delivered yet

    known = frames();
    tab2.api.setVisitor({ identityToken: tokenFor(B) });
    const next2 = await nextFrame(tab2.frame, known);

    // Tab 1 forgot for the browser; tab 2 cleared what its own visitor still held, and only that.
    expect(sentTo(tab1.frame, 'forget-visitor')[0]).toEqual({ tenantId: TENANT });
    expect(sentTo(tab2.frame, 'forget-visitor')[0]).toEqual({
      tenantId: TENANT,
      visitorId: visitorA,
    });
    for (const next of [next1, next2]) {
      expect(next.config['visitorId']).not.toBe(visitorA);
      expect(next.config['identityToken']).toBe(tokenFor(B));
      expect(next.config['startSession']).toBe(true);
    }
    expect(next2.config['visitorId']).toBe(next1.config['visitorId']);
    expect(localStorage.getItem(VISITOR)).toBe(next1.config['visitorId']);
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
  });

  it('TwoTabs_ShouldBothDiscardCustomerA_WhenTheSignOutReachesThemOneAfterTheOther', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });
    const visitorA = tab1.config['visitorId'];

    let known = frames();
    tab1.api.setVisitor({ identityToken: null });
    const next1 = await nextFrame(tab1.frame, known);
    known = frames();
    tab2.api.setVisitor({ identityToken: null });
    const next2 = await nextFrame(tab2.frame, known);

    expect(sentTo(tab2.frame, 'forget-visitor')[0]).toEqual({
      tenantId: TENANT,
      visitorId: visitorA,
    });
    for (const next of [next1, next2]) {
      expect(next.config['visitorId']).not.toBe(visitorA);
      expect(next.config['identityToken']).toBeUndefined();
      expect(next.config['startSession']).toBeUndefined();
    }
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('TwoTabs_ShouldDiscardWithTheUndecodableWarning_WhenSuchATokenReachesTheSecondTab', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });

    let known = frames();
    tab1.api.setVisitor({ identityToken: null });
    await nextFrame(tab1.frame, known);
    known = frames();
    tab2.api.setVisitor({ identityToken: UNREADABLE });
    const next2 = await nextFrame(tab2.frame, known);

    expect(next2.config['identityToken']).toBe(UNREADABLE);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('payload could not be read');
  });

  it('ATabTheSiteNeverTold_ShouldDiscardCustomerAAndDropTheToken_WhenAnotherTabForgets', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({
      identityToken: tokenFor(A),
      visitor: { name: 'Ana', email: 'ana@x.com' },
    });
    const recordA = localStorage.getItem(RECORD);

    let known = frames();
    tab1.api.setVisitor({ identityToken: null });
    await nextFrame(tab1.frame, known);

    known = frames();
    otherTabWroteTheRecord(recordA, null);
    const next2 = await nextFrame(tab2.frame, known);

    expect(next2.config['identityToken']).toBeUndefined();
    expect(next2.config['startSession']).toBeUndefined();
    expect(next2.config['visitor']).toBeUndefined();
    expect(next2.config['visitorId']).not.toBe(tab2.config['visitorId']);
  });

  it('ATabTheSiteNeverTold_ShouldStartTheCustomerAtOnce_WhenALaterTokenReachesIt', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });
    const recordA = localStorage.getItem(RECORD);

    let known = frames();
    tab1.api.setVisitor({ identityToken: tokenFor(B) });
    await nextFrame(tab1.frame, known);
    known = frames();
    otherTabWroteTheRecord(recordA, localStorage.getItem(RECORD));
    const discarded = await nextFrame(tab2.frame, known);
    expect(discarded.config['identityToken']).toBeUndefined();

    known = frames();
    tab2.api.setVisitor({ identityToken: tokenFor(B) });
    const next2 = await nextFrame(discarded.frame, known);

    expect(next2.config['identityToken']).toBe(tokenFor(B));
    expect(next2.config['startSession']).toBe(true);
  });

  it('AClosedTabWithAToken_ShouldNotSendIt_AfterAnotherTabForgets', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const quiet = api();
    quiet.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();
    const recordA = localStorage.getItem(RECORD);

    const known = frames();
    tab1.api.setVisitor({ identityToken: null });
    await nextFrame(tab1.frame, known);
    otherTabWroteTheRecord(recordA, null);
    await settle();

    quiet.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'init-config')[0]).not.toHaveProperty('identityToken');
  });

  it('ATabOfTheSignedInCustomer_ShouldDiscardNothing_WhenTheRecordIsThatCustomer', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const record = localStorage.getItem(RECORD);

    otherTabWroteTheRecord(null, record);
    await settle();

    expect(tab.frame.isConnected).toBe(true);
    expect(allSent('forget-visitor')).toEqual([]);
  });

  it('ATab_ShouldIgnoreOtherKeys_AndAnotherTenantsRecord', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'verbara-webchat-subject:other', newValue: 'x' }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: VISITOR, newValue: null }));
    await settle();

    expect(tab.frame.isConnected).toBe(true);
  });

  it('ATab_ShouldDiscard_WhenTheSiteClearsTheStorage', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();

    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    const next = await nextFrame(tab.frame, known);

    expect(next.config['identityToken']).toBeUndefined();
  });

  it('ADestroyedTab_ShouldHearNothing_FromAnotherTab', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    await tab.api.destroy();
    const before = sent.length;

    otherTabWroteTheRecord(null, 'another');
    await settle();

    expect(sent.length).toBe(before);
    expect(frames()).toEqual([]);
  });

  it('TwoTabsOfASiteWithNoToken_ShouldLeaveTheOtherWidget_WhenOneIsDestroyed', async () => {
    const tab1 = await chattingTab({});
    const tab2 = await chattingTab({});

    await tab1.api.destroy();
    await settle();

    // No record was ever written, so the browser delivers no event to tab 2.
    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(tab2.frame.isConnected).toBe(true);
    expect(sentTo(tab2.frame, 'forget-visitor')).toEqual([]);
  });

  it('ADiscard_ShouldLoadNoFrameToClear_WhenThisWidgetHadNotGotItsConfigYet', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();
    const quiet = api();
    quiet.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();
    quiet.open();
    await settle();
    const unready = frames().find((f) => !known.includes(f))!;
    const recordA = localStorage.getItem(RECORD);

    const before = frames();
    tab1.api.setVisitor({ identityToken: null });
    await nextFrame(tab1.frame, before);
    otherTabWroteTheRecord(recordA, null);
    await settle();

    expect(unready.isConnected).toBe(false);
    expect(sentTo(unready, 'forget-visitor')).toEqual([]);
  });

  it('ADiscard_ShouldReplaceTheFrame_WhenItDoesNotAnswer', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();
    tab1.api.setVisitor({ identityToken: null });
    await nextFrame(tab1.frame, known);

    frameAnswersForget = false;
    tab2.api.setVisitor({ identityToken: null });
    await vi.waitFor(() => expect(tab2.frame.isConnected).toBe(false));
  });
});

describe('a tab that discarded because of another tab', () => {
  const PROFILE_B = { name: 'Bea', email: 'bea@x.com' };
  const PROFILE_A = { name: 'Ana', email: 'ana@x.com' };

  /** Tab 1 and tab 2 chat as A; the site signs B in on tab 1, with B's name and e-mail, and tab 2 hears of it. */
  async function bSignedInOnTabOne() {
    const tab1 = await chattingTab({ identityToken: tokenFor(A), visitor: PROFILE_A });
    const tab2 = await chattingTab({ identityToken: tokenFor(A), visitor: PROFILE_A });
    const recordA = localStorage.getItem(RECORD);
    let known = frames();
    tab1.api.setVisitor({ ...PROFILE_B, identityToken: tokenFor(B) });
    const next1 = await nextFrame(tab1.frame, known);
    known = frames();
    otherTabWroteTheRecord(recordA, localStorage.getItem(RECORD));
    const discarded = await nextFrame(tab2.frame, known);
    return { tab1, tab2, next1, discarded };
  }

  it('ATabTheSiteNeverTold_ShouldNotBeHandedTheOtherTabsProfile_SoItStartsNoSessionOfItsOwn', async () => {
    const { next1, discarded } = await bSignedInOnTabOne();

    // Tab 1 is the one the site told: it starts B at once, with the token and B's name.
    expect(next1.config['identityToken']).toBe(tokenFor(B));
    expect(next1.config['startSession']).toBe(true);
    expect(next1.config['visitor']).toEqual(PROFILE_B);

    expect(discarded.config['visitorId']).not.toBe(next1.config['visitorId']);
    expect(discarded.config).not.toHaveProperty('identityToken');
    expect(discarded.config).not.toHaveProperty('startSession');
    expect(discarded.config['visitor']).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(PROFILE)!)).toEqual(PROFILE_B);
  });

  it('ATabThatNeverOpened_ShouldNotBeHandedTheOtherTabsProfile_WhenTheVisitorOpensIt', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const quiet = api();
    quiet.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();
    const recordA = localStorage.getItem(RECORD);
    const known = frames();
    tab1.api.setVisitor({ ...PROFILE_B, identityToken: tokenFor(B) });
    await nextFrame(tab1.frame, known);
    otherTabWroteTheRecord(recordA, localStorage.getItem(RECORD));
    await settle();

    quiet.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();

    const config = sentTo(frame, 'init-config')[0]!;
    expect(config['visitor']).toBeUndefined();
    expect(config).not.toHaveProperty('identityToken');
  });

  it('ADiscardedTab_ShouldStartTheCustomerWithTheirProfile_WhenTheSiteCallsSetVisitorWithBoth', async () => {
    const { tab2, next1, discarded } = await bSignedInOnTabOne();

    const known = frames();
    tab2.api.setVisitor({ ...PROFILE_B, identityToken: tokenFor(B, 'n2') });
    const told = await nextFrame(discarded.frame, known);

    expect(told.config['visitorId']).toBe(next1.config['visitorId']);
    expect(told.config['identityToken']).toBe(tokenFor(B, 'n2'));
    expect(told.config['startSession']).toBe(true);
    expect(told.config['visitor']).toEqual(PROFILE_B);
  });

  it('ADiscardedTab_ShouldGetTheTokenAndTheProfile_WhenTheSiteCallsInitWithBoth', async () => {
    const { tab2 } = await bSignedInOnTabOne();

    const known = frames();
    tab2.api.init({ tenantId: TENANT, identityToken: tokenFor(B, 'n2'), visitor: PROFILE_B });
    tab2.api.open();
    await settle();
    const frame = frames().find((f) => !known.includes(f))!;
    fromFrame(frame, 'ready');
    await settle();

    const config = sentTo(frame, 'init-config')[0]!;
    expect(config['identityToken']).toBe(tokenFor(B, 'n2'));
    expect(config['visitor']).toEqual(PROFILE_B);
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
  });

  it('ANewPageOfTheNewCustomer_ShouldGetTheTokenAndTheProfile_WhenTheSiteCallsInitWithBoth', async () => {
    const { next1 } = await bSignedInOnTabOne();

    const page = await chattingTab({ identityToken: tokenFor(B, 'n3'), visitor: PROFILE_B });

    expect(page.config['visitorId']).toBe(next1.config['visitorId']);
    expect(page.config['identityToken']).toBe(tokenFor(B, 'n3'));
    expect(page.config['visitor']).toEqual(PROFILE_B);
  });

  it('ADiscardedTab_ShouldKeepWhatTheNewCustomerHolds_WhenTheTokenReachesIt', async () => {
    const { tab2, next1, discarded } = await bSignedInOnTabOne();
    const visitorB = String(next1.config['visitorId']);
    const guest = String(discarded.config['visitorId']);
    const QUEUE = `verbara-webchat-queue:${TENANT}:${visitorB}`;
    const MESSAGES = `verbara-webchat-messages:${TENANT}:${visitorB}`;
    const SESSION = `verbara-webchat-session:${TENANT}`;
    const queued = JSON.stringify([{ text: 'waiting to be sent', queuedAt: 1 }]);
    const session = JSON.stringify({ sessionId: 's', visitorId: visitorB });
    localStorage.setItem(QUEUE, queued);
    localStorage.setItem(MESSAGES, '[]');
    localStorage.setItem(SESSION, session);
    frameClears = true;

    const known = frames();
    tab2.api.setVisitor({ identityToken: tokenFor(B) });
    const told = await nextFrame(discarded.frame, known);

    expect(sentTo(discarded.frame, 'forget-visitor')).toEqual([
      { tenantId: TENANT, visitorId: guest },
    ]);
    expect(localStorage.getItem(QUEUE)).toBe(queued);
    expect(localStorage.getItem(MESSAGES)).toBe('[]');
    expect(localStorage.getItem(SESSION)).toBe(session);
    expect(told.config['visitorId']).toBe(visitorB);
    expect(told.config['identityToken']).toBe(tokenFor(B));
    expect(told.config['startSession']).toBe(true);
    expect(told.config).not.toHaveProperty('guest');
  });

  it('ADiscard_ShouldStillClearTheOlderVisitor_WhenTheTabRunsUnderAnIdThatIsNoLongerShared', async () => {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });
    const visitorA = String(tab1.config['visitorId']);
    const QUEUE = `verbara-webchat-queue:${TENANT}:${visitorA}`;
    let known = frames();
    tab1.api.setVisitor({ identityToken: tokenFor(B) });
    await nextFrame(tab1.frame, known);
    localStorage.setItem(QUEUE, JSON.stringify([{ text: 'of A' }]));
    frameClears = true;

    known = frames();
    tab2.api.setVisitor({ identityToken: tokenFor(B) });
    await nextFrame(tab2.frame, known);

    expect(sentTo(tab2.frame, 'forget-visitor')[0]).toEqual({
      tenantId: TENANT,
      visitorId: visitorA,
    });
    expect(localStorage.getItem(QUEUE)).toBeNull();
  });
});

describe('a tab with no customer of its own while the browser has one', () => {
  const PROFILE_B = { name: 'Bea', email: 'bea@x.com' };

  /** Tabs 1 and 2 chat as A, B signs in on tab 1, tab 2 hears of it and gets its next frame. */
  async function untoldTab() {
    const tab1 = await chattingTab({ identityToken: tokenFor(A) });
    const tab2 = await chattingTab({ identityToken: tokenFor(A) });
    const recordA = localStorage.getItem(RECORD);
    let known = frames();
    tab1.api.setVisitor({ ...PROFILE_B, identityToken: tokenFor(B) });
    const next1 = await nextFrame(tab1.frame, known);
    known = frames();
    otherTabWroteTheRecord(recordA, localStorage.getItem(RECORD));
    const untold = await nextFrame(tab2.frame, known);
    return { tab1, tab2, next1, untold, visitorB: String(next1.config['visitorId']) };
  }

  it('AnUntoldTab_ShouldRunUnderAnIdOfItsOwn_SoItCannotReachTheCustomersSessionOrMessages', async () => {
    const { untold, visitorB } = await untoldTab();

    expect(localStorage.getItem(VISITOR)).toBe(visitorB);
    expect(untold.config['visitorId']).toBeTruthy();
    expect(untold.config['visitorId']).not.toBe(visitorB);
    expect(untold.config['guest']).toBe(true);
    expect(untold.config).not.toHaveProperty('identityToken');
    expect(untold.config['visitor']).toBeUndefined();
  });

  it('AnUntoldTab_ShouldLeaveTheStoredProfile_WhenTheVisitorFillsItsForm', async () => {
    const { untold } = await untoldTab();

    fromFrame(untold.frame, 'visitor-updated', { name: 'Someone', email: 'someone@x.com' });
    await settle();

    expect(JSON.parse(localStorage.getItem(PROFILE)!)).toEqual(PROFILE_B);
  });

  it('AnUntoldTab_ShouldBeDiscarded_WhenTheCustomerSignsOutOnTheOtherTab', async () => {
    const { tab1, tab2, untold, next1 } = await untoldTab();
    void tab2;
    const guest = String(untold.config['visitorId']);
    const recordB = localStorage.getItem(RECORD);
    const known = frames();

    tab1.api.setVisitor({ identityToken: null });
    await nextFrame(next1.frame, known);
    expect(localStorage.getItem(RECORD)).toBeNull();
    const before = frames();
    otherTabWroteTheRecord(recordB, null);
    const after = await nextFrame(untold.frame, before);

    expect(sentTo(untold.frame, 'forget-visitor')).toEqual([
      { tenantId: TENANT, visitorId: guest },
    ]);
    expect(after.config).not.toHaveProperty('guest');
    expect(after.config['visitor']).toBeUndefined();
    expect(after.config['visitorId']).toBe(localStorage.getItem(VISITOR));
  });

  it('ATabRunningUnderAnIdThatWasReset_ShouldBeDiscarded_EvenWhenNoCustomerIsOnEitherSide', async () => {
    const tab = await chattingTab({});
    const before = frames();
    localStorage.removeItem(VISITOR);

    otherTabWroteTheRecord('some-earlier-record', null);
    const next = await nextFrame(tab.frame, before);

    expect(sentTo(tab.frame, 'forget-visitor')).toEqual([
      { tenantId: TENANT, visitorId: tab.config['visitorId'] },
    ]);
    expect(next.config['visitorId']).not.toBe(tab.config['visitorId']);
  });

  it('ATabWithNoToken_ShouldKeepChattingUnderTheSharedId_WhenTheRecordEventChangesNothing', async () => {
    const tab = await chattingTab({});

    otherTabWroteTheRecord(null, null);
    await settle();

    expect(tab.frame.isConnected).toBe(true);
    expect(tab.config['visitorId']).toBe(localStorage.getItem(VISITOR));
    expect(tab.config).not.toHaveProperty('guest');
    expect(sentTo(tab.frame, 'forget-visitor')).toEqual([]);
  });

  it('ATabOfTheCustomer_ShouldKeepItsToken_WhenItRunsUnderAnOlderIdAndTheRecordIsItsOwn', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    localStorage.setItem(VISITOR, 'a-later-id');
    const record = localStorage.getItem(RECORD);

    otherTabWroteTheRecord(record, record);
    await settle();

    expect(tab.frame.isConnected).toBe(true);
  });

  it('Init_ShouldForgetNothing_WhenAnUntoldTabIsInitializedWithTheCustomerTheRecordHolds', async () => {
    const { tab2, tab1, next1, untold, visitorB } = await untoldTab();
    void tab1;
    const SESSION = `verbara-webchat-session:${TENANT}`;
    const MESSAGES = `verbara-webchat-messages:${TENANT}:${visitorB}`;
    const session = JSON.stringify({ sessionId: 's', visitorId: visitorB });
    localStorage.setItem(SESSION, session);
    localStorage.setItem(MESSAGES, '[{"id":"m"}]');
    const recordB = localStorage.getItem(RECORD);
    frameClears = true;
    const guest = String(untold.config['visitorId']);

    const known = frames();
    const forgetsBefore = allSent('forget-visitor').length;
    tab2.api.init({ tenantId: TENANT, identityToken: tokenFor(B, 'newer') });
    tab2.api.open();
    await settle();

    const forgets = allSent('forget-visitor').slice(forgetsBefore);
    expect(forgets.map((m) => m.payload)).toEqual([{ tenantId: TENANT, visitorId: guest }]);
    expect(sentTo(untold.frame, 'forget-visitor')).toEqual([
      { tenantId: TENANT, visitorId: guest },
    ]);
    expect(localStorage.getItem(VISITOR)).toBe(visitorB);
    expect(localStorage.getItem(RECORD)).toBe(recordB);
    expect(localStorage.getItem(SESSION)).toBe(session);
    expect(localStorage.getItem(MESSAGES)).toBe('[{"id":"m"}]');
    // Tab 1 keeps chatting: its frame stays, and nothing was asked of it.
    expect(next1.frame.isConnected).toBe(true);
    expect(sentTo(next1.frame, 'forget-visitor')).toEqual([]);
    const frame = frames().find((f) => !known.includes(f))!;
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'init-config')[0]!['visitorId']).toBe(visitorB);
    expect(sentTo(frame, 'init-config')[0]!['identityToken']).toBe(tokenFor(B, 'newer'));
  });

  it('AQueuedStorageStep_ShouldNotUndoWhatTheSiteSaidAfterIt_WhenItRunsBehindAForget', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    frameAnswersForget = false;
    const known = frames();
    tab.api.setVisitor({ identityToken: null });
    const recordC = await subjectMac(TENANT, 'cust-c');
    localStorage.setItem(RECORD, recordC);

    otherTabWroteTheRecord(null, recordC);
    tab.api.setVisitor({ ...PROFILE_B, identityToken: tokenFor(B) });
    for (let i = 0; i < 6; i++) await settle();

    const frame = frames()
      .filter((f) => !known.includes(f))
      .at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    const config = sentTo(frame, 'init-config')[0]!;
    expect(config['identityToken']).toBe(tokenFor(B));
    expect(config['visitor']).toEqual(PROFILE_B);
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
  });

  it('AQueuedStorageStep_ShouldNotHoldTheWidget_WhenTheRecordCannotBeRead', async () => {
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const known = frames();
    frameAnswersForget = false;
    tab.api.setVisitor({ identityToken: null });
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === RECORD) throw new DOMException('denied', 'SecurityError');
      return read.call(this, key);
    });

    otherTabWroteTheRecord(null, null);
    await settle();
    await settle();

    const frame = frames()
      .filter((f) => !known.includes(f))
      .at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'init-config')).toHaveLength(1);
  });
});

describe('when the browser refuses to store the record', () => {
  /** Only the record fails: everything else of this origin still stores. */
  function recordCannotBeWritten() {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === RECORD) throw new DOMException('full', 'QuotaExceededError');
      write.call(this, key, value);
    });
  }

  function silenced() {
    return vi.spyOn(console, 'warn').mockImplementation(() => {});
  }

  it('Init_ShouldStillOpenAndDestroy_WhenTheFirstRecordCannotBeWritten', async () => {
    const warn = silenced();
    recordCannotBeWritten();
    const tab = api();
    tab.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();

    tab.open();
    await settle();
    const frame = frames().at(-1)!;
    expect(frame.style.display).not.toBe('none');
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'init-config')[0]!['identityToken']).toBe(tokenFor(A));

    await expect(tab.destroy()).resolves.toBeUndefined();
    expect(sentTo(frame, 'forget-visitor')).toEqual([{ tenantId: TENANT }]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('could not store');
    expect(String(warn.mock.calls[0]![0])).not.toContain(tokenFor(A));
  });

  it('Init_ShouldStillForgetAndLeaveNoStaleRecord_WhenTheNewCustomerCannotBeRecorded', async () => {
    const warn = silenced();
    localStorage.setItem(VISITOR, 'v-a');
    localStorage.setItem(RECORD, await subjectMac(TENANT, A));
    recordCannotBeWritten();

    const tab = api();
    tab.init({ tenantId: TENANT, identityToken: tokenFor(B) });
    await settle();

    expect(allSent('forget-visitor')[0]?.payload).toEqual({ tenantId: TENANT });
    expect(localStorage.getItem(RECORD)).toBeNull();
    tab.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    const config = sentTo(frame, 'init-config')[0]!;
    expect(config['identityToken']).toBe(tokenFor(B));
    expect(config['visitorId']).not.toBe('v-a');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('SetVisitor_ShouldNotLeaveTheWidgetStuck_WhenTheRecordCannotBeWritten', async () => {
    const warn = silenced();
    const tab = await chattingTab({});
    recordCannotBeWritten();

    const known = frames();
    tab.api.setVisitor({ identityToken: tokenFor(A) });
    const next = await nextFrame(tab.frame, known);

    expect(next.config['identityToken']).toBe(tokenFor(A));
    await tab.api.destroy();
    expect(sentTo(next.frame, 'forget-visitor')).toEqual([{ tenantId: TENANT }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('SetVisitor_ShouldStillStartTheNewCustomer_WhenTheProfileCannotBeStoredDuringAForget', async () => {
    const warn = silenced();
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const write = Storage.prototype.setItem;
    let profileWrites = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      // `setVisitor` stores it first, which is the site's own call; the forget stores it again.
      if (key === PROFILE && ++profileWrites === 2)
        throw new DOMException('full', 'QuotaExceededError');
      write.call(this, key, value);
    });

    const known = frames();
    tab.api.setVisitor({ name: 'Bea', email: 'bea@x.com', identityToken: tokenFor(B) });
    const next = await nextFrame(tab.frame, known);

    expect(next.config['identityToken']).toBe(tokenFor(B));
    expect(warn).not.toHaveBeenCalled();
    // The record holds B and so does this tab: another tab writing B changes nothing here.
    const recordB = await subjectMac(TENANT, B);
    expect(localStorage.getItem(RECORD)).toBe(recordB);
    otherTabWroteTheRecord(recordB, recordB);
    await settle();
    expect(next.frame.isConnected).toBe(true);
    expect(sentTo(next.frame, 'forget-visitor')).toEqual([]);
  });

  /** The forget's frame cannot be listened to: a step after the record, which is not the record's doing. */
  function forgetCannotListen() {
    const listen = window.addEventListener.bind(window);
    let refused = false;
    return vi.spyOn(window, 'addEventListener').mockImplementation(((
      type: string,
      handler: EventListener,
    ) => {
      if (type === 'message' && !refused) {
        refused = true;
        throw new Error('no listener');
      }
      listen(type, handler);
    }) as typeof window.addEventListener);
  }

  it('ALaterStepFailing_ShouldLeaveNoWarning_WhenTheRecordWasWritten', async () => {
    const warn = silenced();
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const listening = forgetCannotListen();

    tab.api.setVisitor({ identityToken: null });
    await settle();
    listening.mockRestore();

    expect(localStorage.getItem(RECORD)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    await expect(tab.api.destroy()).resolves.toBeUndefined();
  });

  it('AForgetThatCannotRunBehindAnother_ShouldNotHoldTheWidget_AndLeaveTheNewCustomerRecorded', async () => {
    const warn = silenced();
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const listening = forgetCannotListen();
    const known = frames();

    tab.api.setVisitor({ identityToken: tokenFor(B) });
    await settle();
    listening.mockRestore();

    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
    expect(warn).not.toHaveBeenCalled();
    expect(tab.frame.isConnected).toBe(false);
    const frame = frames().find((f) => !known.includes(f))!;
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'init-config')[0]!['identityToken']).toBe(tokenFor(B));
    await expect(tab.api.destroy()).resolves.toBeUndefined();
  });

  it('SetVisitor_ShouldReachTheForgetAndTheNewCustomer_WhenTheProfileCannotBeStored', async () => {
    const warn = silenced();
    const tab = await chattingTab({ identityToken: tokenFor(A) });
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === PROFILE) throw new DOMException('full', 'QuotaExceededError');
      write.call(this, key, value);
    });
    const profile = { name: 'Bea', email: 'bea@x.com' };

    const known = frames();
    expect(() => tab.api.setVisitor({ ...profile, identityToken: tokenFor(B) })).not.toThrow();
    const next = await nextFrame(tab.frame, known);

    expect(sentTo(tab.frame, 'forget-visitor')).toEqual([{ tenantId: TENANT }]);
    expect(next.config['identityToken']).toBe(tokenFor(B));
    expect(next.config['startSession']).toBe(true);
    expect(next.config['visitor']).toEqual(profile);
    expect(localStorage.getItem(RECORD)).toBe(await subjectMac(TENANT, B));
    expect(warn).not.toHaveBeenCalled();
  });

  it('Init_ShouldStartWithTheProfileInMemory_WhenTheProfileCannotBeStored', async () => {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === PROFILE) throw new DOMException('full', 'QuotaExceededError');
      write.call(this, key, value);
    });
    const profile = { name: 'Bea', email: 'bea@x.com' };

    const tab = api();
    expect(() =>
      tab.init({ tenantId: TENANT, identityToken: tokenFor(B), visitor: profile }),
    ).not.toThrow();
    tab.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();

    const config = sentTo(frame, 'init-config')[0]!;
    expect(config['identityToken']).toBe(tokenFor(B));
    expect(config['visitor']).toEqual(profile);
  });

  it('Init_ShouldStillOpenAndDestroy_WhenTheRecordCannotBeRead', async () => {
    const warn = silenced();
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === RECORD) throw new DOMException('denied', 'SecurityError');
      return read.call(this, key);
    });
    const tab = api();
    tab.init({ tenantId: TENANT, identityToken: tokenFor(A) });
    await settle();

    tab.open();
    await settle();
    const frame = frames().at(-1)!;
    fromFrame(frame, 'ready');
    await settle();
    expect(sentTo(frame, 'init-config')[0]!['identityToken']).toBe(tokenFor(A));

    await tab.destroy();
    expect(sentTo(frame, 'forget-visitor')).toEqual([{ tenantId: TENANT }]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
