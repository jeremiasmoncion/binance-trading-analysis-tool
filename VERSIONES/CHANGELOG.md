# 📋 CRYPE - Control de Versiones

## Sistema de Versionado

Este proyecto utiliza un sistema de versionado para mantener copias de seguridad de versiones estables. En caso de errores, puedes solicitar volver a una versión anterior.

---

## 📁 Ubicación de Versiones

Todas las versiones se guardan en la carpeta: `VERSIONES/`

---

## 🏷️ Versiones Guardadas

| Versión | Archivo | Estado | Características Principales |
|---------|---------|--------|---------------------------|
| **CRYPE01** | `CRYPE01_estable_base.html` | ✅ Estable | Versión base con 6 sesiones + análisis |
| **CRYPE02** | `CRYPE02_journal_operaciones.html` | ✅ Estable | CRYPE01 + Journal de operaciones completo |

---

## 📄 Detalle de Versiones

### CRYPE01 - BASE ESTABLE
**Archivo:** `CRYPE01_estable_base.html`

**Características:**
- ✅ Login seguro con hash de contraseñas
- ✅ 6 sesiones (Inicio, Mercado, Calculadora, Comparar, Aprender, Perfil)
- ✅ 16 temporalidades de Binance (1s a 1M)
- ✅ Gráfico de velas en canvas
- ✅ Indicadores técnicos (RSI, SMA 20, SMA 50)
- ✅ Señales de trading (Comprar, Vender, Esperar)
- ✅ Plan sugerido con entrada, TP, SL
- ✅ Calculadora de operaciones con comisiones
- ✅ Comparación de 8 monedas
- ✅ Sección educativa (6 tarjetas)
- ✅ Administración de usuarios (admin)
- ✅ Perfil de usuario editable
- ✅ Indicador de estado (verde/rojo)
- ✅ Diseño responsive
- ✅ Modo respaldo si Binance falla

**Fecha:** Versión actual estable

---

### CRYPE02 - CON JOURNAL DE OPERACIONES
**Archivo:** `CRYPE02_journal_operaciones.html`

**Características:**
- ✅ Todo lo de CRYPE01
- ✅ Sección "Operaciones" (Journal de trading)
- ✅ Registro manual de operaciones
- ✅ Cálculo automático de ganancias/pérdidas
- ✅ Reportes por período (día, semana, mes)
- ✅ Estadísticas de rendimiento
- ✅ Exportar a CSV/Excel
- ✅ Historial con filtro de fechas
- ✅ Tabla filtrable de operaciones

**Fecha:** Versión actual estable

---

## 🔄 Cómo Volver a una Versión Anterior

Si algo sale mal, puedes pedir:

> "Vuelve a la versión CRYPE01"

O:

> "Restaura la versión CRYPE02"

**Pasos:**
1. Identifica la versión a restaurar
2. Copia el contenido del archivo de esa versión
3. Reemplaza el contenido de `index.html` con ese contenido
4. Ejecuta `npm run build` para verificar

---

## 📝 Próximas Versiones

### CRYPE03 - (En desarrollo)
- Gráfico de evolución de balance en Journal
- Filtros avanzados por par y tipo
- Meta mensual de ganancias
- Calendario de operaciones

---

## ⚠️ Importante

- Las versiones se guardan en la carpeta `VERSIONES/`
- Cada versión es un archivo HTML completo e independiente
- Puedes tener múltiples versiones guardadas
- Siempre crea un respaldo antes de cambios grandes

---

**Última actualización:** Versión CRYPE02
