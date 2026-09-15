import * as jspdfModule from "jspdf";
const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default || jspdfModule;

console.log("jsPDF typeof:", typeof jsPDF);
try {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  console.log("doc created ok! pages:", doc.getNumberOfPages());
} catch (e) {
  console.error("doc creation failed:", e);
}
