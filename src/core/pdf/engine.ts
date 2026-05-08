// Cohesive re-export so consumers can `await import('@/core/pdf/engine')`
// and pull all PDF deps into the lazy chunk in one shot.
//
// IMPORTANT: never re-export this module from src/core/pdf/index.ts —
// it must only be reached via dynamic import to keep the lazy chunk.
export { jsPDF } from 'jspdf';
export { autoTable } from 'jspdf-autotable'; // v5 functional API
export { default as html2canvas } from 'html2canvas';
export { createPdfHelpers, type PdfHelpers, type PdfHelperOptions, type PdfI18n } from './helpers';
