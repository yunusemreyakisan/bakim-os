import { normalizeEmail, normalizeEquipmentCode } from './normalize';

describe('normalize', () => {
  it('e-postayı küçük harfe çevirir', () => {
    expect(normalizeEmail('  Admin@Demo.Test ')).toBe('admin@demo.test');
  });

  it('ekipman kodunu büyük harfe çevirir', () => {
    expect(normalizeEquipmentCode(' cnc-01 ')).toBe('CNC-01');
  });
});
