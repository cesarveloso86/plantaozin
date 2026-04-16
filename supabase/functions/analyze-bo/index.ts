import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente especializado em análise de Boletins de Ocorrência policiais brasileiros.

Ao receber o conteúdo de um PDF de Boletim de Ocorrência, você deve:

1. EXTRAIR as informações do relatório de triagem:
   - Número do BO
   - Delegacia responsável
   - Data do fato
   - Natureza do crime/ocorrência
   - Local do fato (endereço completo)
   - Validar se o CEP existe (marque cep_valido como true se parece válido, false se ausente ou claramente inválido)
   - Resumo dos fatos em 3-5 linhas
   - Lista de alertas relevantes (ex: menor envolvido, arma de fogo, drogas)

2. GERAR minutas de depoimento para TODAS as pessoas mencionadas no BO, incluindo obrigatoriamente:
   - Policiais Militares condutores (SEMPRE gerar depoimento para cada PM que participou da ocorrência)
   - Policiais Militares testemunhas
   - Testemunhas civis
   - Interrogados / Averiguados / Indiciados
   - Vítimas
   - Para cada pessoa, gere um depoimento formal em primeira pessoa
   - Use linguagem jurídica formal adequada para procedimentos policiais brasileiros
   - Inclua as circunstâncias relatadas no BO adaptadas ao ponto de vista de cada depoente
   - Inclua qualificação completa (nome, RG, CPF, endereço, profissão quando disponível)
   - Para policiais militares, inclua posto/graduação, RE e unidade de lotação

3. GERAR um despacho baseado no boletim:
   - Texto formal de despacho da autoridade policial
   - Lista de tipificações penais aplicáveis (artigo, descrição e lei — ex: "Art. 155", "Furto", "Código Penal")
   - Lista de providências a serem tomadas (ex: "Ouvir a vítima em sede policial", "Requisitar exame pericial")

IMPORTANTE:
- Mantenha fidelidade aos fatos descritos no BO
- Use linguagem formal de delegacia
- Cada depoimento deve iniciar com "Aos XX dias do mês de XX..."
- Nunca invente fatos que não estejam no documento original
- O despacho deve refletir as tipificações corretas baseadas nos fatos narrados

