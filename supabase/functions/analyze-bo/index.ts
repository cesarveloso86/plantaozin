import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { pdf_base64, file_name, instructions, previous_result } = await req.json();
    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "PDF não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing file: ${file_name || "unknown"}${instructions ? " (re-analysis)" : ""}`);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleanContent);
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
