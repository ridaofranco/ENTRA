#!/usr/bin/env python3
"""Rastreador de origen de la casa en todas las páginas HTML públicas de ENTRÁ (17/11/2026).

Cada página pública carga una sola vez `<script defer src="/origen-casa.js"></script>`:
guarda de dónde vino la visita (cookie der_o) y avisa a somosder.ar/api/origen cuando
alguien toca WhatsApp, un mail o manda un formulario. El visitante no ve nada.

Qué hace, en cada public/**/*.html que tenga </head>:
  - si no trae la etiqueta, la pone justo antes de </head>;
  - si está repetida, deja una sola.
El archivo de verificación de Google no tiene </head> y no se toca.

La aplicación (portada, /productores, /contacto, /ayuda y el resto de las pantallas)
no pasa por acá: lo carga index.html de la raíz del repo, y el build lo copia a cada
ruta de dist/_rutas. Ahí los formularios que no son consultas llevan data-origen="no".

Se puede correr todas las veces que haga falta. Correrlo después de crear una nota
del blog (en cualquier idioma) o una guía de /vender-entradas:

    python3 scripts/origen-casa.py          # escribe
    python3 scripts/origen-casa.py --check  # solo avisa qué páginas no lo tienen
"""
import glob
import os
import re
import sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')

ETIQUETA = '<script defer src="/origen-casa.js"></script>'
# Páginas que NO llevan el rastreador, con el motivo (hoy ninguna).
EXCLUIDAS = {}

LINEA_RE = re.compile(r'[ \t]*' + re.escape(ETIQUETA) + r'[ \t]*\n?')
HEAD_RE = re.compile(r'^([ \t]*)</head>', re.M)


def arreglar(html):
    """Devuelve (html nuevo, tiene_head)."""
    if '</head>' not in html:
        return html, False
    nuevo = html
    veces = nuevo.count(ETIQUETA)
    if veces > 1:
        # Deja la primera y saca las demás con su renglón.
        primera = nuevo.index(ETIQUETA) + len(ETIQUETA)
        nuevo = nuevo[:primera] + LINEA_RE.sub('', nuevo[primera:])
    elif veces == 0:
        m = HEAD_RE.search(nuevo)
        if m:
            nuevo = nuevo[:m.start()] + m.group(1) + '  ' + ETIQUETA + '\n' + nuevo[m.start():]
        else:
            nuevo = nuevo.replace('</head>', ETIQUETA + '</head>', 1)
    return nuevo, True


def main():
    check = '--check' in sys.argv
    tocadas = con = sin_head = excluidas = faltan = 0
    for f in sorted(glob.glob(os.path.join(RAIZ, '**', '*.html'), recursive=True)):
        rel = os.path.relpath(f, RAIZ).replace(os.sep, '/')
        if rel in EXCLUIDAS:
            excluidas += 1
            continue
        html = open(f, encoding='utf-8').read()
        nuevo, tiene_head = arreglar(html)
        if not tiene_head:
            sin_head += 1
            continue
        con += 1
        if nuevo != html:
            if check:
                faltan += 1
                print('falta o está viejo:', rel)
            else:
                open(f, 'w', encoding='utf-8').write(nuevo)
                tocadas += 1
    resto = f'{con} páginas con rastreador, {excluidas} excluidas a propósito, {sin_head} sin </head>'
    if check:
        print(f'{faltan} páginas sin el rastreador al día ({resto})')
        sys.exit(1 if faltan else 0)
    print(f'{tocadas} páginas actualizadas ({resto})')


if __name__ == '__main__':
    main()
