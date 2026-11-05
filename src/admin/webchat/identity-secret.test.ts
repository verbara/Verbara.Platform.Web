import { describe, expect, it, vi } from 'vitest';
import { generateIdentitySecret } from './identity-secret';

describe('generateIdentitySecret', () => {
  it('generateIdentitySecret_ShouldBe43Base64UrlCharacters_WhenCalled', () => {
    for (let i = 0; i < 200; i++) {
      // Asserted on the test's result, so a failure never prints the value.
      expect(/^[A-Za-z0-9_-]{43}$/.test(generateIdentitySecret())).toBe(true);
    }
  });

  it('generateIdentitySecret_ShouldDiffer_WhenCalledTwice', () => {
    expect(generateIdentitySecret() === generateIdentitySecret()).toBe(false);
  });

  it('generateIdentitySecret_ShouldTake32BytesFromTheRandomSource_WhenCalled', () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    generateIdentitySecret();
    expect(random).toHaveBeenCalledTimes(1);
    expect((random.mock.calls[0]![0] as Uint8Array).length).toBe(32);
    random.mockRestore();
  });

  it('generateIdentitySecret_ShouldUseTheUrlSafeAlphabetWithNoPadding_WhenTheBytesMapToPlusAndSlash', () => {
    const random = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(bytes: T) => {
        (bytes as unknown as Uint8Array).fill(0xff);
        return bytes;
      });
    const value = generateIdentitySecret();
    random.mockRestore();

    expect(value).toBe(`${'_'.repeat(42)}8`);
  });
});
