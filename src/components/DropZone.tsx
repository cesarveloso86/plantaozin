import { useCallback, useState } from "react";
import { FileText, Upload } from "lucide-react";


interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const DropZone = ({ onFileSelected, disabled }: DropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        onFileSelected(file);
      }
    },
    [onFileSelected, disabled]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onFileSelected(file);
    };
    input.click();
  }, [onFileSelected, disabled]);

  return (
    <div
      className="w-full max-w-2xl mx-auto"
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative flex flex-col items-center justify-center
          min-h-[280px] p-10 rounded-lg border-2 border-dashed
          cursor-pointer transition-all duration-300
          ${isDragOver
            ? "border-primary bg-accent scale-[1.02]"
            : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <div
          key={isDragOver ? "drag" : "idle"}
          className="flex flex-col items-center gap-5"
        >
          <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center">
            {isDragOver ? (
              <Upload className="w-10 h-10 text-primary" />
            ) : (
              <FileText className="w-10 h-10 text-primary" />
            )}
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">
              {isDragOver ? "Solte o arquivo aqui" : "Arraste o Boletim de Ocorrência"}
            </p>
            <p className="text-sm text-muted-foreground">
              Formato aceito: PDF • Clique para selecionar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
