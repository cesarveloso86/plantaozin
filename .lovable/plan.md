## Ajuste de largura nos Selects de OIP e Autoridade

### Observação importante
Após inspecionar `src/components/shift/OccurrencesTab.tsx`, **não existem `SelectTrigger` com `w-[150px]`** no arquivo. Os únicos `SelectTrigger` com largura fixa são os de OIP e Autoridade na **tabela de "Já Atendidas"** (linhas 776 e 787), que usam `w-[140px]`.

Os demais `SelectTrigger` de OIP/Autoridade (fila pendente e em atendimento, linhas 444, 455, 524, 533, 619, 625, 689, 698) **não têm largura fixa** — usam apenas `h-9 text-base` e já se expandem naturalmente.

Vou tratar `w-[140px]` como o alvo real do pedido (provável engano de digitação na largura citada), aplicando a substituição apenas onde existe largura fixa nos selects de OIP/Autoridade.

### Mudança
Em `src/components/shift/OccurrencesTab.tsx`:

- Linha 776 (Select OIP, tabela completed):
  - `className="h-8 text-xs w-[140px]"` → `className="h-8 text-xs w-auto min-w-[80px]"`
- Linha 787 (Select Autoridade, tabela completed):
  - `className="h-8 text-xs w-[140px]"` → `className="h-8 text-xs w-auto min-w-[80px]"`

Nada mais será alterado (placeholder, lógica, demais atributos e demais SelectTriggers permanecem intactos).

### Confirmação necessária
Se você realmente quis dizer `w-[150px]` literalmente e existe outro arquivo/local em mente, me avise. Caso contrário, ao aprovar este plano aplicarei a troca nas duas linhas acima.