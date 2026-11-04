import { useAuthStore } from '@/core/auth/auth-store';
import { useDraftStore } from './draft-store';

describe('DraftStore', () => {
  beforeEach(() => {
    useDraftStore.setState({ drafts: {} });
  });

  it('setDraft_ShouldStoreDraftText_WhenCalled', () => {
    useDraftStore.getState().setDraft('conv-1', 'Hello draft');
    expect(useDraftStore.getState().drafts['conv-1']).toBe('Hello draft');
  });

  it('setDraft_ShouldOverwriteExisting_WhenCalledAgain', () => {
    useDraftStore.getState().setDraft('conv-1', 'First');
    useDraftStore.getState().setDraft('conv-1', 'Second');
    expect(useDraftStore.getState().drafts['conv-1']).toBe('Second');
  });

  it('clearDraft_ShouldRemoveDraft_WhenCalled', () => {
    useDraftStore.getState().setDraft('conv-1', 'Hello');
    useDraftStore.getState().clearDraft('conv-1');
    expect(useDraftStore.getState().drafts['conv-1']).toBeUndefined();
  });

  it('clearDraft_ShouldNotAffectOtherDrafts_WhenCalled', () => {
    useDraftStore.getState().setDraft('conv-1', 'Draft 1');
    useDraftStore.getState().setDraft('conv-2', 'Draft 2');
    useDraftStore.getState().clearDraft('conv-1');
    expect(useDraftStore.getState().drafts['conv-1']).toBeUndefined();
    expect(useDraftStore.getState().drafts['conv-2']).toBe('Draft 2');
  });

  it('drafts_ShouldHaveCorrectShape_WhenMultipleDraftsStored', () => {
    useDraftStore.getState().setDraft('conv-1', 'A');
    useDraftStore.getState().setDraft('conv-2', 'B');
    const { drafts } = useDraftStore.getState();
    expect(drafts).toEqual({ 'conv-1': 'A', 'conv-2': 'B' });
  });

  describe('whose draft it is', () => {
    const ANA = { id: 'user-ana', email: 'ana@x.io', displayName: 'Ana', role: 'agent' };
    const BEA = { id: 'user-bea', email: 'bea@x.io', displayName: 'Bea', role: 'agent' };
    const signIn = (user: typeof ANA) =>
      useAuthStore.getState().setAuth('token', Date.now() + 60_000, user, 'tenant-1', [], {});
    const persistedDrafts = () =>
      (
        JSON.parse(localStorage.getItem('verbara-drafts') ?? '{}') as {
          state?: { drafts?: object };
        }
      ).state?.drafts;

    beforeEach(() => {
      useAuthStore.getState().logout();
    });

    it('drafts_ShouldComeBack_WhenTheSamePersonSignsInAgain', () => {
      signIn(ANA);
      useDraftStore.getState().setDraft('conv-1', 'Half a reply');

      useAuthStore.getState().logout();
      signIn(ANA);

      expect(useDraftStore.getState().drafts['conv-1']).toBe('Half a reply');
    });

    it('drafts_ShouldBeGoneFromMemoryAndDisk_WhenAnotherPersonSignsIn', () => {
      signIn(ANA);
      useDraftStore.getState().setDraft('conv-1', 'Half a reply');

      useAuthStore.getState().logout();
      signIn(BEA);

      expect(useDraftStore.getState().drafts).toEqual({});
      expect(persistedDrafts()).toEqual({});
    });

    it('drafts_ShouldKeepTheNextPersonsOwn_WhenTheyTypeAfterSigningIn', () => {
      signIn(ANA);
      useDraftStore.getState().setDraft('conv-1', 'From Ana');
      useAuthStore.getState().logout();
      signIn(BEA);

      useDraftStore.getState().setDraft('conv-2', 'From Bea');

      expect(useDraftStore.getState().drafts).toEqual({ 'conv-2': 'From Bea' });
    });

    it('drafts_ShouldBeGone_WhenTheyWereSavedBeforeDraftsNamedTheirOwner', () => {
      useDraftStore.setState({ owner: null, drafts: { 'conv-1': 'Nobody knows whose' } });

      signIn(ANA);

      expect(useDraftStore.getState().drafts).toEqual({});
    });
  });
});
