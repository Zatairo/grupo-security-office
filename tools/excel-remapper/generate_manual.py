"""
generate_manual.py
------------------
Genera el manual de usuario en PDF para la herramienta Remapper Excel/CSV.
Ejecutar: python generate_manual.py
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF


class ManualPDF(FPDF):
    """Clase personalizada para el manual con encabezado y pie de pagina."""

    def header(self) -> None:
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "Remapper Excel/CSV - Manual de Usuario", align="L")
        self.cell(0, 8, "Grupo Security", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Pagina {self.page_no()}/{{nb}}", align="C")

    def chapter_title(self, num: str, title: str) -> None:
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(30, 60, 120)
        self.cell(0, 12, f"{num}. {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(30, 60, 120)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def section_title(self, title: str) -> None:
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(60, 60, 60)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def body_text(self, text: str) -> None:
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet(self, text: str) -> None:
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.cell(8, 6, "-")
        self.multi_cell(0, 6, text)
        self.ln(1)

    def code_block(self, text: str) -> None:
        self.set_font("Courier", "", 9)
        self.set_fill_color(240, 240, 240)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5, text, fill=True)
        self.ln(3)

    def note_box(self, text: str) -> None:
        self.set_font("Helvetica", "I", 9)
        self.set_fill_color(255, 250, 230)
        self.set_text_color(100, 80, 0)
        self.multi_cell(0, 5, f"Nota: {text}", fill=True)
        self.ln(3)

    def table_header(self, cols: list[str], widths: list[int]) -> None:
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(30, 60, 120)
        self.set_text_color(255, 255, 255)
        for i, col in enumerate(cols):
            self.cell(widths[i], 8, col, border=1, fill=True, align="C")
        self.ln()

    def table_row(self, cols: list[str], widths: list[int]) -> None:
        self.set_font("Helvetica", "", 9)
        self.set_text_color(40, 40, 40)
        self.set_fill_color(255, 255, 255)
        for i, col in enumerate(cols):
            self.cell(widths[i], 7, col, border=1, align="L")
        self.ln()


def build_manual(output_path: str | Path) -> Path:
    """Generar el manual completo en PDF."""
    pdf = ManualPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)

    # === Portada ===
    pdf.add_page()
    pdf.ln(50)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(30, 60, 120)
    pdf.cell(0, 15, "Remapper Excel/CSV", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 16)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 10, "Manual de Usuario", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, "Grupo Security", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Version 1.0", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(30)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(
        0,
        8,
        "Herramienta local para analizar, mapear y reestructurar",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.cell(
        0,
        8,
        "archivos Excel/CSV hacia una estructura destino configurable.",
        align="C",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    # === Contenido ===
    pdf.add_page()

    # --- 1. Que es ---
    pdf.chapter_title("1", "Que es esta herramienta")
    pdf.body_text(
        "Remapper Excel/CSV es una aplicacion de escritorio que permite:\n"
        "- Cargar archivos Excel (.xlsx) o CSV.\n"
        "- Analizar automaticamente la estructura del archivo.\n"
        "- Detectar hojas, fila de encabezados y columnas disponibles.\n"
        "- Mapear cada columna origen a un campo destino que vos definas.\n"
        "- Ignorar columnas que no necesitas.\n"
        "- Asignar valores por defecto para campos faltantes.\n"
        "- Generar un nuevo archivo limpio con la estructura final.\n"
        "- Guardar y reutilizar el mapping configurado."
    )
    pdf.note_box(
        "Esta herramienta NO accede a internet, base de datos ni al proyecto web. "
        "Es 100% local y offline."
    )

    # --- 2. Requisitos ---
    pdf.chapter_title("2", "Requisitos previos")
    pdf.body_text("Para usar la herramienta necesitas:")
    pdf.bullet("Python 3.11 o superior instalado.")
    pdf.bullet("Las dependencias: pandas, openpyxl, fpdf2.")
    pdf.body_text("Instalar dependencias:")
    pdf.code_block("pip install -r requirements.txt")

    # --- 3. Como iniciar ---
    pdf.chapter_title("3", "Como iniciar la aplicacion")
    pdf.body_text("Abre una terminal y ejecuta:")
    pdf.code_block("cd tools/excel-remapper\npython main.py")
    pdf.body_text(
        "Se abrira una ventana con la interfaz grafica. "
        "La barra de estado inferior muestra el estado actual de la aplicacion."
    )

    # --- 4. Interfaz ---
    pdf.chapter_title("4", "Descripcion de la interfaz")
    pdf.section_title("4.1 Barra superior (Archivo Origen)")
    pdf.bullet("Campo de ruta: Muestra la ruta del archivo cargado.")
    pdf.bullet("Examinar...: Abre un dialogo para seleccionar un archivo Excel o CSV.")
    pdf.bullet("Cargar Mapping...: Carga un mapping previamente guardado en JSON.")
    pdf.bullet("Schema (JSON): Campo para cargar un schema destino editable.")

    pdf.section_title("4.2 Pestana Inspeccion")
    pdf.bullet("Selector de hoja: Permite elegir que hoja analizar (en archivos Excel).")
    pdf.bullet(
        "Area de texto: Muestra la info del archivo: fila de encabezados detectada, "
        "total de filas, columnas con sus tipos de datos y valores de ejemplo."
    )

    pdf.section_title("4.3 Pestana Mapping")
    pdf.bullet(
        "Auto-detectar Mapping: Intenta emparejar automaticamente las columnas "
        "origen con los campos del schema cargado."
    )
    pdf.bullet("Agregar Campo: Agrega una fila nueva de mapping vacia.")
    pdf.bullet("Eliminar Seleccionado: Borra la fila seleccionada.")
    pdf.bullet("Guardar Mapping: Exporta la configuracion actual a un archivo JSON.")
    pdf.bullet(
        "Tabla de mapping: Muestra Columna Origen, Campo Destino, "
        "Valor por Defecto e Ignorado. Haz doble click en cualquier celda para editarla."
    )

    pdf.section_title("4.4 Pestana Vista Previa y Exportar")
    pdf.bullet(
        "Ejecutar Transformacion: Aplica el mapping configurado y muestra "
        "una preview de los resultados."
    )
    pdf.bullet(
        "Exportar...: Guarda el archivo resultante en formato .xlsx o .csv."
    )

    # --- 5. Flujo paso a paso ---
    pdf.chapter_title("5", "Flujo de uso paso a paso")
    pdf.body_text("Paso 1: Cargar el archivo")
    pdf.bullet('Haz click en "Examinar..." junto a Archivo Origen.')
    pdf.bullet("Selecciona tu archivo Excel (.xlsx) o CSV.")
    pdf.bullet(
        "La herramienta lo analizara automaticamente y mostrara las columnas detectadas "
        "en la pestana Inspeccion."
    )

    pdf.body_text("Paso 2: Revisar la inspeccion")
    pdf.bullet("En la pestana Inspeccion verifica:")
    pdf.bullet("  - Que la fila de encabezados detectada sea correcta.")
    pdf.bullet("  - Que las columnas mostradas coincidan con las de tu archivo.")
    pdf.bullet("  - Los valores de ejemplo para confirmar que se leyeron bien.")
    pdf.bullet("Si hay varias hojas, usa el selector de hoja para cambiar.")

    pdf.body_text("Paso 3: Cargar schema destino (opcional)")
    pdf.bullet('Haz click en "Examinar..." junto a Schema (JSON).')
    pdf.bullet("Selecciona un archivo JSON que defina los campos destino.")
    pdf.bullet(
        "El schema define que campos debe tener el archivo de salida. "
        "Puedes crear uno propio o usar el ejemplo incluido."
    )
    pdf.note_box(
        "Si no cargas schema, el auto-detect mapeara columnas origen "
        "como campos destino con el mismo nombre."
    )

    pdf.body_text("Paso 4: Configurar el mapping")
    pdf.bullet("Ve a la pestana Mapping.")
    pdf.bullet(
        'Opcion A - Auto-detectar: Click en "Auto-detectar Mapping". '
        "La herramienta intentara emparejar columnas automaticamente."
    )
    pdf.bullet(
        "Opcion B - Manual: Click en 'Agregar Campo' y edita cada fila "
        "con doble click."
    )
    pdf.bullet("Para cada mapeo configura:")
    pdf.bullet("  - Columna Origen: nombre exacto de la columna del Excel.")
    pdf.bullet("  - Campo Destino: nombre del campo en tu schema.")
    pdf.bullet(
        "  - Valor por Defecto: valor si la columna esta vacia o no existe."
    )
    pdf.bullet("  - Ignorado: doble click para cambiar entre Si y No.")

    pdf.body_text("Paso 5: Ejecutar y revisar")
    pdf.bullet("Ve a la pestana Vista Previa y Exportar.")
    pdf.bullet('Click en "Ejecutar Transformacion".')
    pdf.bullet("Revisa la preview: filas procesadas, advertencias, datos ignorados.")
    pdf.bullet("Verifica que los datos se ven correctos.")

    pdf.body_text("Paso 6: Exportar")
    pdf.bullet('Click en "Exportar...".')
    pdf.bullet("Elegi la ubicacion y nombre del archivo de salida.")
    pdf.bullet("Podes elegir .xlsx o .csv como formato.")
    pdf.bullet("El archivo se genera con las columnas destino en el orden correcto.")

    pdf.body_text("Paso 7: Guardar el mapping (opcional)")
    pdf.bullet('Click en "Guardar Mapping" en la pestana Mapping.')
    pdf.bullet("Guarda un archivo JSON con toda tu configuracion.")
    pdf.bullet(
        "La proxima vez, carga ese JSON con 'Cargar Mapping...' "
        "y se restaura todo automaticamente."
    )

    # --- 6. Ejemplo completo ---
    pdf.chapter_title("6", "Ejemplo completo")
    pdf.section_title("6.1 Archivo origen (antes)")
    pdf.body_text("Suponiendo un Excel con estas columnas:")
    pdf.code_block(
        "Cod. Producto | Nombre         | Familia      | Precio  | Observaciones\n"
        "P001         | Laptop Dell    | Computadores | 599990  | con cargador\n"
        "P002         | Mouse Logitech | Perifericos  | 29990   |\n"
        "P003         | Teclado Mecan. | Perifericos  | 49990   | switch rojo"
    )

    pdf.section_title("6.2 Schema destino (JSON)")
    pdf.code_block(
        "{\n"
        '  "fields": [\n'
        '    {"name": "sku",        "type": "string"},\n'
        '    {"name": "nombre",     "type": "string"},\n'
        '    {"name": "categoria",  "type": "string"},\n'
        '    {"name": "precio",     "type": "number"},\n'
        '    {"name": "moneda",     "type": "string"},\n'
        '    {"name": "estado",     "type": "string"}\n'
        "  ]\n"
        "}"
    )

    pdf.section_title("6.3 Mapping configurado")
    widths = [50, 40, 40, 30, 30]
    pdf.table_header(
        ["Columna Origen", "Campo Destino", "Defecto", "Ignorado"], widths[:4]
    )
    pdf.table_row(["Cod. Producto", "sku", "", "No"], widths[:4])
    pdf.table_row(["Nombre", "nombre", "", "No"], widths[:4])
    pdf.table_row(["Familia", "categoria", "Sin cat.", "No"], widths[:4])
    pdf.table_row(["Precio", "precio", "0", "No"], widths[:4])
    pdf.table_row(["", "moneda", "CLP", "No"], widths[:4])
    pdf.table_row(["", "estado", "activo", "No"], widths[:4])
    pdf.table_row(["Observaciones", "", "", "Si"], widths[:4])
    pdf.ln(5)

    pdf.section_title("6.4 Archivo de salida (despues)")
    pdf.code_block(
        "sku  | nombre          | categoria   | precio | moneda | estado\n"
        "P001 | Laptop Dell     | Computadores| 599990 | CLP    | activo\n"
        "P002 | Mouse Logitech  | Perifericos | 29990  | CLP    | activo\n"
        "P003 | Teclado Mecan.  | Perifericos | 49990  | CLP    | activo"
    )
    pdf.body_text(
        "La columna 'Observaciones' se ignoro. "
        "'moneda' y 'estado' se completaron con valores por defecto."
    )

    # --- 7. Formato del schema ---
    pdf.chapter_title("7", "Formato del schema JSON")
    pdf.body_text("El schema es un archivo JSON con esta estructura:")
    pdf.code_block(
        "{\n"
        '  "name": "nombre_del_schema",\n'
        '  "version": "1.0",\n'
        '  "description": "Descripcion opcional",\n'
        '  "fields": [\n'
        "    {\n"
        '      "name": "nombre_campo",\n'
        '      "type": "string|number|boolean",\n'
        '      "required": true|false,\n'
        '      "description": "Descripcion opcional",\n'
        '      "default": "valor_por_defecto_opcional"\n'
        "    }\n"
        "  ]\n"
        "}"
    )
    pdf.body_text("Campos requeridos: Solo 'name' es obligatorio dentro de cada field.")
    pdf.body_text(
        "La herramienta usa la lista de 'fields' para el auto-detect y la validacion. "
        "Podes crear tantos schemas como necesites para diferentes tipos de archivos."
    )

    # --- 8. Formato del mapping ---
    pdf.chapter_title("8", "Formato del mapping JSON")
    pdf.body_text("El mapping guardado tiene esta estructura:")
    pdf.code_block(
        "{\n"
        '  "source_file": "ruta/al/archivo.xlsx",\n'
        '  "sheet_name": "Hoja1",\n'
        '  "header_row": 2,\n'
        '  "mappings": [\n'
        "    {\n"
        '      "source_column": "Cod. Producto",\n'
        '      "destination_field": "sku",\n'
        '      "default_value": "",\n'
        '      "ignored": false\n'
        "    },\n"
        "    {\n"
        '      "source_column": "Observaciones",\n'
        '      "destination_field": "",\n'
        '      "default_value": "",\n'
        '      "ignored": true\n'
        "    }\n"
        "  ]\n"
        "}"
    )
    pdf.body_text(
        "Podes editar este JSON manualmente con cualquier editor de texto "
        "y cargarlo despues con 'Cargar Mapping...'."
    )

    # --- 9. Consejos ---
    pdf.chapter_title("9", "Consejos y buenas practicas")
    pdf.bullet(
        "Cierra el archivo en Excel antes de cargarlo en la herramienta. "
        "Si esta abierto, obtendras un error de permiso."
    )
    pdf.bullet(
        "Si el archivo esta en OneDrive y se esta sincronizando, "
        "espera a que termine antes de abrirlo."
    )
    pdf.bullet(
        "Usa el auto-detect como punto de partida y luego ajusta manualmente. "
        "Es mas rapido que empezar de cero."
    )
    pdf.bullet(
        "Guarda el mapping despues de configurarlo. "
        "Te ahorrara tiempo la proxima vez que proceses un archivo similar."
    )
    pdf.bullet(
        "Los valores por defecto son utiles para campos que siempre tienen "
        "el mismo valor (ej: moneda=CLP, estado=activo)."
    )
    pdf.bullet(
        "Revisa siempre la pestana de Vista Previa antes de exportar "
        "para confirmar que los datos se transformaron correctamente."
    )
    pdf.bullet(
        "Podes crear multiples schemas JSON para diferentes tipos de archivos "
        "(productos, clientes, proveedores, etc.)."
    )

    # --- 10. Solucion de problemas ---
    pdf.chapter_title("10", "Solucion de problemas")

    pdf.section_title("Error: Permission denied")
    pdf.bullet("El archivo esta abierto en Excel. Cerralo y reintenta.")
    pdf.bullet("OneDrive lo esta sincronizando. Espera o copia el archivo al escritorio.")
    pdf.bullet(
        "El nombre del archivo tiene caracteres problematicos. "
        "Renombralo quitando saltos de linea o caracteres especiales."
    )

    pdf.section_title("Error: File not found")
    pdf.bullet("Verifica que la ruta del archivo sea correcta.")
    pdf.bullet("Si copiaste la ruta desde OneDrive, pegala directamente en Examinar.")

    pdf.section_title("El auto-detect no empareja bien")
    pdf.bullet(
        "El auto-detect usa coincidencia exacta, por substrings y por "
        "superposicion de palabras. Si los nombres son muy diferentes, "
        "configura el mapping manualmente."
    )

    pdf.section_title("La fila de encabezados no es la correcta")
    pdf.bullet(
        "La herramienta usa una heuristica para detectar la fila mas probable. "
        "Si no es la correcta, los datos podrian verse mal en la inspeccion. "
        "Esto es technical y no afecta el mapeo manual."
    )

    pdf.section_title("El archivo de salida tiene columnas vacias")
    pdf.bullet(
        "Revisa que hayas configurado valores por defecto para los campos "
        "que no tienen columna origen asignada."
    )

    # Guardar
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(path))
    return path


if __name__ == "__main__":
    out = build_manual("manual/Remapper Excel-CSV - Manual de Usuario.pdf")
    print(f"Manual generado: {out}")
