"""
ui/app.py
---------
Interfaz gráfica Tkinter para la herramienta Remapper Excel/CSV.
Selección de archivos, inspección, editor de mapping y exportación.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from tkinter import (
    END,
    filedialog,
    messagebox,
    simpledialog,
    StringVar,
    Tk,
    Toplevel,
    Scrollbar,
    Frame,
    Label,
    Entry,
    Button,
    Text,
    LabelFrame,
    BOTH,
    VERTICAL,
    X,
    Y,
    LEFT,
    RIGHT,
    YES,
    DISABLED,
    NORMAL,
    W,
)
from tkinter import ttk
from typing import Any

from inspector.analyzer import FileAnalysis, SheetInfo, analyze_file
from mapper.mapping import (
    ColumnMapping,
    MappingConfig,
    build_mapping_from_analysis,
    load_mapping,
    save_mapping,
    validate_mapping,
)
from transformer.transform import apply_mapping, TransformResult
from exporter.export import export_data

logger = logging.getLogger(__name__)

# Carpeta de perfiles de mapeo por proveedor (junto a la herramienta)
PROFILES_DIR = Path(__file__).resolve().parent.parent / "profiles"


class RemapperApp:
    """Ventana principal de la aplicación Remapper Excel/CSV."""

    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("Remapper Excel/CSV — Grupo Security")
        self.root.geometry("1100x750")
        self.root.minsize(900, 600)

        # Estado
        self.file_path: StringVar = StringVar(value="")
        self.analysis: FileAnalysis | None = None
        self.sheet_var: StringVar = StringVar()
        self.schema_path: StringVar = StringVar(value="")
        self.schema_fields: list[str] = []
        self.mapping_config = MappingConfig()
        self.mapping_rows: list[dict[str, Any]] = []

        # Estado de perfiles de proveedor
        self.profile_var: StringVar = StringVar(value="")
        self.profile_combo: ttk.Combobox | None = None

        # Elementos UI para refresh
        self.sheet_combo: ttk.Combobox | None = None
        self.mapping_frame: Frame | None = None
        self.mapping_canvas: Any = None
        self.status_var: StringVar = StringVar(value="Listo")

        self._build_ui()

        # Al iniciar: crear profiles/ si no existe y listar perfiles disponibles
        self._refresh_profiles()

    # ------------------------------------------------------------------
    # Construcción de la interfaz
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        """Construir el layout principal de la aplicación."""
        main_frame = Frame(self.root, padx=10, pady=10)
        main_frame.pack(fill=BOTH, expand=YES)

        self._build_file_section(main_frame)
        self._build_profile_section(main_frame)
        self._build_notebook(main_frame)
        self._build_status_bar(main_frame)

    def _build_file_section(self, parent: Frame) -> None:
        """Construir la sección de selección de archivo."""
        file_frame = LabelFrame(parent, text=" Archivo Origen ", padx=8, pady=6)
        file_frame.pack(fill=X, pady=(0, 8))

        row = Frame(file_frame)
        row.pack(fill=X)

        Entry(row, textvariable=self.file_path, state=DISABLED, width=80).pack(
            side=LEFT, fill=X, expand=YES, padx=(0, 8)
        )
        Button(row, text="Examinar...", command=self._on_browse_file).pack(
            side=LEFT, padx=(0, 4)
        )
        Button(row, text="Cargar Mapping...", command=self._on_load_mapping).pack(
            side=LEFT, padx=(0, 4)
        )

        # Selección de schema
        row2 = Frame(file_frame)
        row2.pack(fill=X, pady=(6, 0))
        Label(row2, text="Schema (JSON):").pack(side=LEFT)
        Entry(row2, textvariable=self.schema_path, state=DISABLED, width=60).pack(
            side=LEFT, fill=X, expand=YES, padx=(8, 8)
        )
        Button(row2, text="Examinar...", command=self._on_browse_schema).pack(
            side=LEFT, padx=(0, 4)
        )

    def _build_profile_section(self, parent: Frame) -> None:
        """Construir la sección de perfiles de proveedor.

        Permite guardar/cargar el MappingConfig actual como un perfil
        reutilizable por proveedor (archivo JSON en profiles/<nombre>.json).
        """
        profile_frame = LabelFrame(parent, text=" Perfil de Proveedor ", padx=8, pady=6)
        profile_frame.pack(fill=X, pady=(0, 8))

        row = Frame(profile_frame)
        row.pack(fill=X)

        Label(row, text="Perfil:").pack(side=LEFT)
        self.profile_combo = ttk.Combobox(
            row, textvariable=self.profile_var, state="readonly", width=30
        )
        self.profile_combo.pack(side=LEFT, padx=(8, 0))
        Button(row, text="Guardar Perfil", command=self._on_save_profile).pack(
            side=LEFT, padx=(6, 4)
        )
        Button(row, text="Cargar Perfil", command=self._on_load_profile).pack(
            side=LEFT, padx=(0, 4)
        )
        Button(row, text="Refrescar", command=self._refresh_profiles).pack(
            side=LEFT, padx=(0, 4)
        )

        hint = Label(
            profile_frame,
            text="Guardar Perfil: guarda el mapeo actual por proveedor para reutilizarlo "
            "cada mes sin re-mapear.",
            anchor=W,
        )
        hint.pack(fill=X, pady=(4, 0))

    def _build_notebook(self, parent: Frame) -> None:
        """Construir el notebook con pestañas."""
        self.notebook = ttk.Notebook(parent)
        self.notebook.pack(fill=BOTH, expand=YES)

        # Pestaña 1: Inspección
        self.inspection_frame = Frame(self.notebook, padx=8, pady=8)
        self.notebook.add(self.inspection_frame, text=" Inspección ")
        self._build_inspection_tab(self.inspection_frame)

        # Pestaña 2: Mapping
        self.mapping_tab = Frame(self.notebook, padx=8, pady=8)
        self.notebook.add(self.mapping_tab, text=" Mapping ")
        self._build_mapping_tab(self.mapping_tab)

        # Pestaña 3: Vista previa
        self.preview_frame = Frame(self.notebook, padx=8, pady=8)
        self.notebook.add(self.preview_frame, text=" Vista Previa y Exportar ")
        self._build_preview_tab(self.preview_frame)

    def _build_inspection_tab(self, parent: Frame) -> None:
        """Construir la pestaña de inspección."""
        sel_row = Frame(parent)
        sel_row.pack(fill=X, pady=(0, 6))
        Label(sel_row, text="Hoja:").pack(side=LEFT)
        self.sheet_combo = ttk.Combobox(
            sel_row, textvariable=self.sheet_var, state=DISABLED, width=30
        )
        self.sheet_combo.pack(side=LEFT, padx=(8, 0))
        self.sheet_combo.bind("<<ComboboxSelected>>", self._on_sheet_change)

        info_label = Label(
            parent, text="Información del archivo y columnas detectadas:", anchor=W
        )
        info_label.pack(fill=X, pady=(4, 2))

        self.info_text = Text(parent, height=25, width=120, wrap="word", state=DISABLED)
        self.info_text.pack(fill=BOTH, expand=YES)

    def _build_mapping_tab(self, parent: Frame) -> None:
        """Construir la pestaña de mapping."""
        toolbar = Frame(parent)
        toolbar.pack(fill=X, pady=(0, 6))
        Button(
            toolbar, text="Auto-detectar Mapping", command=self._on_auto_detect
        ).pack(side=LEFT, padx=(0, 4))
        Button(toolbar, text="Agregar Campo", command=self._on_add_field).pack(
            side=LEFT, padx=(0, 4)
        )
        Button(toolbar, text="Eliminar Seleccionado", command=self._on_remove_field).pack(
            side=LEFT, padx=(0, 4)
        )
        Button(toolbar, text="Guardar Mapping", command=self._on_save_mapping).pack(
            side=RIGHT
        )

        # Tabla de mapping con Treeview
        cols = ("source", "destination", "default", "ignored")
        self.mapping_tree = ttk.Treeview(
            parent, columns=cols, show="headings", height=20, selectmode="browse"
        )
        self.mapping_tree.heading("source", text="Columna Origen")
        self.mapping_tree.heading("destination", text="Campo Destino")
        self.mapping_tree.heading("default", text="Valor por Defecto")
        self.mapping_tree.heading("ignored", text="Ignorado")
        self.mapping_tree.column("source", width=250)
        self.mapping_tree.column("destination", width=250)
        self.mapping_tree.column("default", width=150)
        self.mapping_tree.column("ignored", width=80)

        scrollbar = Scrollbar(parent, orient=VERTICAL, command=self.mapping_tree.yview)
        self.mapping_tree.configure(yscrollcommand=scrollbar.set)

        self.mapping_tree.pack(side=LEFT, fill=BOTH, expand=YES)
        scrollbar.pack(side=RIGHT, fill=Y)

        self.mapping_tree.bind("<Double-1>", self._on_edit_cell)

    def _build_preview_tab(self, parent: Frame) -> None:
        """Construir la pestaña de vista previa y exportación."""
        btn_row = Frame(parent)
        btn_row.pack(fill=X, pady=(0, 6))
        Button(btn_row, text="Ejecutar Transformación", command=self._on_transform).pack(
            side=LEFT, padx=(0, 4)
        )
        Button(btn_row, text="Exportar...", command=self._on_export).pack(
            side=LEFT, padx=(0, 4)
        )

        self.preview_text = Text(parent, height=25, width=120, wrap="word", state=DISABLED)
        self.preview_text.pack(fill=BOTH, expand=YES)

    def _build_status_bar(self, parent: Frame) -> None:
        """Construir la barra de estado inferior."""
        status_frame = Frame(parent)
        status_frame.pack(fill=X, pady=(8, 0))
        Label(status_frame, textvariable=self.status_var, anchor=W).pack(fill=X)

    # ------------------------------------------------------------------
    # Manejadores de eventos
    # ------------------------------------------------------------------

    def _on_browse_file(self) -> None:
        """Manejar botón de examinar archivo."""
        filetypes = [
            ("Archivos Excel", "*.xlsx"),
            ("Archivos CSV", "*.csv"),
            ("Todos los soportados", "*.xlsx *.csv"),
        ]
        path = filedialog.askopenfilename(filetypes=filetypes)
        if path:
            self.file_path.set(path)
            self._analyze_file(path)

    def _on_browse_schema(self) -> None:
        """Manejar botón de examinar schema."""
        path = filedialog.askopenfilename(
            filetypes=[("Archivos JSON", "*.json")]
        )
        if path:
            self.schema_path.set(path)
            self._load_schema(path)

    def _on_load_mapping(self) -> None:
        """Manejar carga de mapping guardado."""
        path = filedialog.askopenfilename(
            filetypes=[("Archivos JSON", "*.json")]
        )
        if path:
            try:
                config = load_mapping(path)
                self.mapping_config = config
                if config.source_file:
                    self.file_path.set(config.source_file)
                    self._analyze_file(config.source_file)
                self.sheet_var.set(config.sheet_name)
                self._refresh_mapping_tree()
                self.status_var.set(f"Mapping cargado desde {path}")
                messagebox.showinfo(
                    "Mapping Cargado",
                    f"Se cargaron {len(config.mappings)} mapeos desde:\n{path}",
                )
            except Exception as e:
                messagebox.showerror("Error", f"No se pudo cargar el mapping:\n{e}")

    def _on_sheet_change(self, event: Any = None) -> None:
        """Manejar cambio de hoja seleccionada."""
        if self.analysis:
            self._update_inspection_display()

    def _on_auto_detect(self) -> None:
        """Auto-detectar mapping basado en columnas origen y schema."""
        if not self.analysis:
            messagebox.showwarning("Sin Datos", "Primero cargue un archivo.")
            return

        sheet_name = self.sheet_var.get()
        sheet = self._get_selected_sheet()
        if not sheet:
            return

        source_cols = [c.name for c in sheet.columns]
        target_fields = self.schema_fields if self.schema_fields else []

        if not target_fields:
            target_fields = list(source_cols)

        mappings = build_mapping_from_analysis(source_cols, target_fields)
        self.mapping_config = MappingConfig(
            source_file=self.file_path.get(),
            sheet_name=sheet_name,
            header_row=sheet.header_row,
            mappings=mappings,
        )
        self._refresh_mapping_tree()
        self.status_var.set(
            f"Auto-detectados {len(mappings)} mapeos ({len(source_cols)} columnas origen)"
        )

    def _on_add_field(self) -> None:
        """Agregar una fila de mapping vacía."""
        self.mapping_config.mappings.append(
            ColumnMapping(source_column="", destination_field="", ignored=False)
        )
        self._refresh_mapping_tree()

    def _on_remove_field(self) -> None:
        """Eliminar la fila de mapping seleccionada."""
        sel = self.mapping_tree.selection()
        if not sel:
            return
        item = sel[0]
        idx = self.mapping_tree.index(item)
        if 0 <= idx < len(self.mapping_config.mappings):
            del self.mapping_config.mappings[idx]
            self._refresh_mapping_tree()

    def _on_edit_cell(self, event: Any = None) -> None:
        """Manejar doble click para editar una celda del mapping."""
        sel = self.mapping_tree.selection()
        if not sel:
            return
        item = sel[0]
        col = self.mapping_tree.identify_column(event.x)
        idx = self.mapping_tree.index(item)

        if idx >= len(self.mapping_config.mappings):
            return

        mapping = self.mapping_config.mappings[idx]

        if col == "#1":
            self._edit_cell_dialog("Columna Origen", mapping, "source_column", idx)
        elif col == "#2":
            self._edit_cell_dialog("Campo Destino", mapping, "destination_field", idx)
        elif col == "#3":
            self._edit_cell_dialog("Valor por Defecto", mapping, "default_value", idx)
        elif col == "#4":
            mapping.ignored = not mapping.ignored
            self._refresh_mapping_tree()

    def _edit_cell_dialog(
        self, title: str, mapping: ColumnMapping, field: str, idx: int
    ) -> None:
        """Abrir diálogo para editar un campo del mapping."""
        dialog = Toplevel(self.root)
        dialog.title(title)
        dialog.geometry("400x120")
        dialog.transient(self.root)
        dialog.grab_set()

        frame = Frame(dialog, padx=12, pady=12)
        frame.pack(fill=BOTH, expand=YES)

        Label(frame, text=f"{title}:").pack(anchor=W)
        var = StringVar(value=getattr(mapping, field))
        entry = Entry(frame, textvariable=var, width=50)
        entry.pack(fill=X, pady=(4, 8))
        entry.select_range(0, END)
        entry.focus()

        def save() -> None:
            setattr(mapping, field, var.get())
            self._refresh_mapping_tree()
            dialog.destroy()

        entry.bind("<Return>", lambda _: save())
        Button(frame, text="Aceptar", command=save).pack()

    def _on_transform(self) -> None:
        """Ejecutar la transformación."""
        if not self.mapping_config.mappings:
            messagebox.showwarning(
                "Sin Mapping", "Configure un mapping antes de transformar."
            )
            return

        self.mapping_config.sheet_name = self.sheet_var.get()
        sheet = self._get_selected_sheet()
        if sheet:
            self.mapping_config.header_row = sheet.header_row

        try:
            result = apply_mapping(self.mapping_config)
            self._last_transform_result = result

            self._show_preview(result)

            if result.success:
                self.status_var.set(
                    f"Transformación OK: {result.rows_output} filas de salida, "
                    f"{len(result.warnings)} advertencias"
                )
                self.notebook.select(self.preview_frame)
            else:
                messagebox.showerror(
                    "Transformación Fallida",
                    "Errores:\n" + "\n".join(result.errors),
                )

        except Exception as e:
            messagebox.showerror("Error de Transformación", str(e))

    def _on_export(self) -> None:
        """Exportar los datos transformados."""
        if not hasattr(self, "_last_transform_result"):
            messagebox.showwarning(
                "Sin Datos", "Primero ejecute una transformación antes de exportar."
            )
            return

        result = self._last_transform_result
        if not result.success or result.dataframe is None:
            messagebox.showerror("Error", "No hay datos válidos para exportar.")
            return

        filetypes = [
            ("Archivos Excel", "*.xlsx"),
            ("Archivos CSV", "*.csv"),
        ]
        path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=filetypes,
        )
        if path:
            try:
                out = export_data(result.dataframe, path)
                self.status_var.set(f"Exportado a: {out}")
                messagebox.showinfo(
                    "Exportación Completa",
                    f"Archivo exportado correctamente:\n{out}\n\n"
                    f"Filas: {result.rows_output}",
                )
            except Exception as e:
                messagebox.showerror("Error de Exportación", str(e))

    def _on_save_mapping(self) -> None:
        """Guardar el mapping actual en un archivo JSON."""
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("Archivos JSON", "*.json")],
        )
        if path:
            try:
                self.mapping_config.source_file = self.file_path.get()
                self.mapping_config.sheet_name = self.sheet_var.get()
                out = save_mapping(self.mapping_config, path)
                self.status_var.set(f"Mapping guardado en: {out}")
                messagebox.showinfo("Guardado", f"Mapping guardado en:\n{out}")
            except Exception as e:
                messagebox.showerror("Error", str(e))

    # ------------------------------------------------------------------
    # Perfiles de proveedor
    # ------------------------------------------------------------------

    def _refresh_profiles(self) -> list[str]:
        """Refrescar la lista de perfiles disponibles en el combobox.

        Crea la carpeta profiles/ si no existe y lista los archivos JSON.
        """
        PROFILES_DIR.mkdir(parents=True, exist_ok=True)
        profiles = sorted(p.stem for p in PROFILES_DIR.glob("*.json"))
        if self.profile_combo:
            self.profile_combo["values"] = profiles
        self.status_var.set(
            f"{len(profiles)} perfil(es) de proveedor disponible(s)"
        )
        return profiles

    def _sanitize_profile_name(self, name: str) -> str:
        """Normalizar un nombre de perfil a un slug seguro para nombre de archivo.

        Ejemplo: "Hikvision Colombia" -> "hikvision-colombia".
        """
        import unicodedata

        nfkd = unicodedata.normalize("NFKD", name)
        ascii_text = "".join(c for c in nfkd if not unicodedata.combining(c))
        cleaned = "".join(
            c for c in ascii_text if c.isalnum() or c in "-_ " or c.isspace()
        ).strip().lower()
        # Espacios y otros separadores -> guiones, colapsando duplicados
        cleaned = "-".join(part for part in cleaned.replace(" ", "-").split("-") if part)
        if not cleaned:
            raise ValueError("El nombre del perfil no puede estar vacío.")
        return cleaned

    def _on_save_profile(self) -> None:
        """Guardar el mapping actual como perfil de proveedor en profiles/."""
        name = self.profile_var.get().strip()
        if not name:
            name = simpledialog.askstring(
                "Guardar Perfil",
                "Nombre del perfil (proveedor):",
                parent=self.root,
            )
        if not name:
            return

        try:
            name = self._sanitize_profile_name(name)
        except ValueError as e:
            messagebox.showerror("Error", str(e))
            return

        target = PROFILES_DIR / f"{name}.json"
        if target.exists():
            if not messagebox.askyesno(
                "Confirmar",
                f"El perfil '{name}' ya existe. ¿Desea sobrescribirlo?",
            ):
                return

        try:
            self.mapping_config.source_file = self.file_path.get()
            self.mapping_config.sheet_name = self.sheet_var.get()
            out = save_mapping(self.mapping_config, target)
            self._refresh_profiles()
            self.profile_var.set(name)
            self.status_var.set(f"Perfil guardado: {name}")
            messagebox.showinfo(
                "Perfil Guardado",
                f"Perfil '{name}' guardado en:\n{out}",
            )
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo guardar el perfil:\n{e}")

    def _on_load_profile(self) -> None:
        """Cargar un perfil de proveedor y aplicar su mapping en la UI."""
        name = self.profile_var.get().strip()
        if not name:
            messagebox.showwarning("Sin Perfil", "Seleccione un perfil del listado.")
            return

        path = PROFILES_DIR / f"{name}.json"
        if not path.exists():
            messagebox.showerror("Error", f"No existe el perfil:\n{path}")
            return

        try:
            config = load_mapping(path)
            self.mapping_config = config
            # Si el perfil referencia un archivo origen que aún existe, cargarlo.
            if config.source_file and Path(config.source_file).exists():
                self.file_path.set(config.source_file)
                self._analyze_file(config.source_file)
            self.sheet_var.set(config.sheet_name)
            self._refresh_mapping_tree()
            self.status_var.set(
                f"Perfil '{name}' cargado ({len(config.mappings)} mapeos)"
            )
            messagebox.showinfo(
                "Perfil Cargado",
                f"Perfil '{name}' aplicado:\n{len(config.mappings)} mapeos",
            )
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo cargar el perfil:\n{e}")

    # ------------------------------------------------------------------
    # Helpers de datos
    # ------------------------------------------------------------------

    def _analyze_file(self, path: str) -> None:
        """Analizar un archivo y actualizar la interfaz."""
        self.status_var.set(f"Analizando {Path(path).name}...")
        self.root.update_idletasks()

        try:
            self.analysis = analyze_file(path)

            sheet_names = [s.name for s in self.analysis.sheets]
            if self.sheet_combo:
                self.sheet_combo["values"] = sheet_names
                self.sheet_combo["state"] = NORMAL
                if sheet_names:
                    self.sheet_var.set(sheet_names[0])

            self._update_inspection_display()
            self.status_var.set(
                f"Cargado: {Path(path).name} — "
                f"{len(self.analysis.sheets)} hoja(s) detectada(s)"
            )

        except PermissionError as e:
            messagebox.showerror("Archivo Bloqueado", str(e))
            self.status_var.set("Error: El archivo está bloqueado por otro proceso")
        except Exception as e:
            messagebox.showerror("Error de Análisis", str(e))
            self.status_var.set("Error durante el análisis")

    def _load_schema(self, path: str) -> None:
        """Cargar un schema JSON y extraer nombres de campos."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.schema_fields = [field["name"] for field in data.get("fields", [])]
            self.status_var.set(
                f"Schema cargado: {len(self.schema_fields)} campos desde {Path(path).name}"
            )
        except Exception as e:
            messagebox.showerror("Error de Schema", str(e))

    def _get_selected_sheet(self) -> SheetInfo | None:
        """Obtener la SheetInfo actualmente seleccionada."""
        if not self.analysis:
            return None
        name = self.sheet_var.get()
        for s in self.analysis.sheets:
            if s.name == name:
                return s
        return self.analysis.sheets[0] if self.analysis.sheets else None

    def _update_inspection_display(self) -> None:
        """Actualizar el texto de inspección con la info de la hoja actual."""
        sheet = self._get_selected_sheet()
        if not sheet:
            return

        self.info_text.configure(state=NORMAL)
        self.info_text.delete("1.0", END)

        lines = [
            f"Archivo: {self.file_path.get()}",
            f"Hoja: {sheet.name}",
            f"Fila de encabezados detectada: {sheet.header_row}",
            f"Total de filas de datos: {sheet.total_rows}",
            f"Columnas detectadas: {len(sheet.columns)}",
            "",
            "=" * 80,
            "COLUMNAS DETECTADAS",
            "=" * 80,
            "",
        ]

        for col in sheet.columns:
            lines.append(f"[{col.index}] {col.name}  (tipo: {col.dtype})")
            if col.sample_values:
                samples = ", ".join(str(v)[:50] for v in col.sample_values[:5])
                lines.append(f"     Ejemplos: {samples}")
            lines.append("")

        self.info_text.insert("1.0", "\n".join(lines))
        self.info_text.configure(state=DISABLED)

    def _refresh_mapping_tree(self) -> None:
        """Refrescar el treeview de mapping desde la configuración."""
        for item in self.mapping_tree.get_children():
            self.mapping_tree.delete(item)

        for m in self.mapping_config.mappings:
            self.mapping_tree.insert(
                "",
                END,
                values=(
                    m.source_column,
                    m.destination_field,
                    m.default_value,
                    "Sí" if m.ignored else "No",
                ),
            )

    def _show_preview(self, result: TransformResult) -> None:
        """Mostrar el resultado de la transformación en la pestaña de preview."""
        self.preview_text.configure(state=NORMAL)
        self.preview_text.delete("1.0", END)

        lines = [
            "RESULTADO DE LA TRANSFORMACIÓN",
            "=" * 80,
            "",
            f"Filas procesadas: {result.rows_processed}",
            f"Filas de salida: {result.rows_output}",
            f"Advertencias: {len(result.warnings)}",
            f"Columnas ignoradas: {len(result.ignored_columns)}",
            f"Valores por defecto aplicados: {len(result.applied_defaults)}",
            "",
        ]

        if result.warnings:
            lines.append("--- ADVERTENCIAS ---")
            for w in result.warnings:
                lines.append(f"  ⚠ {w}")
            lines.append("")

        if result.ignored_columns:
            lines.append(f"Columnas ignoradas: {', '.join(result.ignored_columns)}")
            lines.append("")

        if result.applied_defaults:
            lines.append(f"Campos con defecto: {', '.join(result.applied_defaults)}")
            lines.append("")

        if result.dataframe is not None:
            lines.append("=" * 80)
            lines.append("VISTA PREVIA DE SALIDA (primeras 20 filas)")
            lines.append("=" * 80)
            lines.append("")

            df = result.dataframe.head(20)
            cols = list(df.columns)
            lines.append(" | ".join(cols))
            lines.append("-" * 80)

            for _, row in df.iterrows():
                vals = [str(v)[:40] for v in row.tolist()]
                lines.append(" | ".join(vals))

        self.preview_text.insert("1.0", "\n".join(lines))
        self.preview_text.configure(state=DISABLED)

    # ------------------------------------------------------------------
    # Ejecutar
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Iniciar el loop principal de la aplicación."""
        self.root.mainloop()
