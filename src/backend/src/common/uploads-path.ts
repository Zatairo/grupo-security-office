import * as path from 'path';

/**
 * Directorio de uploads del backend.
 * Resuelto relativo al directorio de trabajo (src/backend en dev, test y
 * producción), lo que garantiza consistencia entre escritura y servido
 * estático sin depender de la profundidad del build (src vs dist).
 */
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

/** Prefijo de URL pública para archivos subidos */
export const UPLOADS_URL_PREFIX = '/uploads';
