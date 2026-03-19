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
    status: "in_progress",
    description: "App publica snapshots y overlays a la capa global. Falta migrar más vistas para leer desde ella.",
  },
  {
    id: "phase-4",
    title: "Realtime core persistente",
    status: "pending",
    description: "El hot path live todavía no sale por completo de serverless. Falta el servicio persistente.",
  },
  {
    id: "phase-5",
    title: "Migración total de vistas",
    status: "pending",
    description: "Dashboard, Memory, Balance y futuras pantallas deben leer del mismo plano de datos.",
  },
];
