# Marea

App web (PWA) para llevar el ciclo menstrual desde el iPhone. Sin servidor, sin cuentas: los datos se quedan en el `localStorage` del propio móvil.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Página de la app |
| `app.css` | Estilos |
| `logic.js` | Cálculos: reglas, medias, predicciones, fases, patrones, `.ics` |
| `app.js` | Interfaz: pantallas, registro diario, copias de seguridad |
| `sw.js` | Service worker: hace que funcione sin conexión |
| `manifest.webmanifest`, `icons/` | Lo que necesita para instalarse como app |
| `fonts/gloock.woff2` | Tipografía de títulos y números (SIL Open Font License) |

## Publicarla en GitHub Pages

1. Crea un repo (por ejemplo `marea`) y sube el contenido de esta carpeta a la raíz.
2. En el repo: Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Quedará en `https://TU_USUARIO.github.io/marea/`.

## Instalarla en el iPhone

1. Abre la URL en **Safari**.
2. Compartir → **Añadir a pantalla de inicio**.
3. Ábrela desde el icono y **empieza a apuntar ahí**, no en Safari: Safari y la app instalada no comparten datos.

## Dónde se guardan los datos (léelo)

- Los datos están ligados al **dominio** desde el que se instala. Si un día la mueves a otra URL (por ejemplo a tu VPS), la app nueva empezará vacía: guarda una copia en la antigua y recupérala en la nueva.
- Instalada en la pantalla de inicio, iOS no aplica el borrado de 7 días que sí aplica en Safari.
- Se pierden si borras el icono de la pantalla de inicio o cambias de iPhone sin copia. Usa **Ajustes → Guardar copia** de vez en cuando (la app te lo recuerda cada 30 días).

## Actualizar

Cambia lo que quieras y sube `VERSION` en `sw.js` (por ejemplo `marea-1.0.1`). La app instalada coge la versión nueva la segunda vez que la abras.

## Pruebas

`node tests/logic.test.js` (si conservas la carpeta de tests).
