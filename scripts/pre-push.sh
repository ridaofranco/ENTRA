#!/bin/sh
# TRABA ANTES DE PUBLICAR (26/11/2026, regla de Franco: «la estética jamás se puede perder»).
# Todo lo que llega a main sale en vivo en entratickets.com. Antes de dejar pasar el push
# se compila el sitio, se lo levanta en un puerto libre y se lo recorre en un navegador
# real (scripts/control-visual.mjs), a 1440 y 390 px. Si hay un título partido, una grilla
# con huecos, algo que se sale de la pantalla o una foto rota, el push NO sale y Franco
# recibe el aviso por Telegram (salvo que exista la variable CONTROL_SIN_AVISO).
# Se instala con: ln -sf ../../scripts/pre-push.sh .git/hooks/pre-push
# Prohibido saltearlo con --no-verify sin el OK de Franco.
cd "$(git rev-parse --show-toplevel)" || exit 1
publica_main=0
cambia_web=0
while read -r _ local_sha remote_ref remote_sha; do
  case "$remote_ref" in refs/heads/main) publica_main=1 ;; *) continue ;; esac
  [ "$local_sha" = "0000000000000000000000000000000000000000" ] && continue
  base="$remote_sha"
  [ "$base" = "0000000000000000000000000000000000000000" ] && base="$(git merge-base "$local_sha" origin/main 2>/dev/null)"
  if git diff --name-only "$base" "$local_sha" 2>/dev/null | grep -Eq '^(src/|public/|index\.html|vite\.config|package\.json|scripts/control-visual)'; then cambia_web=1; fi
done
[ "$publica_main" = 1 ] && [ "$cambia_web" = 1 ] || exit 0

echo "pre-push: compilando y revisando cómo se ve el sitio (alrededor de 1 minuto)…" >&2
tmp="$(mktemp -d)"
salida="$tmp/salida.txt"
preview=""
terminar() { [ -n "$preview" ] && kill "$preview" 2>/dev/null; rm -rf "$tmp"; }
trap terminar EXIT

if ! npm run build >"$salida" 2>&1; then
  tail -20 "$salida" >&2
  echo "pre-push: el sitio no compila. No se publica." >&2
  exit 1
fi

# Mapa de lo compilado: el sitemap real lo arma una función de Vercel (api/sitemap.ts) y en
# local no existe. Las notas y guías salen de los HTML de dist; las pantallas de la
# aplicación van aparte porque no tienen archivo propio.
{
  echo '<urlset>'
  (cd dist && find blog en pt fr it vender-entradas -name '*.html' 2>/dev/null | sort |
    sed -e 's#/index\.html$#/#' -e 's#\.html$##' -e 's#.*#<url><loc>http://local/&</loc></url>#')
  echo '</urlset>'
} >"$tmp/mapa.xml"
printf '%s\n' / /eventos /productores /ayuda /contacto /demo /terminos /privacidad /auth/login /pagina-que-no-existe >"$tmp/app.txt"

puerto="$(node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"
node node_modules/vite/bin/vite.js preview --port "$puerto" --strictPort --host 127.0.0.1 >"$tmp/preview.txt" 2>&1 &
preview=$!
i=0
until curl -s -o /dev/null "http://127.0.0.1:$puerto/"; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then cat "$tmp/preview.txt" >&2; echo "pre-push: no pude levantar el sitio compilado. No se publica." >&2; exit 1; fi
  sleep 0.5
done

falla=0
: >"$salida"
# 1) notas y guías (HTML suelto) · 2) pantallas de la aplicación en español · 3) las mismas en inglés
node scripts/control-visual.mjs --base "http://127.0.0.1:$puerto" --mapa "$tmp/mapa.xml" >>"$salida" 2>&1 || falla=1
node scripts/control-visual.mjs --base "http://127.0.0.1:$puerto" --rutas "$tmp/app.txt" >>"$salida" 2>&1 || falla=1
node scripts/control-visual.mjs --base "http://127.0.0.1:$puerto" --rutas "$tmp/app.txt" --idioma en-US >>"$salida" 2>&1 || falla=1
cat "$salida" >&2
[ "$falla" = 0 ] && exit 0

resumen="$(grep '^✗' "$salida" | head -5)"
[ -z "$CONTROL_SIN_AVISO" ] && [ -x /usr/bin/python3 ] && [ -f /root/scripts/tg-orden.py ] && /usr/bin/python3 -I /root/scripts/tg-orden.py telegram-franco "🛑 ENTRÁ: frené una publicación en entratickets.com porque se veía mal. No salió nada en vivo; lo corrijo antes de publicar.
$resumen" >/dev/null 2>&1
echo "pre-push: el control visual falló. No se publica hasta corregirlo." >&2
exit 1
