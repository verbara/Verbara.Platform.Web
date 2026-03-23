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
});
