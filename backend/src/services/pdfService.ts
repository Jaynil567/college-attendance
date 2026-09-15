import PDFDocument from 'pdfkit';

export interface StudentPdfRow {
  srNo: number;
  group: string;
  division: string;
  rollNumber: string;
  enrollment: string;
  name: string;
  password: string;
}

export class PdfService {
  /**
   * Generates a clean, print-ready PDF for student credentials
   */
  static generateCredentialsPdf(students: StudentPdfRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 30;
      const contentWidth = pageWidth - margin * 2; // 781.89

      // Column widths (Total = 781)
      const colWidths = [40, 60, 60, 70, 160, 260, 131];
      const colHeaders = ['Sr. No', 'Group', 'Division', 'Roll No', 'Enrollment Number', 'Student Name', 'Password'];

      const drawHeader = () => {
        // Title Banner
        doc.rect(margin, 25, contentWidth, 32).fill('#059669');
        doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
           .text('COLLEGE STUDENT CREDENTIALS DIRECTORY', margin, 34, { width: contentWidth, align: 'center' });

        // Subtitle
        doc.fillColor('#4B5563').fontSize(9).font('Helvetica-Oblique')
           .text(`Generated: ${new Date().toLocaleString()} | Total Students: ${students.length} | Sorted by Group -> Division -> Roll Number`, margin, 62, { width: contentWidth, align: 'center' });

        // Table Header Row
        const y = 80;
        doc.rect(margin, y, contentWidth, 24).fill('#1E293B');

        let currentX = margin;
        colHeaders.forEach((header, i) => {
          doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
             .text(header, currentX + 4, y + 7, {
               width: colWidths[i] - 8,
               align: i < 4 || i === 6 ? 'center' : 'left',
             });
          currentX += colWidths[i];
        });
      };

      drawHeader();

      let currentY = 104;
      const rowHeight = 20;
      const maxY = pageHeight - 40;

      students.forEach((st, idx) => {
        if (currentY + rowHeight > maxY) {
          doc.addPage();
          drawHeader();
          currentY = 104;
        }

        // Alternating row background
        if (idx % 2 === 1) {
          doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F8FAFC');
        }

        // Row border
        doc.rect(margin, currentY, contentWidth, rowHeight).strokeColor('#CBD5E1').stroke();

        let currentX = margin;
        const rowVals = [
          String(st.srNo),
          st.group || '-',
          st.division || '-',
          st.rollNumber || '-',
          st.enrollment,
          st.name,
          st.password || '-',
        ];

        rowVals.forEach((val, i) => {
          doc.fillColor('#0F172A').fontSize(8.5).font(i === 4 || i === 6 ? 'Helvetica-Bold' : 'Helvetica')
             .text(val, currentX + 4, currentY + 5, {
               width: colWidths[i] - 8,
               align: i < 4 || i === 6 ? 'center' : 'left',
               lineBreak: false,
               ellipsis: true,
             });
          currentX += colWidths[i];
        });

        currentY += rowHeight;
      });

      // Global Page Footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#64748B').fontSize(8).font('Helvetica')
           .text(`Page ${i + 1} of ${range.count}`, margin, pageHeight - 25, { width: contentWidth, align: 'center' });
      }

      doc.end();
    });
  }
}
