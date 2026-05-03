## Plano de Correções de Auditoria

Aplicarei exatamente as 7 mudanças solicitadas, sem alterar lógica de negócio.

### Bloco 1 — CORS configurável nas Edge Functions
Em cada uma das 5 funções (`analyze-bo`, `signup`, `admin-create-user`, `admin-delete-user`, `admin-list-emails`), substituir o `corsHeaders` por versão que lê `ALLOWED_ORIGIN` do ambiente (fallback `*`). Demais linhas intactas.

### Bloco 2 — Senha mínima 8 caracteres
- `supabase/functions/signup/index.ts`: `password.length < 6` → `< 8` e mensagem.
- `src/pages/Auth.tsx` (`handleSignup`): mesmo ajuste e texto "Mínimo de 8 caracteres."

### Bloco 3 — Unificar toasts no Sonner
- `src/pages/Auth.tsx` e `src/pages/ResetPassword.tsx`:
  - Remover `useToast` e `const { toast } = useToast();`
  - Adicionar `import { toast } from "sonner";`
  - `toast({ ..., variant: "destructive" })` → `toast.error(description)`
  - `toast({ title, description })` sem variant → `toast.success(description)`
- `src/App.tsx`: remover `import { Toaster } from "@/components/ui/toaster"` e o `<Toaster />` no JSX. Manter `<Sonner />`.
- Não tocar em `toast.tsx`, `toaster.tsx`, `use-toast.ts`.

### Bloco 4 — Nome do app
Em `src/components/AppSidebar.tsx`:
- "Flagrante Digital" → "Plantão Digital"
- "Processamento de BOs" → "Análise de BOs"

### Bloco 5 — Perfil no sidebar
Em `src/components/AppSidebar.tsx`, substituir exibição de `profile.role` por `{isAdmin ? "Administrador" : "Analista"}`.

### Bloco 6 — Acessibilidade em botões icon-only
Em `src/components/shift/OccurrencesTab.tsx`, em todo `<Button size="icon">` com apenas ícone (Pular OIP, Pular Autoridade, Registrar, Remover, Continuar, Editar etc.):
- Adicionar `aria-label` com o mesmo valor do `title`.
- Adicionar `aria-hidden="true"` no ícone filho.
Sem mudanças de lógica.

### Bloco 7 — Tailwind content paths
Em `tailwind.config.ts`: substituir o array `content` por `["./src/**/*.{ts,tsx}"]`. Resto do arquivo intacto.

### Verificações
Após aplicar, conferirei:
- Cada função edge mantém seu fluxo (apenas headers mudaram).
- `Auth.tsx` e `ResetPassword.tsx` compilam sem `useToast`.
- `AppSidebar.tsx` exibe rótulo correto.
- Nenhum import/arquivo de UI removido.
