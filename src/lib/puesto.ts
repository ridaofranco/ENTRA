// ============================================================================
// PUESTO DE CONTROL — qué teléfono escaneó cada entrada
// ============================================================================
// El control de acceso funciona sin internet: Firestore guarda las escrituras
// en la caché local del teléfono y las sincroniza al reconectar. Eso es lo que
// permite operar una puerta en un predio sin señal, y está bien.
//
// El límite, que hasta acá no estaba escrito en ningún lado del producto: sin
// conexión, cada teléfono SOLO conoce lo que él mismo escaneó. Con dos puestos
// de control y la red caída, la misma entrada puede pasar por los dos, y cuando
// vuelve internet las dos escrituras se sincronizan sin que nadie se entere.
//
// No hay manera de impedirlo sin red (es una partición: los dos teléfonos están
// incomunicados por definición). Lo que sí se puede, y es lo que hace este
// archivo, es dejar de perder la evidencia: cada ingreso queda firmado con el
// puesto que lo validó, así al reconectar el panel puede mostrar exactamente
// qué entradas pasaron dos veces y por qué puertas. De un agujero silencioso a
// un dato que el productor ve.

const CLAVE_ID = 'entra_puesto_id';
const CLAVE_NOMBRE = 'entra_puesto_nombre';

/**
 * Identificador estable de este teléfono. Es aleatorio y local: no identifica a
 * una persona ni sale de este dispositivo salvo pegado al registro de ingreso.
 * Sobrevive al cierre del navegador (localStorage) porque un evento dura horas
 * y el operador puede recargar la pantalla varias veces.
 */
export function puestoId(): string {
  try {
    let id = localStorage.getItem(CLAVE_ID);
    if (!id) {
      id = (crypto?.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      localStorage.setItem(CLAVE_ID, id);
    }
    return id;
  } catch {
    // Modo privado o storage bloqueado: mejor un id efímero que ninguno.
    return 'sin-id';
  }
}

/** Nombre que le puso el operador a esta puerta ("Puerta 1", "VIP", "Prensa"). */
export function puestoNombre(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) || '';
  } catch {
    return '';
  }
}

export function guardarPuestoNombre(nombre: string): void {
  try {
    localStorage.setItem(CLAVE_NOMBRE, nombre.trim().slice(0, 40));
  } catch {
    /* si no se puede guardar, el ingreso igual queda firmado con el id */
  }
}

/** Los dos campos que se le pegan a cada registro de ingreso. */
export function firmaPuesto(): { deviceId: string; puesto: string } {
  return { deviceId: puestoId(), puesto: puestoNombre() };
}
