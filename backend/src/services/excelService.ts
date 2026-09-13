import ExcelJS from 'exceljs';

export interface AttendanceExportRow {
  enrollmentNumber: string;
  studentName: string;
  className: string;
  subject: string;
  semester: string;
  division: string;
  sessionName: string;
  markedAt: string;
  status: string;
  esp32Id: string;
  rssi: number | string;
}

export class ExcelService {
  /**
   * Generates a beautifully formatted Excel workbook for attendance records
   */
  static async generateAttendanceWorkbook(data: {
    className?: string;
    subject?: string;
    dateRange?: string;
    records: AttendanceExportRow[];
  }): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'College Classroom Attendance System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Attendance Report', {
      views: [{ showGridLines: true }],
    });

    // 1. Title Banner
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'COLLEGE CLASSROOM ATTENDANCE REPORT';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Blue
    };
    worksheet.getRow(1).height = 40;

    // 2. Metadata Subtitle
    worksheet.mergeCells('A2:J2');
    const subtitleCell = worksheet.getCell('A2');
    const metaParts = [];
    if (data.className) metaParts.push(`Class: ${data.className}`);
    if (data.subject) metaParts.push(`Subject: ${data.subject}`);
    if (data.dateRange) metaParts.push(`Period: ${data.dateRange}`);
    metaParts.push(`Generated: ${new Date().toLocaleString()}`);
    subtitleCell.value = metaParts.join(' | ');
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF374151' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    worksheet.getRow(2).height = 24;

    // Empty separator row
    worksheet.getRow(3).height = 10;

    // 3. Table Headers
    const headers = [
      '#',
      'Enrollment Number',
      'Student Name',
      'Class',
      'Subject',
      'Div / Sem',
      'Session Name',
      'Time Marked',
      'ESP32 Device',
      'Status',
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 28;
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let col = 1; col <= headers.length; col++) {
      const cell = headerRow.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Royal Blue
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF93C5FD' } },
        bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      };
    }

    // 4. Data Rows
    let rowIndex = 5;
    data.records.forEach((rec, idx) => {
      const row = worksheet.getRow(rowIndex);
      const isPresent = rec.status.toLowerCase() === 'present';

      row.values = [
        idx + 1,
        rec.enrollmentNumber,
        rec.studentName,
        rec.className,
        rec.subject,
        `${rec.division} / Sem ${rec.semester}`,
        rec.sessionName,
        rec.markedAt ? new Date(rec.markedAt).toLocaleTimeString() : 'N/A',
        rec.esp32Id,
        rec.status.toUpperCase(),
      ];

      row.height = 22;
      row.alignment = { vertical: 'middle', horizontal: 'left' };

      // Alternating zebra striping
      const rowBg = rowIndex % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
      for (let c = 1; c <= headers.length; c++) {
        const cell = row.getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBg },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }

      // Status pill coloring
      const statusCell = row.getCell(10);
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      statusCell.font = { bold: true, color: { argb: isPresent ? 'FF15803D' : 'FFB91C1C' } };

      rowIndex++;
    });

    // 5. Summary Statistics Footer
    worksheet.getRow(rowIndex).height = 12;
    rowIndex++;

    const totalStudents = data.records.length;
    const presentStudents = data.records.filter((r) => r.status.toLowerCase() === 'present').length;
    const absentStudents = totalStudents - presentStudents;
    const attendancePct = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;

    worksheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
    const summaryLabel = worksheet.getCell(`A${rowIndex}`);
    summaryLabel.value = 'ATTENDANCE SUMMARY STATISTICS';
    summaryLabel.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
    summaryLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    worksheet.mergeCells(`G${rowIndex}:J${rowIndex}`);
    const summaryValues = worksheet.getCell(`G${rowIndex}`);
    summaryValues.value = `Total: ${totalStudents} | Present: ${presentStudents} | Absent: ${absentStudents} | Rate: ${attendancePct}%`;
    summaryValues.font = { bold: true, size: 11, color: { argb: 'FF1D4ED8' } };
    summaryValues.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryValues.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' },
    };
    worksheet.getRow(rowIndex).height = 26;

    // Set Column Widths
    worksheet.getColumn(1).width = 6;  // #
    worksheet.getColumn(2).width = 22; // Enrollment Number
    worksheet.getColumn(3).width = 26; // Student Name
    worksheet.getColumn(4).width = 24; // Class
    worksheet.getColumn(5).width = 24; // Subject
    worksheet.getColumn(6).width = 16; // Div/Sem
    worksheet.getColumn(7).width = 28; // Session Name
    worksheet.getColumn(8).width = 16; // Time Marked
    worksheet.getColumn(9).width = 18; // ESP32 Device
    worksheet.getColumn(10).width = 14; // Status

    return await workbook.xlsx.writeBuffer();
  }
}
