import { useState } from "react";
import { useShift } from "@/hooks/useShift";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardList, BarChart3, FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { CreateShiftDialog } from "@/components/shift/CreateShiftDialog";
import { EditShiftDialog } from "@/components/shift/EditShiftDialog";
import { OccurrencesTab } from "@/components/shift/OccurrencesTab";
import { StatisticsTab } from "@/components/shift/StatisticsTab";
import { ResumoTab } from "@/components/shift/ResumoTab";
import { ShiftSelector } from "@/components/shift/ShiftSelector";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const Plantao = () => {
  const shift = useShift();
  const { isAdmin } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (shift.loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!shift.activeShift) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <div className="text-center space-y-2">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Nenhum plantão ativo</h2>
          <p className="text-sm text-muted-foreground">
            Inicie um novo plantão ou selecione um anterior.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Plantão
          </Button>
          {shift.shifts.length > 0 && (
            <ShiftSelector shifts={shift.shifts} onSelect={shift.selectShift} />
          )}
        </div>
        <CreateShiftDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onCreate={shift.createShift}
        />
      </div>
    );
  }

  const handleDeleteShift = async () => {
    try {
      await shift.deleteShift(shift.activeShift!.id);
      toast.success("Plantão excluído com sucesso");
    } catch {
      toast.error("Erro ao excluir plantão");
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {shift.activeShift.team_name} — {new Date(shift.activeShift.shift_date).toLocaleDateString("pt-BR")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {shift.activeShift.status === "active" ? "🟢 Plantão ativo" : "🔴 Plantão encerrado"} · {shift.occurrences.length} ocorrência(s)
          </p>
        </div>
        <div className="flex gap-2">
          <ShiftSelector shifts={shift.shifts} onSelect={shift.selectShift} />
          {shift.activeShift.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Editar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir plantão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Todas as ocorrências deste plantão também serão excluídas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteShift} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="occurrences" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="occurrences" className="gap-1.5">
            <ClipboardList className="w-4 h-4" /> Ocorrências
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5">
            <BarChart3 className="w-4 h-4" /> Estatísticas
          </TabsTrigger>
          <TabsTrigger value="resumo" className="gap-1.5">
            <FileText className="w-4 h-4" /> Resumo / PO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="occurrences" className="flex-1 mt-4">
          <OccurrencesTab
            shift={shift.activeShift}
            occurrences={shift.occurrences}
            onAdd={shift.addOccurrence}
            onUpdate={shift.updateOccurrence}
            onDelete={shift.deleteOccurrence}
          />
        </TabsContent>

        <TabsContent value="statistics" className="flex-1 mt-4">
          <StatisticsTab occurrences={shift.occurrences} shift={shift.activeShift} />
        </TabsContent>

        <TabsContent value="resumo" className="flex-1 mt-4">
          <ResumoTab
            shift={shift.activeShift}
            occurrences={shift.occurrences}
            onAddObservation={shift.addObservation}
            onCloseShift={shift.closeShift}
          />
        </TabsContent>
      </Tabs>

      <CreateShiftDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={shift.createShift}
      />
      {shift.activeShift && (
        <EditShiftDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          shift={shift.activeShift}
          onUpdate={shift.updateShift}
        />
      )}
    </div>
  );
};

export default Plantao;
