import {
  contrastRatio,
  isNearNeutralColor,
  isHexColor,
  parseHexColor,
  pickOnColor,
  relativeLuminance,
} from './color-contrast';

describe('color-contrast', () => {
  describe('isHexColor', () => {
    it('accepts 3- and 6-digit hex', () => {
      expect(isHexColor('#82d7a9')).toBe(true);
      expect(isHexColor('#ABC')).toBe(true);
      expect(isHexColor('blue')).toBe(false);
      expect(isHexColor('rebeccapurple')).toBe(false);
      expect(isHexColor(undefined)).toBe(false);
      expect(isHexColor(null)).toBe(false);
    });
  });

  describe('parseHexColor', () => {
    it('expands 3-digit hex', () => {
      expect(parseHexColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    });

    it('parses 6-digit hex', () => {
      expect(parseHexColor('#82d7a9')).toEqual({ r: 0x82, g: 0xd7, b: 0xa9 });
    });

    it('returns null for invalid values', () => {
      expect(parseHexColor('rebeccapurple')).toBeNull();
      expect(parseHexColor('')).toBeNull();
    });
  });

  describe('relativeLuminance', () => {
    it('is 1 for white and 0 for black', () => {
      expect(relativeLuminance(parseHexColor('#ffffff')!)).toBeCloseTo(1, 5);
      expect(relativeLuminance(parseHexColor('#000000')!)).toBeCloseTo(0, 5);
    });
  });

  describe('contrastRatio', () => {
    it('is ordered regardless of argument order', () => {
      const white = { r: 255, g: 255, b: 255 };
      const black = { r: 0, g: 0, b: 0 };
      expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
      expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    });
  });

  describe('pickOnColor', () => {
    it('chooses white on dark label colors', () => {
      expect(pickOnColor('#2b7c55')).toBe('#ffffff');
      expect(pickOnColor('#1d533b')).toBe('#ffffff');
    });

    it('chooses black on light and mid-tone label colors per max contrast', () => {
      // #d44d3c: white 4.26:1 vs black 4.93:1 — black wins, which also keeps
      // the selected-solid pill's text above AA.
      expect(pickOnColor('#d44d3c')).toBe('#000000');
      expect(pickOnColor('#dee0d8')).toBe('#000000');
      expect(pickOnColor('#c7e9b3')).toBe('#000000');
    });

    it('returns null for invalid colors', () => {
      expect(pickOnColor('oops')).toBeNull();
    });

    it('always yields at least 4.5:1 text contrast for palette colors', () => {
      const palette = [
        '#d44d3c',
        '#a5d3e1',
        '#b9a3f4',
        '#f1c582',
        '#c7e9b3',
        '#82d7a9',
        '#2b7c55',
        '#dee0d8',
      ];
      for (const hex of palette) {
        const on = parseHexColor(pickOnColor(hex)!);
        expect(contrastRatio(parseHexColor(hex)!, on!)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe('isNearNeutralColor', () => {
    it('flags light gray-green neutrals that fade against the surface', () => {
      expect(isNearNeutralColor('#dee0d8')).toBe(true);
      expect(isNearNeutralColor('#eeeeee')).toBe(true);
    });

    it('does not flag saturated palette colors', () => {
      expect(isNearNeutralColor('#c7e9b3')).toBe(false);
      expect(isNearNeutralColor('#d44d3c')).toBe(false);
    });
  });
});
