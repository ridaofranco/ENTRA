---
name: cobro-check
description: Revisar un cambio en api/ (cobros de MercadoPago) contra las 4 reglas de COBROS.md antes de pushear.
disable-model-invocation: true
---

# Chequeo de cobros de ENTRÁ

1. `git diff origin/main -- api/` (o el diff que se indique) y leer `COBROS.md`.
2. Para cada archivo tocado (`mp-webhook.ts`, `create-payment.ts`, `_emitir-entradas.ts`, `_cron-reconciliar.ts` y afines), responder con evidencia (archivo:línea):
   - Regla 1: ¿se compara el monto pagado (`transaction_amount`) contra el total guardado en la base ANTES de emitir?
   - Regla 2: ¿error inesperado = 500 (MP reintenta) y error permanente = 200 explícito y logueado con `permanent: true`?
   - Regla 3: ¿un mismo pago no puede emitir entradas dos veces (idempotencia por id de pago)?
   - Regla 4: ¿se espera a que el mail salga antes de terminar la función?
3. Tabla final: regla, OK / ROTA / NO APLICA, evidencia. Si alguna está ROTA, no pushear.
4. Además: que no se haya tocado `.env*`, `firebase-applet-config.json` ni las reglas de Firestore sin probarlas.
