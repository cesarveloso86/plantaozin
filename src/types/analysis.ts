export interface DepoimentoPessoa {
  tipo: "condutor" | "testemunha" | "interrogado" | "vitima";
  nome: string;
  qualificacao: string;
  texto: string;
}

export interface Tipificacao {
  artigo: string;
  descricao: string;
  lei?: string;
}

export interface Despacho {
  texto: string;
  tipificacoes: Tipificacao[];
  providencias: string[];
}

export interface RelatorioTriagem {
  numero_bo: string;
  delegacia: string;
  data_fato: string;
  natureza: string;
  local_fato: string;
  cep_valido: boolean;
  cep_endereco?: string;
  resumo: string;
  alertas: string[];
  /** Texto literal extraído do campo "Unidade de Registro" do BU */
  unidade_registro?: string;
  /** Código mapeado para uma das REGIONALS oficiais (ou DEACLE) */
  regional_codigo?: string;
  /** Nomes sugeridos pela triagem rápida (apenas modo "triage") */
  condutores_nomes?: string[];
  vitimas_nomes?: string[];
  interrogados_nomes?: string[];
  /** Tipificações sugeridas na triagem (apenas modo "triage") */
  tipificacoes_sugeridas?: Tipificacao[];
}

export interface AnalysisResult {
  triagem: RelatorioTriagem;
  depoimentos: DepoimentoPessoa[];
  despacho: Despacho;
}

/** Resultado da triagem rápida — sem depoimentos/despacho. */
export interface TriageResult {
  triagem: RelatorioTriagem;
}

export type AnalysisMode = "triage" | "full";

export type AnalysisStatus =
  | "idle"
  | "reading"
  | "validating"
  | "analyzing"
  | "generating"
  | "done"
  | "triage_done"
  | "error";

export const STATUS_MESSAGES: Record<AnalysisStatus, string> = {
  idle: "",
  reading: "Lendo documento PDF...",
  validating: "Validando dados cadastrais e CEP...",
  analyzing: "Analisando narrativa policial...",
  generating: "Gerando minutas e despacho...",
  done: "Análise concluída",
  triage_done: "Triagem concluída — pronto para distribuir",
  error: "Erro na análise",
};
