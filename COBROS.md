# Las 4 reglas de un cobro (ENTRÁ)

Item 4 del plan único: hasta el 26/7/2026 estas reglas no estaban escritas en
ningún lado. Vivían en la cabeza de quien había arreglado el último bug, así que
cada producto que empezaba a cobrar volvía a cometer los mismos errores. **Este
archivo va en los tres repos que cobran o van a cobrar (ENTRÁ, LABURO, PASE).**

No se unifica el CÓDIGO de MercadoPago: son tres casos distintos (venta de
entradas con split, cobro de un evento a un cliente, y suscripción) y el refactor
tocaría plata sin ganar nada. Lo que se unifica es **el checklist**.

---

## Regla 1. Verificar cuánto se pagó ANTES de entregar

Nunca confiar en el monto que viene del navegador ni en que el link de pago siga
valiendo lo mismo que cuando se generó. Comparar contra el precio real guardado
en la base.

**Por qué:** editando la orden entre el link de pago y el webhook salían tickets
sin pagar. Fue un agujero real de ENTRÁ, cerrado el 25/7.

> **Estado en ENTRÁ: ✅** `api/mp-webhook.ts` compara `payment.transaction_amount`
> contra `orderData.total` antes de emitir un solo ticket.

## Regla 2. Devolver error para que MercadoPago reintente, nunca un 200 silencioso

Si el proceso falla a mitad de camino, hay que devolver 500. MP reintenta y el
comprador termina recibiendo lo suyo. Un 200 le dice a MP "listo, gracias" y el
pago queda cobrado sin entregar, para siempre y sin que nadie se entere.

**La contracara, igual de importante:** un error PERMANENTE (sin stock, evento
inexistente) no se arregla reintentando. Ahí sí va 200, pero explícito y logueado,
porque si no MP reintenta para siempre mientras el comprador quedó pagado y sin
entradas. Ese también fue un bug real de ENTRÁ.

> **Estado en ENTRÁ: ✅** 500 ante error inesperado; 200 con `permanent: true` y
> el código del error para los casos que no tiene sentido reintentar.

## Regla 3. No entregar dos veces el mismo pago

MP notifica el mismo pago varias veces. Sin candado se emiten los tickets dos
veces, o sale el mismo mail dos veces.

**Dónde va el candado:** en la base, en la misma sentencia que hace el trabajo
(un `UPDATE ... WHERE ya_procesado IS NULL`), no en un `if` del código. Dos
webhooks en paralelo pasan los dos por el `if`.

> **Estado en ENTRÁ: ✅** el webhook es idempotente y la emisión va en una
> transacción de Firestore. Para el mail de pago rechazado hay un candado aparte
> (`paymentFailedEmailAt`), porque decirle dos veces a alguien que no pudo pagar
> es peor que no decírselo.

## Regla 4. Esperar a que el mail salga antes de terminar

El aviso al comprador se `await`ea dentro del flujo. Nada de fire-and-forget.

**Por qué:** en serverless la función se congela apenas devolvés la respuesta. Un
mail lanzado sin await se corta a la mitad. **Ese es exactamente el motivo por el
que ENTRÁ estuvo mandando entradas que nunca llegaban.**

> **Estado en ENTRÁ: ✅** `mp-webhook.ts` awaitea el llamado a
> `/api/send-ticket-email` antes de responder, y si falla avisa por Telegram
> (`api/_alerta.ts`): alguien pagó y no recibió su entrada es la alerta más cara
> que existe.

---

## Antes de que un producto nuevo empiece a cobrar

Las cuatro, verificadas contra el código y no de memoria. Y una quinta que no es
del cobro pero se paga igual de caro: **que avise cuando algo de esto falle**. Los
bugs de esta semana se encontraron auditando a mano, y en todos los casos el
sistema decía "todo bien".
