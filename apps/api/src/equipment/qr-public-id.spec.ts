import { createQrPublicId, isQrPublicId } from './qr-public-id';

describe('qr public id', () => {
  it('tahmin edilmesi zor ve sabit uzunlukta kimlik üretir', () => {
    const first = createQrPublicId();
    const second = createQrPublicId();
    expect(first).not.toBe(second);
    expect(isQrPublicId(first)).toBe(true);
    expect(first).toHaveLength(22);
  });
});