Responda EXCLUSIVAMENTE com um JSON válido no seguinte formato (sem markdown, sem blocos de código):
{
  "triagem": {
    "numero_bo": "string",
    "delegacia": "string",
    "data_fato": "string",
    "natureza": "string",
    "local_fato": "string",
    "cep_valido": boolean,
    "resumo": "string",
    "alertas": ["string"]
  },
  "depoimentos": [
    {
      "tipo": "condutor" | "testemunha" | "interrogado" | "vitima",
      "nome": "string",
      "qualificacao": "string com dados completos",
      "texto": "string com depoimento formal completo"
    }
  ],
  "despacho": {
    "texto": "string com despacho formal completo",
    "tipificacoes": [
      {
        "artigo": "string (ex: Art. 155)",
        "descricao": "string (ex: Furto simples)",
        "lei": "string (ex: Código Penal)"
      }
    ],
    "providencias": ["string"]
  }
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function validateCep(parsed: any, cleanContent: string) {
  const triagemText = [
    parsed.triagem?.local_fato,
    parsed.triagem?.resumo,
    cleanContent,
  ].filter(Boolean).join(" ");

  const cepMatch = triagemText.match(/(\d{5})-?(\d{3})/);
  if (cepMatch) {
    const cep = `${cepMatch[1]}${cepMatch[2]}`;
    console.log(`Validating CEP: ${cep}`);
    try {
      const viacepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (viacepRes.ok) {
        const viacepData = await viacepRes.json();
        parsed.triagem.cep_valido = !viacepData.erro;
        if (!viacepData.erro) {
          parsed.triagem.cep_endereco = `${viacepData.logradouro}, ${viacepData.bairro} - ${viacepData.localidade}/${viacepData.uf}`;
        }
      } else {
        parsed.triagem.cep_valido = false;
      }
    } catch (e) {
      console.error("ViaCEP validation failed:", e);
    }
  } else {
    parsed.triagem.cep_valido = false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { pdf_base64, file_name, instructions, previous_result, field, signature_style } = await req.json();
    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "PDF não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing file: ${file_name || "unknown"}${instructions ? " (re-analysis)" : ""}`);

    // Build user-preference block (analyst signature style).
    let prefBlock = "";
    if (signature_style && typeof signature_style === "object") {
      const tomMap: Record<string, string> = {
        formal_juridico: "Formal jurídico, com linguagem técnica e citações legais quando cabível.",
        tecnico_neutro: "Técnico e neutro, equilibrando clareza e formalidade.",
        objetivo_simples: "Objetivo e direto, frases curtas e com menos jargão.",
      };
      const lines: string[] = [];
      if (signature_style.tom && tomMap[signature_style.tom]) {
        lines.push(`- Tom da redação: ${tomMap[signature_style.tom]}`);
      }
      if (signature_style.qualificacao_completa === false) {
        lines.push("- Pular qualificação completa nos depoimentos (resumo direto).");
      } else if (signature_style.qualificacao_completa === true) {
        lines.push("- Sempre incluir qualificação completa (nome, filiação, RG, profissão e endereço) no início de cada depoimento.");
      }
      if (signature_style.instrucoes_extras && String(signature_style.instrucoes_extras).trim()) {
        lines.push(`- Instruções adicionais do analista: ${String(signature_style.instrucoes_extras).trim()}`);
      }
      if (lines.length > 0) {
        prefBlock = `\n\nPREFERÊNCIAS DO ANALISTA (siga sem violar as regras do sistema):\n${lines.join("\n")}`;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + prefBlock },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise o Boletim de Ocorrência anexado e gere o relatório de triagem e as minutas de depoimento conforme instruído.",
          },
          {
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${pdf_base64}` },
          },
        ],
      },
    ];

    // If re-analyzing, add the previous result and instructions
    if (instructions && previous_result) {
      const fieldLabel = field === "triagem" ? "a triagem/relatório" 
        : field === "despacho" ? "o despacho (tipificações e providências)"
        : field === "depoimentos" ? "os depoimentos"
        : "o resultado completo";
      
      messages.push({
        role: "assistant",
        content: JSON.stringify(previous_result),
      });
      messages.push({
        role: "user",
        content: `Reanalisar APENAS ${fieldLabel} com as seguintes instruções do usuário:\n\n${instructions}\n\nMANTENHA INALTERADAS as demais seções do JSON. Corrija ou complemente APENAS ${fieldLabel} conforme solicitado. Retorne o JSON completo atualizado.`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`Erro do gateway AI: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error("Resposta vazia da IA");

    let cleanContent = content.trim();
    // Remove markdown code blocks
    cleanContent = cleanContent
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Find JSON boundaries
    const jsonStart = cleanContent.search(/[{[]/);
    const jsonEnd = cleanContent.lastIndexOf(
      jsonStart !== -1 && cleanContent[jsonStart] === "[" ? "]" : "}"
    );

    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repairAndParse = (raw: string): any => {
      let s = raw
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, (ch) => (ch === "\n" || ch === "\t" ? ch : ""));

      // Fix unbalanced braces/brackets (truncated output)
      let braces = 0, brackets = 0;
      for (const c of s) {
        if (c === "{") braces++;
        else if (c === "}") braces--;
        else if (c === "[") brackets++;
        else if (c === "]") brackets--;
      }

      // If truncated mid-string, close the last open string
      const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        s += '"';
      }

      while (brackets > 0) { s += "]"; brackets--; }
      while (braces > 0) { s += "}"; braces--; }

      return JSON.parse(s);
    };

    try {
      parsed = JSON.parse(cleanContent);
    } catch (_e) {
      console.warn("Initial JSON parse failed, attempting repair...");
      try {
        parsed = repairAndParse(cleanContent);
        console.log("JSON repair succeeded");
      } catch (repairErr) {
        console.error("JSON repair also failed:", repairErr);
        throw new Error("A IA retornou uma resposta malformada. Tente novamente.");
      }
    }
    await validateCep(parsed, cleanContent);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
