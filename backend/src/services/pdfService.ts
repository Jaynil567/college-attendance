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
   * Generates a compact, high-density A4 Portrait PDF for printing maximum students per page (~50+ students/page)
   */
  static generateCredentialsPdf(students: StudentPdfRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 20,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2; // 555.28

      // Column widths (Total = 555pt)
      const colWidths = [28, 38, 38, 42, 110, 204, 95];
      const colHeaders = ['#', 'Group', 'Div', 'Roll', 'Enrollment No', 'Student Name', 'Password'];

      const drawHeader = () => {
        // Compact Title Banner
        doc.rect(margin, 15, contentWidth, 22).fill('#059669');
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
           .text('COLLEGE STUDENT CREDENTIALS DIRECTORY', margin, 21, { width: contentWidth, align: 'center' });

        // Subtitle
        doc.fillColor('#374151').fontSize(7.5).font('Helvetica-Oblique')
           .text(`Generated: ${new Date().toLocaleString()} | Total: ${students.length} Students | Order: Group -> Division -> Roll No`, margin, 41, { width: contentWidth, align: 'center' });

        // Table Header Row
        const y = 54;
        doc.rect(margin, y, contentWidth, 16).fill('#1E293B');

        let currentX = margin;
        colHeaders.forEach((header, i) => {
          doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
             .text(header, currentX + 2, y + 4, {
               width: colWidths[i] - 4,
               align: i < 4 || i === 6 ? 'center' : 'left',
             });
          currentX += colWidths[i];
        });
      };

      drawHeader();

      let currentY = 70;
      const rowHeight = 14;
      const maxY = pageHeight - 25;

      students.forEach((st, idx) => {
        if (currentY + rowHeight > maxY) {
          doc.addPage();
          drawHeader();
          currentY = 70;
        }

        // Alternating row background
        if (idx % 2 === 1) {
          doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F8FAFC');
        }

        // Lightweight horizontal border line
        doc.moveTo(margin, currentY + rowHeight)
           .lineTo(margin + contentWidth, currentY + rowHeight)
           .strokeColor('#E2E8F0').lineWidth(0.5).stroke();

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
          doc.fillColor('#0F172A').fontSize(7.5).font(i === 4 || i === 6 ? 'Helvetica-Bold' : 'Helvetica')
             .text(val, currentX + 2, currentY + 3, {
               width: colWidths[i] - 4,
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
        doc.fillColor('#64748B').fontSize(7.5).font('Helvetica')
           .text(`Page ${i + 1} of ${range.count}`, margin, pageHeight - 18, { width: contentWidth, align: 'center' });
      }

      doc.end();
    });
  }
}
