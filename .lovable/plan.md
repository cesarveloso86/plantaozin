## Remover uso de framer-motion (sem desinstalar)

Substituir todos os `motion.X` por elementos HTML equivalentes e remover os atributos de animação (`initial`, `animate`, `exit`, `transition`, `variants`, `whileHover`) e `AnimatePresence`. Manter todas as classes Tailwind. Pacote `framer-motion` permanece no `package.json`.

### Arquivos afetados (8)

**1. `src/components/AnalysisResult.tsx`**
- Remover `import { motion } from "framer-motion";` (linha 2).
- Remover constante `fadeUp` (linhas 45–49).
- Trocar 7 `motion.div` por `div` (linhas 133, 135, 167, 176, 223, 281, 299) e seus fechamentos correspondentes (163, 172, 219, 277, 330, 334, 365). Remover `initial`, `animate`, `transition`, `{...fadeUp}`.

**2. `src/components/ProcessingStatus.tsx`**
- Remover import de `motion`.
- `motion.div` (l.17) → `div`; remover `initial`/`animate`. Fechamento l.74.
- `motion.p` (l.65) → `p`; remover `initial`/`animate`. Fechamento l.71.

**3. `src/components/DropZone.tsx`**
- Remover `import { motion, AnimatePresence } from "framer-motion";`.
- `motion.div` externo (l.48) → `div`; remover `initial`/`animate`/`transition`. Fechamento l.96.
- Remover wrapper `<AnimatePresence mode="wait">` (l.70 e l.94) — manter apenas filho.
- `motion.div` interno (l.71) → `div`; remover `initial`/`animate`/`exit`. Manter `key`. Fechamento l.93.

**4. `src/pages/AdminUsuarios.tsx`**
- Remover import de `motion`.
- `motion.div` (l.416) → `div`; remover `initial`/`animate`/`transition`. Fechamento l.493.

**5. `src/pages/Historico.tsx`**
- Remover import de `motion`.
- `motion.div` (l.113) → `div`; remover `initial`/`animate`/`transition`. Manter `key`. Fechamento l.160.

**6. `src/pages/Perfil.tsx`**
- Remover import de `motion`.
- 2 `motion.div` (l.105, l.196) → `div`; remover `initial`/`animate`/`transition`. Fechamentos l.193 e l.280.

**7. `src/pages/Auth.tsx`**
- Remover import de `motion`.
- `motion.div` (l.107) → `div`; remover `initial`/`animate`/`transition`. Fechamento l.272.

**8. `src/pages/ResetPassword.tsx`**
- Remover import de `motion`.
- `motion.div` (l.140) → `div`; remover `initial`/`animate`/`transition`. Fechamento l.182.

### Não será alterado
- Lógica de negócio, classes Tailwind, `key`, `className`, handlers.
- `package.json` (framer-motion permanece instalado).
- Nenhum outro arquivo.