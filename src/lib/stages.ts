export const STAGES = [
  { id: "base_lead_mapeado", label: "Base / Lead Mapeado", token: "stage-mapped" },
  { id: "tentando_contato", label: "Tentando Contato", token: "stage-trying" },
  { id: "conexao_iniciada", label: "Conexão Iniciada", token: "stage-connected" },
  { id: "qualificado", label: "Qualificado", token: "stage-qualified" },
  { id: "reuniao_agendada", label: "Reunião Agendada", token: "stage-meeting" },
  { id: "desqualificado", label: "Desqualificado", token: "stage-disqualified" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const STAGE_LABEL: Record<StageId, string> = STAGES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.label }),
  {} as Record<StageId, string>
);
