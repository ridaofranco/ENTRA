#!/usr/bin/env python3
"""Pie con la familia de productos de SOMOS DER en todas las páginas HTML públicas de ENTRÁ.

Regla de Franco (16/11): «mis productos entre sí deberían hablarse». Cada página enlaza
en el pie a los otros cuatro productos de la casa, con la búsqueda como texto del enlace.

Qué hace, en cada public/**/*.html que tenga un <footer> con .foot-in:
  - saca la mención vieja «también PASE (...) y LABURO (...)» y el renglón «Desarrollo: hito.agency»
  - pone un solo bloque <!-- familia --> ... <!-- /familia --> en el idioma de la página

Se puede correr todas las veces que haga falta (no duplica). Correrlo después de crear una
nota del blog (en cualquier idioma) o una guía de /vender-entradas. La portada de la app
no pasa por acá: su pie está en src/lib/portada.ts (FAMILIA) y en src/components/layout/Footer.tsx.

    python3 scripts/pie-familia.py          # escribe
    python3 scripts/pie-familia.py --check  # solo avisa qué páginas no lo tienen
"""
import glob
import os
import re
import sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')

# Texto del enlace = la búsqueda que pelea cada producto. No cambiar sin mirar el mapa de posiciones.
FAMILIA = {
    'es': ('De la misma casa:', [
        ('https://www.somosder.ar', 'Productora de eventos: SOMOS DER'),
        ('https://pase.somosder.ar', 'Acreditación y control de acceso para eventos: PASE'),
        ('https://laburo.somosder.ar', 'Personal para eventos: LABURO'),
        ('https://hito.agency', 'Consultoría y web para emprendedores de eventos: HITO'),
    ]),
    'en': ('From the same team:', [
        ('https://somosder.com/', 'Event production company in Argentina: SOMOS DER'),
        ('https://pase.somosder.ar/en/', 'Event accreditation and access control: PASE'),
        ('https://laburo.somosder.ar', 'Event staff in Argentina: LABURO'),
        ('https://hito.agency/en/', 'Consulting and websites for event entrepreneurs: HITO'),
    ]),
    'pt': ('Da mesma casa:', [
        ('https://somosder.com/pt', 'Produtora de eventos na Argentina: SOMOS DER'),
        ('https://pase.somosder.ar/pt/', 'Credenciamento e controle de acesso para eventos: PASE'),
        ('https://laburo.somosder.ar', 'Equipe para eventos na Argentina: LABURO'),
        ('https://hito.agency/pt/', 'Consultoria e sites para negócios de eventos: HITO'),
    ]),
    'fr': ('De la même maison :', [
        ('https://somosder.com/fr', 'Production événementielle en Argentine : SOMOS DER'),
        ('https://pase.somosder.ar/fr/', 'Accréditation et contrôle d\u2019accès événementiel : PASE'),
        ('https://laburo.somosder.ar', 'Personnel événementiel en Argentine : LABURO'),
        ('https://hito.agency/fr/', 'Conseil et sites web pour les pros de l\u2019événementiel : HITO'),
    ]),
    'it': ('Della stessa casa:', [
        ('https://somosder.com/it', 'Produzione di eventi in Argentina: SOMOS DER'),
        ('https://pase.somosder.ar/it/', 'Accrediti e controllo accessi per eventi: PASE'),
        ('https://laburo.somosder.ar', 'Personale per eventi in Argentina: LABURO'),
        ('https://hito.agency/it/', 'Consulenza e siti web per imprenditori di eventi: HITO'),
    ]),
}

ESTILO = 'padding-top:12px;font-size:.8rem;opacity:.85;line-height:1.9'


def bloque(lang):
    titulo, enlaces = FAMILIA[lang]
    links = ' · '.join(f'<a href="{u}">{t}</a>' for u, t in enlaces)
    return f'<!-- familia --><div class="wrap familia" style="{ESTILO}">{titulo} {links}</div><!-- /familia -->'


VIEJO_TAMBIEN = re.compile(
    r' · (?:también|also|aussi|anche|também) <a href="https://pase\.somosder\.ar">PASE</a> \([^)]*\) '
    r'(?:y|and|et|e) <a href="https://laburo\.somosder\.ar">LABURO</a> \([^)]*\)')
VIEJO_SUELTO = re.compile(
    r' · <a href="https://pase\.somosder\.ar">PASE</a> · <a href="https://laburo\.somosder\.ar">LABURO</a>')
VIEJO_HITO_DIV = re.compile(
    r'\s*<div class="wrap" style="padding-top:1[24]px;font-size:\.8rem;opacity:\.85">[^<]*'
    r'<a href="https://hito\.agency">hito\.agency</a></div>')
FAMILIA_RE = re.compile(r'\s*<!-- familia -->.*?<!-- /familia -->', re.S)


def idioma(html):
    m = re.search(r'<html[^>]*\blang="([a-zA-Z-]+)"', html)
    cod = (m.group(1) if m else 'es').lower()[:2]
    return cod if cod in FAMILIA else 'es'


def arreglar(html):
    pies = list(re.finditer(r'<footer[^>]*>.*?</footer>', html, re.S))
    if not pies:
        return html, False
    pie = pies[-1]
    viejo = pie.group(0)
    if 'foot-in' not in viejo:
        return html, False
    nuevo = FAMILIA_RE.sub('', viejo)
    nuevo = VIEJO_TAMBIEN.sub('', nuevo)
    nuevo = VIEJO_HITO_DIV.sub('', nuevo)
    nuevo = VIEJO_SUELTO.sub('', nuevo)
    b = bloque(idioma(html))
    if '<!-- blog-i18n:idiomas -->' in nuevo:
        nuevo = re.sub(r'\s*<!-- blog-i18n:idiomas -->', lambda m: '\n  ' + b + '\n  <!-- blog-i18n:idiomas -->', nuevo, count=1)
    else:
        nuevo = re.sub(r'\s*</footer>$', lambda m: '\n  ' + b + '\n  </footer>', nuevo)
    return html[:pie.start()] + nuevo + html[pie.end():], True


def main():
    check = '--check' in sys.argv
    tocadas = sin_pie = faltan = 0
    for f in sorted(glob.glob(os.path.join(RAIZ, '**', '*.html'), recursive=True)):
        html = open(f, encoding='utf-8').read()
        nuevo, tiene_pie = arreglar(html)
        rel = os.path.relpath(f, RAIZ)
        if not tiene_pie:
            sin_pie += 1
            continue
        if nuevo != html:
            if check:
                faltan += 1
                print('falta o está viejo:', rel)
            else:
                open(f, 'w', encoding='utf-8').write(nuevo)
                tocadas += 1
    if check:
        print(f'{faltan} páginas sin el pie de la familia al día ({sin_pie} sin pie público, no se tocan)')
        sys.exit(1 if faltan else 0)
    print(f'{tocadas} páginas actualizadas ({sin_pie} sin pie público, no se tocan)')


if __name__ == '__main__':
    main()
