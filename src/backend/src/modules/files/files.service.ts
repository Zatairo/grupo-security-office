import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const FILES_URL_PREFIX = '/api/files';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  /** Guarda bytes en BD y devuelve la URL pública para servirlos. */
  async store(data: Buffer, mimeType: string): Promise<{ id: string; url: string }> {
    const file = await this.prisma.uploadedFile.create({
      data: { mimeType, data },
    });
    return { id: file.id, url: `${FILES_URL_PREFIX}/${file.id}` };
  }

  async get(id: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) return null;
    return { data: file.data as Buffer, mimeType: file.mimeType };
  }

  /**
   * Borra un archivo a partir de una URL previamente devuelta por `store`.
   * No-op silencioso si la URL no apunta a este almacén (ej. logo externo)
   * o si el archivo ya no existe.
   */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url || !url.startsWith(`${FILES_URL_PREFIX}/`)) return;
    const id = url.slice(`${FILES_URL_PREFIX}/`.length);
    try {
      await this.prisma.uploadedFile.delete({ where: { id } });
    } catch {
      // El archivo puede no existir; no bloquea el borrado lógico del dueño.
    }
  }
}
