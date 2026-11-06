# Blog de ENTRÁ en 5 idiomas

Desde el 06/11/2026 el blog de ENTRÁ funciona igual que el de somosder.ar: español (el original, para Argentina) más inglés, portugués, francés e italiano, con hreflang recíproco, x-default al español, sitemap con alternates y llms.txt. Todo lo arma `scripts/blog-i18n.mjs`; nada de eso se toca a mano.

**Regla de contenido de todas las traducciones:** ENTRÁ es una ticketera argentina. Vende entradas para eventos en Argentina, en pesos. Cada traducción lo dice (párrafo `p.pais` arriba y el CTA «… an event in Argentina?»). Nunca dar a entender que opera en otro país, que cobra en otra moneda o que cumple leyes de otro país.

## Dónde va cada cosa

| Qué | Dónde |
|---|---|
| Nota original (español) | `public/blog/<slug-es>.html` → `https://www.entratickets.com/blog/<slug-es>` |
| Traducción publicada | `public/<idioma>/blog/<slug-nativo>.html` → `https://www.entratickets.com/<idioma>/blog/<slug-nativo>` (idioma = `en`, `pt`, `fr`, `it`) |
| Traducción esperando subir | `editorial/traducciones/<slug-es>.<idioma>.html` (ej. `como-elegir-ticketera-comisiones.en.html`) |
| Traducciones ya subidas | `editorial/traducciones/subidas/` (fuera de git, quedan de respaldo) |
| Pares es ↔ idiomas | `editorial/blog-pares.json` (`{ "es": "...", "en": "...", "pt": "...", "fr": "...", "it": "..." }` por nota) |
| Plantilla | `editorial/plantilla-traduccion.html` |
| Índices por idioma | `public/<idioma>/blog/index.html` (GENERADOS, se pisan) |
| Sitemap | `api/_blog-i18n.ts` (GENERADO) lo importa `api/sitemap.ts`: suma las rutas en/pt/fr/it y los `<xhtml:link>` de cada nota con traducción. Las notas en español se siguen sumando a mano en `FIJAS` de `api/sitemap.ts` (manual de la revista). |
| llms.txt | sección entre `<!-- blog-i18n:inicio -->` y `<!-- blog-i18n:fin -->` de `public/llms.txt` (GENERADA) |

Bloques que escribe el script dentro de cada nota que tiene al menos una traducción (no editarlos):
- `<!-- hreflang:inicio --> … <!-- hreflang:fin -->` en el `<head>`, justo debajo del canonical: `es-AR`, los idiomas que existan y `x-default` = la española.
- `<!-- idiomas:inicio --> … <!-- idiomas:fin -->` debajo del `</header>`: selector Español · English · Português · Français · Italiano.

Rutas (ya configuradas, no tocar): `vercel.json` reescribe `/<idioma>/blog` y `/<idioma>/blog/<slug>` a los HTML; los redirects viejos de `/en/*` y `/pt/*` a la app excluyen `/en/blog` y `/pt/blog`; la regla final de la SPA excluye `<idioma>/blog/.` para que una nota inexistente dé 404 real. `vite.config.ts`: el service worker no intercepta `/(en|pt|fr|it)/blog` ni precarga esos HTML.

## Cómo se escribe una traducción

1. Copiá `editorial/plantilla-traduccion.html` (o, mejor, una traducción ya publicada del mismo idioma en `public/<idioma>/blog/`, que trae los textos fijos ya traducidos) a `editorial/traducciones/<slug-es>.<idioma>.html`. `<slug-es>` es el nombre del archivo español, exacto.
2. Reemplazá todo:
   - `<html lang="en|pt|fr|it">`.
   - **Canonical** `https://www.entratickets.com/<idioma>/blog/<slug-nativo>`: el script saca el slug de acá. Slug nativo en minúsculas, sin acentos, 3 a 6 palabras con la búsqueda real de ese idioma (no traducido palabra por palabra).
   - `<title>`: hasta 50 caracteres + ` | ENTRÁ`. `description`: 140 a 160. `og:*` iguales. `og:locale` (`en_US`, `pt_BR`, `fr_FR`, `it_IT`).
   - JSON-LD `Article` (`inLanguage` = idioma, `datePublished` = la del original, `isBasedOn` = URL española) y `FAQPage` con las mismas preguntas que el cuerpo.
   - Cuerpo: misma respuesta directa en el primer párrafo, mismas secciones y FAQ. Título de la FAQ: «Frequently asked questions», «Perguntas frequentes», «Questions fréquentes», «Domande frequenti».
   - Lo argentino se explica, no se inventa: precios como `ARS 10,000`; «8% + IVA» → «8% plus VAT (IVA, the Argentine value added tax)»; SADAIC → «music rights (in Argentina, SADAIC)»; AFIP/monotributo → neutro y «ask your accountant», sin leyes de otro país. Los botones de la app van en castellano con la traducción entre paréntesis (ej. **Lanzar Venta Oficial** (launch official sale)).
   - CTA: botón a WhatsApp con texto en ese idioma: `https://wa.me/5491171540675?text=<texto url-encoded>` (no a `/productores`, que está en castellano).
   - «Seguir leyendo»: solo enlaces a notas que YA existen en ese idioma (o en el mismo lote) y al índice `/<idioma>/blog`. El script avisa si hay un enlace interno roto.
   - Nada de guion largo ni semiguion. Ni clientes vetados, ni cifras o funciones que no estén en la nota española.
   - NO pongas hreflang ni selector de idioma: los escribe el script.
3. Subí y regenerá (desde la raíz del repo):

   ```
   npm run blog:i18n:subir      # = node scripts/blog-i18n.mjs --subir
   ```

   Valida cada archivo (nombre, canonical, slug, `lang`, JSON-LD, guiones) y si está bien lo copia a `public/<idioma>/blog/<slug-nativo>.html`, suma el par en `blog-pares.json`, lo mueve a `traducciones/subidas/` y regenera hreflang de todo el grupo (la española y las otras traducciones), índices, `api/_blog-i18n.ts` y llms.txt. Si un archivo no pasa, queda en `traducciones/` con el motivo en pantalla («NO se sube: …»).
4. `npm run build`, commit, `git rebase origin/main`, push a main. Verificar en vivo: `curl -s https://www.entratickets.com/<idioma>/blog/<slug> | grep -E '<title>|hreflang'` (ojo: un 200 solo no prueba nada, mirá el título) y que la nota aparezca en `/sitemap.xml` y en `/<idioma>/blog`.
5. IndexNow con las URLs nuevas y la española (cambió su hreflang).

Si se edita `blog-pares.json` a mano o se borra/renombra una traducción, correr `npm run blog:i18n` (sin `--subir`): saca del grupo lo que no existe y deja todo coherente. Correrlo dos veces seguidas no cambia nada (la segunda dice «0 notas con hreflang actualizado»).

## Para la revista automática

La revista solo tiene que dejar los HTML en `editorial/traducciones/<slug-es>.<idioma>.html` siguiendo el punto 2 y después correr el punto 3 y 4. No toca `public/`, ni el sitemap, ni llms.txt, ni los índices a mano.

## Estado

06/11/2026: 3 notas en los 4 idiomas (prueba de la estructura): `como-elegir-ticketera-comisiones`, `poner-precio-entradas-tandas-preventa`, `entradas-truchas-duplicadas-puerta`. Faltan las otras ~115 notas españolas.
