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
}

export interface AnalysisResult {
  triagem: RelatorioTriagem;
  depoimentos: DepoimentoPessoa[];
  despacho: Despacho;
}

export type AnalysisStatus =
  | "idle"
  | "reading"
  | "validating"
  | "analyzing"
  | "generating"
  | "done"
  | "error";

export const STATUS_MESSAGES: Record<AnalysisStatus, string> = {
  idle: "",
  reading: "Lendo documento PDF...",
  validating: "Validando dados cadastrais e CEP...",
  analyzing: "Analisando narrativa policial...",
  generating: "Gerando minutas e despacho...",
  done: "Análise concluída",
  error: "Erro na análise",
};
