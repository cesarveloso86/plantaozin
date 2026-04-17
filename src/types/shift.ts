import type { MemberSchedule, ScheduleWindow, SubteamCategory, SubteamPresetId } from "@/components/shift/scheduleConstants";

export interface ShiftMember {
  name: string;
  nf?: string;
  nickname?: string;
  role?: string;
  substituting?: string;
  schedule?: MemberSchedule;
}

export interface ShiftAbsence {
  name: string;
  reason: string;
}

export interface ShiftSubteam {
  id: string;
  label: string;
  category: SubteamCategory;
  preset: SubteamPresetId;
  windows: ScheduleWindow[];
  members: ShiftMember[];
}

export interface Shift {
  id: string;
  created_by: string;
  team_name: string;
  shift_date: string;
  start_time: string;
  end_time: string | null;
  status: "active" | "closed";
  authorities: ShiftMember[];
  investigators: ShiftMember[];
  iseo: ShiftMember[];
  absences: ShiftAbsence[];
  observations: string[];
  oip_subteams: ShiftSubteam[];
  delegado_subteams: ShiftSubteam[];
  created_at: string;
}

export type OccurrenceStatus = "em_atendimento" | "atendida";

export interface ShiftOccurrence {
  id: string;
  shift_id: string;
  status: OccurrenceStatus;
  bu_number: string;
  tramitation_time: string | null;
  procedure_type: string | null;
  procedure_type_2: string | null;
  procedure_type_3: string | null;
  investigator: string | null;
  authority: string | null;
  regional: string | null;
  has_report: boolean;
  num_hearings: number;
  final_time: string | null;
  first_hearing_time: string | null;
  observations: string | null;
  conducted_names: string | null;
  victim_names: string | null;
  suspect_names: string | null;
  tipification: string | null;
  po_status: string | null;
  analysis_id: string | null;
  created_by: string;
  created_at: string;
}

export const PROCEDURE_TYPES = [
  "APFD",
  "BOC",
  "TC",
  "PA.DAP",
  "MPU",
  "MBA",
  "AAAI",
  "MP Penal",
  "MP Civil",
] as const;

export const REGIONALS = [
  "1ª - VITÓRIA",
  "2ª - VILA VELHA",
  "3ª - SERRA",
  "4ª - CARIACICA",
  "5ª - GUARAPARI",
  "6ª - ALEGRE",
  "7ª - CACHOEIRO DE ITAPEMIRIM",
  "8ª - CASTELO",
  "9ª - ITAPEMIRIM",
  "10ª - VIANA",
  "11ª - VENDA NOVA DO IMIGRANTE",
  "12ª - SANTA TERESA",
  "13ª - ARACRUZ",
  "14ª - BARRA DE SÃO FRANCISCO",
  "15ª - COLATINA",
  "16ª - LINHARES",
  "17ª - NOVA VENÉCIA",
  "18ª - SÃO MATEUS",
  "DEACLE",
] as const;
