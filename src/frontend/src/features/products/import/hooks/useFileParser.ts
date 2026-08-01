import { useState, useCallback } from 'react';

interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  fileSize: number;
}

export function useFileParser() {
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setParseError(null);

    try {
      const XLSX = await import('xlsx');

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (workbook.SheetNames.length === 0) {
        throw new Error('El archivo no contiene hojas de cálculo');
      }

      const sheetName = workbook.SheetNames[0]!;
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error('La hoja de cálculo está vacía');
      }
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      if (data.length === 0) {
        throw new Error('La hoja de cálculo no contiene datos');
      }

      const headerSet = new Set<string>();
      for (const row of data) {
        for (const key of Object.keys(row)) {
          if (key && !key.startsWith('Unnamed') && key.trim() !== '') {
            headerSet.add(key);
          }
        }
      }

      const headers = Array.from(headerSet);

      setParsedFile({
        headers,
        rows: data,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al parsear el archivo');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const clearParsedFile = useCallback(() => {
    setParsedFile(null);
    setParseError(null);
  }, []);

  return { parsedFile, isParsing, parseError, parseFile, clearParsedFile };
}
