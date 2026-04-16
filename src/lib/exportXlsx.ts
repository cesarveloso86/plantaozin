import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { PROCEDURE_TYPES } from "@/types/shift";

export async function exportShiftXlsx(shift: Shift, occurrences: ShiftOccurrence[]) {
  // Apenas ocorrências atendidas entram no relatório oficial.
  const finalOccs = occurrences.filter((o) => o.status !== "em_atendimento");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Controle de procedimentos");

  // Header row
  const shiftDate = new Date(shift.shift_date).toLocaleDateString("pt-BR");
  ws.mergeCells("G1:H1");
  const headerCell = ws.getCell("G1");
  headerCell.value = `${shift.team_name}`;
  headerCell.font = { bold: true, size: 14 };
  ws.getCell("H1").value = shiftDate;

  // Column headers
  const headers = [
    "BU", "HORÁRIO DE TRAMITAÇÃO", "PROCEDIMENTO", "PROCEDIMENTO 2", "PROCEDIMENTO 3",
    "OFICIAL INVESTIGADOR DE POLÍCIA", "AUTORIDADE POLICIAL", "REGIONAL",
    "HORÁRIO FINAL DA LAVRATURA DO BU", "HORÁRIO DA 1ª OITIVA",
    "RELATÓRIO", "QUANTIDADE DE OITIVAS", "OBSERVAÇÕES",
  ];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8F0" } };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
    cell.alignment = { horizontal: "center", wrapText: true };
  });

  // Sort by tramitation_time ASC (ordem de atendimento)
  const sortedOccs = [...occurrences].sort((a, b) => {
    const ta = a.tramitation_time ? new Date(a.tramitation_time).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.tramitation_time ? new Date(b.tramitation_time).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "";

  // Data rows
  sortedOccs.forEach((occ) => {
    const row = ws.addRow([
      occ.bu_number,
      fmtTime(occ.tramitation_time),
      occ.procedure_type || "",
      occ.procedure_type_2 || "",
      occ.procedure_type_3 || "",
      occ.investigator || "",
      occ.authority || "",
      occ.regional || "",
      fmtTime(occ.final_time),
      fmtTime(occ.first_hearing_time),
      occ.has_report ? "SIM" : "NÃO",
      occ.num_hearings,
      occ.observations || "",
    ]);

    row.eachCell((cell) => {
      cell.font = { size: 10 };
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
  });

  // Column widths
  ws.columns = [
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 25 }, { width: 20 }, { width: 25 },
    { width: 18 }, { width: 16 }, { width: 10 }, { width: 12 }, { width: 30 },
  ];

  // Statistics section
  const statsStartCol = 15; // column O
  const statsCol = (col: number) => ws.getCell(2, statsStartCol + col);
  
  // Header
  ws.getCell(2, statsStartCol).value = "CONTROLE INTERNO";
  ws.getCell(2, statsStartCol).font = { bold: true, size: 11 };

  ws.getCell(3, statsStartCol).value = "QUANTITATIVO DE PROCEDIMENTOS";
  ws.getCell(3, statsStartCol).font = { bold: true, size: 10 };

  // Total hearings
  const totalHearings = occurrences.reduce((sum, o) => sum + (o.num_hearings || 0), 0);
  ws.getCell(3, statsStartCol + 1).value = "TOTAL DE OITIVAS";
  ws.getCell(3, statsStartCol + 1).font = { bold: true, size: 10 };
  ws.getCell(5, statsStartCol + 1).value = totalHearings;
  ws.getCell(5, statsStartCol + 1).font = { bold: true, size: 14 };

  // Total procedures
  ws.getCell(7, statsStartCol + 1).value = "TOTAL DE PROCEDIMENTOS";
  ws.getCell(7, statsStartCol + 1).font = { bold: true, size: 10 };
  ws.getCell(9, statsStartCol + 1).value = occurrences.length;
  ws.getCell(9, statsStartCol + 1).font = { bold: true, size: 14 };

  // Count by type
  let statsRow = 11;
  const typeCounts: Record<string, number> = {};
  occurrences.forEach((occ) => {
    [occ.procedure_type, occ.procedure_type_2, occ.procedure_type_3].forEach((pt) => {
      if (pt) typeCounts[pt] = (typeCounts[pt] || 0) + 1;
    });
  });

  PROCEDURE_TYPES.forEach((pt) => {
    const count = typeCounts[pt] || 0;
    if (count > 0) {
      ws.getCell(statsRow, statsStartCol + 1).value = `TOTAL DE ${pt}`;
      ws.getCell(statsRow, statsStartCol + 1).font = { bold: true, size: 10 };
      ws.getCell(statsRow + 2, statsStartCol + 1).value = count;
      ws.getCell(statsRow + 2, statsStartCol + 1).font = { bold: true, size: 14 };
      statsRow += 4;
    }
  });

  // Investigators section
  const invSheet = wb.addWorksheet("Por OIP");
  invSheet.addRow(["OIP", "Quantidade"]);
  const invCounts: Record<string, number> = {};
  occurrences.forEach((o) => {
    if (o.investigator) invCounts[o.investigator] = (invCounts[o.investigator] || 0) + 1;
  });
  Object.entries(invCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    invSheet.addRow([name, count]);
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fileName = `${shiftDate.replace(/\//g, "-")}_${shift.team_name.replace(/\s/g, "_")}.xlsx`;
  saveAs(blob, fileName);
}
