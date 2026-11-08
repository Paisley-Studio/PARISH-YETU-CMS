/* GENERATED from js/slug.js (ES module copy for the Worker). Edit js/slug.js, then run: node scripts/sync-slug.js */
const factory = function () {
  'use strict';

  /* Routes that already belong to the application and can never be a parish address. */
  var RESERVED = [
    'admin', 'api', 'app', 'assets', 'auth', 'blog', 'church', 'churches', 'contact', 'css', 'dashboard',
    'diocese', 'dioceses', 'docs', 'download', 'eureka', 'fonts', 'functions', 'help', 'home', 'img', 'images',
    'index', 'join', 'js', 'login', 'logout', 'media', 'parish', 'parish-home', 'parish-register', 'parishes',
    'parishyetu', 'parish-yetu', 'privacy', 'register', 'register-parish', 'robots', 'scripts', 'settings',
    'signin', 'signup', 'sitemap', 'static', 'super', 'super-admin', 'support', 'terms', 'test', 'tests',
    'www', 'about', 'pricing', 'status', 'new', 'null', 'undefined',
    // application pages (each lives at /{name})
    'accounting', 'assets', 'catechesis', 'communications', 'diocese', 'documents', 'events', 'families', 'finance',
    'governance', 'masses', 'ministries', 'parishioners', 'pastoral', 'platform', 'projects', 'reports', 'sacraments',
    'scc', 'sermons', 'website'
  ];

  function fold(s) {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['‘’ʼ`´]/g, '')
      .replace(/&/g, ' and ');
  }

  /* "St. Mary's Parish, Thika" -> "st-marys-parish-thika" */
  function slugify(s, max) {
    max = max || 60;
    var out = fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (out.length > max) {
      out = out.slice(0, max);
      var cut = out.lastIndexOf('-');
      if (cut > max * 0.6) out = out.slice(0, cut);
      out = out.replace(/-+$/g, '');
    }
    return out;
  }

  /* Comparison key for duplicate detection: "St Mary's Catholic Parish" == "Saint Marys Church". */
  var NOISE = { parish: 1, catholic: 1, church: 1, the: 1, of: 1, roman: 1, rc: 1, and: 1 };
  /* Pass the town so "St Mary's Parish, Thika" and "St Mary's" (in Thika) compare as equal. */
  function nameKey(s, town) {
    var drop = {};
    placeKey(town).split(' ').filter(Boolean).forEach(function (w) { drop[w] = 1; });
    var words = fold(s)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(function (w) { return w === 'saint' || w === 'ste' || w === 'sts' ? 'st' : w; })
      .filter(function (w) { return !NOISE[w]; });
    var kept = words.filter(function (w) { return !drop[w]; });
    return (kept.length ? kept : words).join(' ');
  }
  function placeKey(s) { return fold(s).replace(/[^a-z0-9]+/g, ' ').trim(); }

  /* Base slug from the official name, adding the town when the name does not already contain it. */
  function parishSlug(name, town) {
    var base = String(name || '');
    var t = placeKey(town);
    if (t && (' ' + placeKey(name) + ' ').indexOf(' ' + t + ' ') < 0) base += ' ' + town;
    var s = slugify(base);
    return s.length >= 3 ? s : '';
  }

  function isReserved(slug) {
    slug = String(slug || '');
    return RESERVED.indexOf(slug) >= 0 || /^\d/.test(slug);
  }

  /* Valid public address: lowercase letters, digits and single hyphens, 3-80 characters. */
  function isValid(slug) {
    return typeof slug === 'string' && /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/.test(slug) && slug.indexOf('--') < 0 && !isReserved(slug);
  }

  function withSuffix(base, rnd) {
    var suf = String(rnd || Math.random().toString(36).slice(2, 6)).replace(/[^a-z0-9]/g, '').slice(0, 6) || 'x1';
    return slugify(base, 60 - suf.length - 1) + '-' + suf;
  }

  return { RESERVED: RESERVED, slugify: slugify, nameKey: nameKey, placeKey: placeKey, parishSlug: parishSlug, isReserved: isReserved, isValid: isValid, withSuffix: withSuffix };
};
export default factory();
