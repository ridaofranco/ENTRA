# Manual de la revista de ENTRÁ

Lo usa el turno noche para escribir notas del blog de ENTRÁ (www.entratickets.com/blog). Arrancó el 29/10/2026 con 12 notas publicadas y 2 nuevas en borrador (las de esta carpeta). Modelo: el manual de la revista de LABURO. Esto es solo de ENTRÁ.

## Para qué es
Que quien organiza un evento chico o mediano en Argentina (fiesta, recital, obra, taller, evento gratuito con cupo) encuentre respuestas concretas cuando busca cómo vender entradas, y que quien compra resuelva sus dudas (no me llegó, me olvidé el celular, se canceló). Que Google y las IA citen a ENTRÁ en esas respuestas.

## Públicos
1. **Organizadores** (productores independientes, bandas, teatros chicos, talleristas, clubes): cómo poner precio, cómo vender, cómo controlar la puerta, papeles.
2. **Compradores**: dudas antes y después de comprar, seguridad, qué hacer si algo falla.

## Pilares (rotar)
- Vender: precio, tandas, cortesías, promoción, medir.
- Puerta: control de acceso, QR, truchas, cupo.
- Papeles y normas: facturación, capacidad, permisos. **Solo con fuente oficial abierta.**
- Comprador: problemas y seguridad.

## Tono
Voseo rioplatense. Concreto, en pasos, con listas. Sin marketing ni superlativos. Se escribe como alguien que hizo eventos y sabe dónde se rompen.

## Reglas duras
- **Nunca guion largo (raya larga) ni semiguion (raya media).** Comas, dos puntos o paréntesis.
- Sin clientes, sin testimonios, sin casos ni cifras inventadas.
- Del producto se afirma solo lo de `src/pages/Productores.tsx`, `src/pages/Ayuda.tsx` y `public/llms.txt` (cobrás el 100% del precio, el comprador paga servicio y procesamiento con desglose, panel con cupos, descuentos, cortesías y venta en tiempo real, exportación de compradores, QR único que vale una vez, transferencia oficial, soporte por WhatsApp, revisión del evento antes de publicar). Cualquier otra función: verificarla en `src/` o `api/` antes de nombrarla, y no afirmar detalles (por ejemplo qué columnas trae la exportación) sin verlos en el código.
- Todo dato del mundo (leyes, montos, topes, plazos) con fuente oficial abierta y lista «Fuentes» al pie. Sin fuente, afuera. Lo impositivo termina en «confirmalo con tu contador»: no damos asesoramiento.
- **ENTRÁ no es acreditación.** Congresos, corporativos, invitados con credencial: eso es PASE (pase.somosder.ar). Staff: LABURO.
- 900 a 1.300 palabras, 3 o 4 FAQ (respuestas de 2 a 4 oraciones que se entiendan solas).

## Estructura HTML de cada nota
Copiar una nota existente de `public/blog/` (por ejemplo `no-me-llego-la-entrada-al-mail.html`). Orden fijo:
- `<head>`: charset, viewport, theme-color `#0a0a0a`, color-scheme dark, `<title>` (Title Case, termina en `| ENTRÁ`), description (140 a 170 caracteres), canonical `https://www.entratickets.com/blog/<slug>`, iconos, `<link rel="stylesheet" href="/blog.css">`, og:* (type article, site_name ENTRÁ, image `/og-image.png`), twitter:card.
- Dos `application/ld+json`: `Article` (headline, description, inLanguage es-AR, datePublished y dateModified, author Organization SOMOS DER, publisher Organization ENTRÁ, mainEntityOfPage, image) y `FAQPage` con las mismas preguntas que el cuerpo.
- `<body>`: `header.nav > .wrap.nav-in` (wordmark `ENTR<b>Á</b>` + `a.btn.btn-ghost` Blog), `.wrap > article` con `p.kicker` («Guía» o «Guía para productores»), `h1`, `p.meta` («Por SOMOS DER · fecha · N min de lectura»), `p.lead`, secciones `h2`, `ul`, `<b>`, `h2 Preguntas frecuentes` con `<details>` (el primero `open`) y `<summary>`, `div.cta` (h2, p, `a.btn.btn-primary`), `div.more` (kicker «Seguir leyendo» + 2 enlaces con «→»), y si hay datos externos un segundo `div.more` con kicker «Fuentes» y `<ul>` de enlaces. Footer igual al de las demás.
- Enlaces: 1 o 2 a `/vender-entradas/<slug>` (fiestas, recitales-y-shows, festivales, teatro, talleres-y-charlas, eventos-gratuitos-con-reserva) y 2 a notas existentes.

