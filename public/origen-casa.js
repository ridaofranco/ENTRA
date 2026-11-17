/*
  ORIGEN DE CADA CONSULTA, igual que en somosder.ar (somosder-web/src/lib/origen.ts).
  El visitante no ve nada: no se toca ningún enlace, mensaje ni formulario.
  1) En la primera visita guarda de dónde vino (pauta, Google, Bing, ChatGPT, otro
     producto de la casa, directo) en la cookie propia der_o por 90 días.
  2) Al tocar WhatsApp o un mail, o al enviar un formulario, manda un aviso silencioso
     a somosder.ar/api/origen, que lo guarda en Sales OS (tabla web_origen_clics).
  Para avisar a mano desde código: window.derOrigen('formulario', 'demo').
  Un formulario con data-origen="no" o con campo de contraseña no se cuenta.
*/
(function () {
  'use strict';
  try {
    if (window.derOrigen) return;
    var COOKIE = 'der_o';
    var API = 'https://www.somosder.ar/api/origen';
    var CASA = /(^|\.)(somosder\.(ar|com)|hito\.agency|entratickets\.com)$/i;
    var HOSTS = [
      [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/i, 'chatgpt'],
      [/(^|\.)perplexity\.ai$/i, 'perplexity'],
      [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/i, 'gemini'],
      [/(^|\.)copilot\.microsoft\.com$/i, 'copilot'],
      [/(^|\.)claude\.ai$/i, 'claude'],
      [/(^|\.)(deepseek\.com|chat\.deepseek\.com)$/i, 'deepseek'],
      [/(^|\.)google\.[a-z.]+$/i, 'google'],
      [/(^|\.)bing\.com$/i, 'bing'],
      [/(^|\.)duckduckgo\.com$/i, 'duckduckgo'],
      [/(^|\.)yahoo\.[a-z.]+$/i, 'yahoo'],
      [/(^|\.)(instagram\.com|l\.instagram\.com)$/i, 'instagram'],
      [/(^|\.)(facebook\.com|l\.facebook\.com|m\.facebook\.com)$/i, 'facebook'],
      [/(^|\.)(linkedin\.com|lnkd\.in)$/i, 'linkedin'],
      [/(^|\.)sortlist\.[a-z.]+$/i, 'sortlist'],
      [/(^|\.)clutch\.co$/i, 'clutch'],
      [/(^|\.)techbehemoths\.com$/i, 'techbehemoths']
    ];
    var sinWww = function (h) { return String(h || '').replace(/^www\./, ''); };
    var corto = function (s, n) { return s ? String(s).slice(0, n || 120) : undefined; };
    var porHost = function (h) {
      for (var i = 0; i < HOSTS.length; i++) if (HOSTS[i][0].test(h)) return HOSTS[i][1];
    };
    var leer = function () {
      var m = document.cookie.match(/(?:^|;\s*)der_o=([^;]+)/);
      if (!m) return null;
      try { var v = JSON.parse(decodeURIComponent(m[1])); return v && typeof v.o === 'string' ? v : null; } catch (e) { return null; }
    };
    var detectar = function () {
      var u = new URL(location.href), q = u.searchParams, host = '';
      try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* referrer raro */ }
      if (sinWww(host) === sinWww(location.hostname)) host = '';
      var base = { l: corto(u.pathname, 200), t: new Date().toISOString(), r: host ? corto(host, 80) : undefined };
      var con = function (o) { for (var k in base) if (base[k] !== undefined) o[k] = base[k]; return o; };
      var g = q.get('gclid') || q.get('gbraid') || q.get('wbraid') || '';
      if (g) return con({ o: 'google-ads', g: corto(g, 200), c: corto(q.get('utm_campaign')) });
      var src = (q.get('utm_source') || '').toLowerCase(), medio = (q.get('utm_medium') || '').toLowerCase();
      if (/^(meta|facebook|fb|instagram|ig)$/.test(src) || (!src && q.get('fbclid'))) {
        return /paid|cpc|ads/.test(medio)
          ? con({ o: 'meta-ads', m: 'paid', c: corto(q.get('utm_campaign')) })
          : con({ o: 'meta', m: corto(medio || 'social', 40), c: corto(q.get('utm_campaign')) });
      }
      if (src) {
        return con({ o: porHost(src.replace(/^https?:\/\//, '')) || 'utm:' + corto(src, 40), m: corto(medio, 40), c: corto(q.get('utm_campaign')) });
      }
      // Otro producto de la casa: así se ve cuánto se mandan gente entre sí.
      if (host && CASA.test(host)) return con({ o: 'casa:' + corto(sinWww(host), 50) });
      if (host) return con({ o: porHost(host) || 'referido:' + corto(host, 50) });
      return con({ o: 'directo' });
    };
    var guardarSiFalta = function () {
      var actual = leer(), ahora = detectar();
      var pauta = function (o) { return o === 'google-ads' || o === 'meta-ads'; };
      if (actual && !(pauta(ahora.o) && !pauta(actual.o))) return actual;
      var seguro = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify(ahora)) + '; Max-Age=' + 90 * 86400 + '; Path=/; SameSite=Lax' + seguro;
      return ahora;
    };
    var avisar = function (canal, ubicacion, mensaje) {
      try {
        if (['whatsapp', 'mail', 'formulario'].indexOf(canal) < 0) return;
        var o = leer() || guardarSiFalta();
        var body = JSON.stringify({
          canal: canal, sitio: sinWww(location.hostname),
          origen: o.o, medio: o.m, campana: o.c, gclid: o.g, referrer: o.r, landing: o.l, primera_visita_at: o.t,
          pagina: location.pathname, ubicacion: corto(ubicacion, 40), idioma: document.documentElement.lang || 'es',
          mensaje: corto(mensaje, 300), movil: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches)
        });
        // JSON entre dominios: el navegador pide permiso una vez (OPTIONS) y el receptor lo da.
        // keepalive: el aviso sale aunque el clic abra WhatsApp o cambie de página.
        fetch(API, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, mode: 'cors', credentials: 'omit', keepalive: true }).catch(function () {});
      } catch (e) { /* nunca frenar el clic */ }
    };
    window.derOrigen = avisar;
    guardarSiFalta();

    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      var h = a.getAttribute('href') || '';
      var donde = a.getAttribute('data-origen') || (a.closest('footer') ? 'pie' : a.closest('header,nav') ? 'menu' : 'pagina');
      if (/wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|^whatsapp:/i.test(h)) {
        var t = '';
        try { t = new URL(a.href).searchParams.get('text') || ''; } catch (e) { /* sin texto */ }
        avisar('whatsapp', donde, t);
      } else if (/^mailto:/i.test(h)) {
        avisar('mail', donde, h.replace(/^mailto:/i, '').split('?')[0]);
      }
    }, true);

    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f || f.tagName !== 'FORM') return;
      if (f.getAttribute('data-origen') === 'no' || f.getAttribute('role') === 'search') return;
      if (f.querySelector('input[type="password"],input[type="search"]')) return;
      avisar('formulario', f.getAttribute('data-origen') || f.id || f.getAttribute('name') || 'formulario');
    }, true);
  } catch (e) { /* si algo falla, el sitio sigue igual */ }
})();
