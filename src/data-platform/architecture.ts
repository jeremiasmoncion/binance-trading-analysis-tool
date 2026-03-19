import type { AppDataArchitecturePhase } from "./contracts";

export const APP_DATA_ARCHITECTURE_PHASES: AppDataArchitecturePhase[] = [
  {
    id: "phase-1",
    title: "Contrato global de datos",
    status: "completed",
    description: "La app ya tiene dominios explícitos para market y system data, con snapshots y metadata compartida.",
  },
  {
    id: "phase-2",
    title: "Stores centrales",
    status: "completed",
    description: "La app ya cuenta con stores globales para dejar de depender de consumo aislado por pantalla.",
  },
  {
    id: "phase-3",
    title: "App como punto único de sincronización",
    status: "completed",
    description: "App ya publica snapshots y overlays a la capa global para market y system.",
  },
  {
    id: "phase-4",
    title: "Selectors y refresh policy",
    status: "completed",
    description: "Las vistas principales ya consumen por selectors compartidos y la política de refresh quedó centralizada por plano.",
  },
  {
    id: "phase-5",
    title: "System plane por capas",
    status: "completed",
    description: "System data ya distingue snapshot, overlay, controls y actions para preparar el salto al realtime core.",
  },
  {
    id: "phase-6",
    title: "Realtime core persistente",
    status: "pending",
    description: "El hot path live todavía no sale por completo de serverless. Falta el servicio persistente.",
  },
];