## Checklist de publicación
1. Archivo en `public/blog/<slug>.html` (slug = nombre del archivo).
2. Validar: JSON-LD parsea con `python3 -c json.loads`, 0 guiones largos, enlaces internos existen en `public/`.
3. Entrada en `api/sitemap.ts` (`['/blog/<slug>', 'monthly', '0.6']`).
4. Tarjeta `a.hcard` en `public/blog/index.html` (kicker, h2, resumen, meta con fecha y minutos).
5. Línea en la sección «Blog» de `public/llms.txt`.
6. Build, deploy, verificar 200 en producción y que aparezca en `/sitemap.xml`.
7. Mandar la URL a IndexNow.

## Publicadas (no repetir)
Cómo elegir ticketera y comisiones · comprar sin estafas · control de acceso el día del evento · datos de ventas que tiene que dar una ticketera · entradas truchas y duplicadas · evento cancelado o reprogramado · me olvidé el celular · no me llegó la entrada al mail · checklist del primer evento · para qué sirve el QR · precio y tandas · promocionar y medir ventas.
Borrador 29/10: facturar la venta de entradas si sos monotributista · cortesías e invitaciones.

## Próximos 15 temas (búsqueda que atacan)
1. **Cuántas entradas vender según la capacidad habilitada del lugar** («capacidad máxima salón CABA», «cuántas personas entran en un local»). Necesita norma de CABA abierta (la web de la AGC dio 503 el 29/10: reintentar).
2. **Puedo devolver una entrada comprada online** («devolución entradas ley defensa del consumidor», «botón de arrepentimiento entradas»). Ley 24.240 art. 34 abierta; falta abrir CCyC art. 1116 y la Res. 424/2020 antes de afirmar si aplica a espectáculos con fecha.
3. **Cómo vender entradas por Mercado Pago para un evento** («vender entradas con mercado pago»). Solo lo que hace `api/create-payment.ts` y `mp-oauth-*`.
4. **Cómo transferir una entrada a otra persona sin riesgo** («transferir entrada a un amigo»). Verificar flujo en `send-transfer-email.ts` y ClaimTicket.
5. **Descuentos y códigos promocionales para un evento** («código de descuento entradas evento»).
6. **Vender entradas para una obra de teatro independiente** («cómo vender entradas teatro independiente»).
7. **Lista anticipada vs. puerta: conviene vender en la puerta** («vender entradas en la puerta»).
8. **Permiso para hacer una fiesta o evento en CABA** («permiso evento CABA»). Solo con fuente de buenosaires.gob.ar.
9. **Cómo armar un evento con cupo para un taller o clase** («inscripción taller con cupo»).
10. **Abono o entrada por día en un festival** («abono festival o entrada por día»).
11. **SADAIC y AADI-CAPIF: qué pagar si pasás música** («SADAIC fiesta privada», «AADI CAPIF evento»). Solo con fuentes oficiales de cada entidad.
12. **Cómo saber si una entrada es original antes de comprarla de reventa** («entrada original o falsa»).
13. **Qué hacer si se cae internet en la puerta** («control de acceso sin internet»). Verificar en el escáner qué pasa offline antes de escribir.
14. **Qué datos pedir a quien compra y por qué (DNI, mail)** («ticketera pide DNI»).
15. **Evento gratuito: cómo evitar que reserven y no vengan** («evento gratis no vienen los inscriptos»).
