import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from "docx";
import { saveAs } from "file-saver";
import type { Shift, ShiftOccurrence } from "@/types/shift";
import { REGIONALS } from "@/types/shift";

export async function exportPODocx(shift: Shift, occurrences: ShiftOccurrence[]) {
  const shiftDate = new Date(shift.shift_date);
  const dateStr = shiftDate.toLocaleDateString("pt-BR");
  const endDate = shift.end_time ? new Date(shift.end_time) : null;
  const endStr = endDate ? endDate.toLocaleDateString("pt-BR") : "—";

  const startTimeStr = new Date(shift.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const endTimeStr = endDate ? endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

  // Group occurrences by regional
  const byRegional: Record<string, ShiftOccurrence[]> = {};
  occurrences.forEach((occ) => {
    const key = occ.regional || "Sem Regional";
    if (!byRegional[key]) byRegional[key] = [];
    byRegional[key].push(occ);
  });

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "P.O. — PARTE DAS OCORRÊNCIAS DO PLANTÃO", bold: true, size: 28, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "CENTRAL DE TELEFLAGRANTE", bold: true, size: 24, font: "Arial" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({
        text: `COM INÍCIO ÀS ${startTimeStr}H DO DIA ${dateStr} E TÉRMINO ÀS ${endTimeStr}H DO DIA ${endStr}`,
        bold: true, size: 22, font: "Arial",
      })],
    })
  );

  // Authorities
  children.push(new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: "AUTORIDADES POLICIAIS:", bold: true, underline: {}, size: 22, font: "Arial" })],
  }));
  shift.authorities.forEach((a) => {
    const sub = a.substituting ? ` (SUBSTITUINDO ${a.substituting.toUpperCase()})` : "";
    children.push(new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text: `${a.name.toUpperCase()}${sub}`, size: 22, font: "Arial" })],
    }));
  });

  // OIPs
  children.push(new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: "OIP - OFICIAIS INVESTIGADORES DE POLÍCIA:", bold: true, underline: {}, size: 22, font: "Arial" })],
  }));
  shift.investigators.forEach((inv) => {
    const sub = inv.substituting ? ` (SUBSTITUINDO ${inv.substituting.toUpperCase()})` : "";
    const nfStr = inv.nf ? ` - NF ${inv.nf}` : "";
    children.push(new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun({ text: `${inv.name.toUpperCase()}${nfStr}${sub}`, size: 22, font: "Arial" })],
    }));
  });

  // ISEO
  if (shift.iseo.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "ISEO:", bold: true, underline: {}, size: 22, font: "Arial" })],
    }));
    shift.iseo.forEach((is) => {
      const sub = is.substituting ? ` (SUBSTITUINDO ${is.substituting.toUpperCase()})` : "";
      const nfStr = is.nf ? ` - NF ${is.nf}` : "";
      children.push(new Paragraph({
        children: [new TextRun({ text: `${is.name.toUpperCase()}${nfStr}${sub}`, size: 22, font: "Arial" })],
      }));
    });
  }

  // Absences
  if (shift.absences && shift.absences.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "AUSÊNCIAS:", bold: true, underline: {}, size: 22, font: "Arial" })],
    }));
    shift.absences.forEach((abs) => {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: `${abs.name.toUpperCase()} — ${abs.reason.toUpperCase()}`, size: 22, font: "Arial" })],
      }));
    });
  }

  // PARTE ADMINISTRATIVA header
  children.push(new Paragraph({
    spacing: { before: 400, after: 100 },
    children: [new TextRun({ text: "PARTE ADMINISTRATIVA", bold: true, size: 24, font: "Arial" })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
  }));

  // Occurrences by regional
  const regionalOrder = [...REGIONALS, "Sem Regional"];
  regionalOrder.forEach((regional) => {
    const occs = byRegional[regional];
    if (!occs || occs.length === 0) return;

    children.push(new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: regional.toUpperCase(), bold: true, size: 22, font: "Arial" })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "666666", space: 1 } },
    }));

    occs.forEach((occ, idx) => {
      const types = [occ.procedure_type, occ.procedure_type_2, occ.procedure_type_3].filter(Boolean).join(" + ");
      const status = occ.po_status ? ` - ${occ.po_status.toUpperCase()}` : "";
      
      children.push(new Paragraph({
        spacing: { before: 100 },
        children: [
          new TextRun({ text: `${idx + 1}. `, bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: `${types} BU ${occ.bu_number}${status}`, bold: true, size: 22, font: "Arial" }),
        ],
      }));

      if (occ.conducted_names) {
        children.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: `CONDUZIDO(S): ${occ.conducted_names.toUpperCase()}`, size: 20, font: "Arial" })],
        }));
      }
      if (occ.victim_names) {
        children.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: `VÍTIMA(S): ${occ.victim_names.toUpperCase()}`, size: 20, font: "Arial" })],
        }));
      }
      if (occ.tipification) {
        children.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: `TIPIFICAÇÃO: ${occ.tipification.toUpperCase()}`, size: 20, font: "Arial" })],
        }));
      }
      if (occ.observations) {
        children.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: occ.observations, italics: true, size: 20, font: "Arial" })],
        }));
      }
    });
  });

  // Observations at the end of the document
  if (shift.observations && shift.observations.length > 0) {
    children.push(new Paragraph({
      spacing: { before: 400, after: 100 },
      children: [new TextRun({ text: "OBSERVAÇÕES ADMINISTRATIVAS:", bold: true, underline: {}, size: 22, font: "Arial" })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 1 } },
    }));
    shift.observations.forEach((obs) => {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: obs, size: 22, font: "Arial" })],
      }));
    });
  }

    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: "bullet" as any,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${dateStr.replace(/\//g, "-")}_PO_${shift.team_name.replace(/\s/g, "_")}.docx`;
  saveAs(blob, fileName);
}
