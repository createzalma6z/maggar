/* MAGGAR.io — okul dostu isim filtresi (liste base64 ile saklanır) */
(function (MG) {
  'use strict';

  const DATA = 'eyJhIjpbImZ1Y2siLCJzaGl0IiwiYml0Y2giLCJjdW50IiwicHVzc3kiLCJuaWdnIiwid2hvcmUiLCJzbHV0IiwiYmFzdGFyZCIsImFzc2hvbGUiLCJwb3JuIiwibmF6aSIsImhpdGxlciIsInBlbmlzIiwidmFnaW5hIiwicmV0YXJkIiwib3Jvc3B1IiwieWFycmFrIiwicGV6ZXZlbmsiLCJrYWhwZSIsImdhdmF0IiwieWF2xZ9hayIsInlhdnNhayIsInNpa3RpciIsInNpa2VyaW0iLCJzaWtpbSIsInNpa2lrIiwiYW1jxLFrIiwiYW1jaWsiLCJhbcSxbmEiLCJhbWluYSIsImZhaGnFn2UiLCJmYWhpc2UiLCJrYWx0YWsiLCJkYWx5YXJhayIsImdlcml6ZWthbCIsImfDtnR2ZXJlbiIsImdvdHZlcmVuIiwiaWJuZSIsInB1xZ90IiwixZ9lcmVmc2l6Iiwic2VyZWZzaXoiLCJvw6dvY3XEn3UiLCJvY29jdWd1IiwidGHFn2FrIiwiZmFnZ290IiwicG9ybm8iLCJzZWtzIl0sInMiOlsic2lrIiwiYW1rIiwiY29jayIsInlhcmFrIiwicGnDpyIsImRpY2siLCJzZXgiXSwidyI6WyJhbSIsImFxIiwib8OnIiwib2MiLCJtYWwiLCJnb3QiLCJnw7Z0IiwiZmFnIiwia3lzIiwic2FsYWsiLCJhcHRhbCIsInJhcGUiLCJwdXN0IiwidGFzYWsiLCJwaWMiXX0=';

  let lists = null;
  function load() {
    if (lists) return lists;
    try {
      const bin = atob(DATA);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      lists = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (e) {
      lists = { a: [], s: [], w: [] };
    }
    return lists;
  }

  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i' };
  const FOLD = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };

  function normalize(str) {
    let s = String(str).toLocaleLowerCase('tr-TR');
    s = s.replace(/[0-9@$!|]/g, c => LEET[c] || c);
    return s;
  }
  function fold(s) { return s.replace(/[çğıöşüâîû]/g, c => FOLD[c]); }

  function hasBad(raw) {
    const L = load();
    const n = normalize(raw);
    const variants = [n, fold(n)];
    for (const v of variants) {
      const squashed = v.replace(/[^a-zçğıöşü]/g, '');
      for (const w of L.a) if (squashed.includes(w) || v.includes(w)) return true;
      const words = v.split(/[^a-zçğıöşü]+/).filter(Boolean);
      for (const word of words) {
        for (const w of L.s) if (word.startsWith(w)) return true;
        for (const w of L.w) if (word === w) return true;
      }
    }
    return false;
  }

  MG.Filter = {
    isClean(name) { return !hasBad(name); },
    // Görünmez/tuhaf karakterleri temizle, 15 karaktere kırp
    sanitize(name) {
      let s = String(name || '')
        .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/g, '')
        .replace(/[̀-ͯ]{2,}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return Array.from(s).slice(0, 15).join('');
    },
    // Uygunsuz isimse null döner
    clean(name) {
      const s = MG.Filter.sanitize(name);
      if (!s) return '';
      return hasBad(s) ? null : s;
    }
  };
})(window.MG = window.MG || {});
