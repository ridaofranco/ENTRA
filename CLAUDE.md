# ENTRÁ · reglas para cualquier sesión que toque este repo

## La estética no se pierde (Franco, 26/11/2026)
Todo lo que llega a `main` sale en vivo en entratickets.com. La estética jamás se puede
perder: ni títulos partidos en muchos renglones, ni grillas con huecos, ni tarjetas
sueltas, ni nada que se salga de la pantalla en el celular.

1. **Antes de publicar corre solo el control visual** (`scripts/pre-push.sh`, que llama a
   `scripts/control-visual.mjs`): compila, levanta el sitio en un puerto libre y abre las
   páginas en un navegador real, a 1440 y 390 px (notas y guías, y las pantallas de la
   aplicación en español y en inglés). Frena el push si hay títulos partidos, grillas con
   huecos, algo que se sale de la pantalla o fotos rotas, y le avisa a Franco por
   Telegram. Tarda alrededor de un minuto.
2. **Si el repo se clona de nuevo, reinstalar la traba:**
   `ln -sf ../../scripts/pre-push.sh .git/hooks/pre-push`
3. **Prohibido `git push --no-verify`** y prohibido aflojar los límites del control para
   que pase. Si falla, se corrige la página. Las excepciones van en
   `scripts/control-visual.excepciones.json`, pocas y con su motivo (hoy una sola: la
   cartelera, que depende de cuántos eventos hay publicados).
4. **Cambio de título, h1, plantilla o página nueva:** además del control, mirar una
   captura a 1440 y 390 px antes de publicar. El control detecta errores medibles, no
   reemplaza mirar.
5. **Títulos de notas y guías** (`public/blog`, `public/<idioma>/blog`,
   `public/vender-entradas`): el tamaño se ajusta solo según el largo. La compilación
   (`tituloSegunLargo` en `vite.config.ts`) le pone al h1 la clase `t-largo` desde 70
   letras y `t-muy-largo` desde 85, y `public/blog.css` lo achica. Un h1 de más de 100
   letras ya es un problema: acortarlo.
6. **Grillas de eventos:** con pocas tarjetas no va la grilla de tres columnas. Seguir el
   criterio de `Landing.tsx` y `Comprar.tsx` (1, 2 o 4 eventos: una o dos columnas con
   imagen apaisada).
7. **Control a mano:** `node scripts/control-visual.mjs --base https://www.entratickets.com`
   revisa el sitio en vivo; para probar la traba sin avisar por Telegram,
   `CONTROL_SIN_AVISO=1 git push --dry-run origin HEAD:main`.
