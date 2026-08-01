# Reglas para Cline en este proyecto

## Estilo de trabajo

- Siempre explica primero el **plan de cambios** antes de editar cualquier archivo.
- No edites archivos sin que yo lo apruebe explícitamente en modo Act.
- Trabaja preferiblemente archivo por archivo, con cambios pequeños y bien justificados.

## Lectura del proyecto

- Antes de proponer cambios grandes, analiza la **estructura completa** del proyecto (carpetas, archivos principales, puntos de entrada).
- Resume en español la arquitectura actual y las dependencias importantes.

## Seguridad y comandos

- Usa solo **comandos seguros** (por ejemplo: `ls`, `dir`, `git status`, `npm run lint`, `npm run test`) a menos que yo te pida otra cosa.
- No ejecutes comandos que borren archivos (`rm`, `del`, `rmdir`) ni que cambien ramas sin mi aprobación explícita.
- Si necesitas instalar dependencias, primero sugiere el comando y espera que yo lo autorice.

## Código y documentación

- Escribe el código y los comentarios siempre en **español claro**, con enfoque técnico.
- Cuando modifiques código, incluye un breve comentario o explicación en el propio archivo si es relevante.
- Propón mejoras de estructura (refactor) solo cuando aporten claridad y mantenibilidad.

## Uso de OpenRouter / modelo

- Utiliza el modelo configurado (`deepseek/deepseek-v4-flash:free`) de forma eficiente, evitando respuestas innecesariamente largas.
- Para tareas de programación complejas, divide la solución en pasos y explícame cada paso antes de ejecutarlo.

## Flujo de trabajo recomendado

1. Leer archivos relevantes y explicarme qué entiendes.
2. Proponer un plan en puntos numerados.
3. Esperar mi aprobación.
4. Ejecutar cambios en modo Act siguiendo el plan, paso a paso.
5. Al final, resumir qué cambió y qué falta por hacer.