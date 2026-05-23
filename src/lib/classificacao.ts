// classificacao.ts
// Classifica automaticamente ocorrências por tipo de oitiva
// Regras: CENTRAL TELEFLAGRANTE — Guarapari-ES

export type TipoOitiva = "com_oitiva" | "sem_oitiva";

export interface DadosTriage {
  procedure_type?: string;
  tipificacoes?: string[];
  tem_conduzido?: boolean;
  tem_menor?: boolean;
  natureza_texto?: string;
}

export function classificarOcorrencia(dados: DadosTriage): TipoOitiva {
  const proc = (dados.procedure_type || "").toUpperCase().trim();
  const natureza = (dados.natureza_texto || "").toLowerCase();
  const tips = (dados.tipificacoes || []).map((t) => t.toLowerCase());

  // Procedimentos que SEMPRE têm oitiva
  if (["APFD", "BOC", "AAAI", "TC", "MPU"].includes(proc)) {
    return "com_oitiva";
  }

  // Liberação de corpo → tem oitiva (familiar/responsável é ouvido)
  const ehLiberacaoCorpo =
    natureza.includes("liberação de corpo") ||
    natureza.includes("liberacao de corpo") ||
    natureza.includes("corpo de delito");
  if (ehLiberacaoCorpo) return "com_oitiva";

  // Mandado de prisão → sem oitiva (sem situação flagrancial)
  const ehMandadoPrisao =
    natureza.includes("mandado de prisão") ||
    natureza.includes("mandado de prisao") ||
    proc.includes("MANDADO");
  if (ehMandadoPrisao) return "sem_oitiva";

  // MBA — mandado busca adolescente → sem oitiva
  if (proc === "MBA") return "sem_oitiva";

  // Lesão corporal: depende de ter conduzido
  const ehLesao =
    tips.some((t) => t.includes("lesão corporal") || t.includes("lesao corporal")) ||
    natureza.includes("lesão corporal") ||
    natureza.includes("lesao corporal");
  if (ehLesao) {
    return dados.tem_conduzido ? "com_oitiva" : "sem_oitiva";
  }

  // Crime sexual com menor → ouve representante legal
  const ehCrimeSexual = tips.some(
    (t) =>
      t.includes("estupro") ||
      t.includes("abuso sexual") ||
      t.includes("violência sexual") ||
      t.includes("ato libidinoso"),
  );
  if (ehCrimeSexual && dados.tem_menor) return "com_oitiva";

  // Fallback: se há conduzido → com oitiva; caso contrário → sem oitiva
  return dados.tem_conduzido ? "com_oitiva" : "sem_oitiva";
}
