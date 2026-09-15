import ExcelJS from 'exceljs';

export interface AttendanceExportRow {
  enrollmentNumber: string;
  studentName: string;
  division: string;
  rollNumber: string;
  groupName: string;
  status: string;
  markedAt?: string;
}

export class ExcelService {
  /**
   * Generates a formatted Excel workbook for attendance records
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

    const worksheet = workbook.addWorksheet('Attendance Sheet', {
      views: [{ showGridLines: true }],
    });

    // 1. Title Banner
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'COLLEGE ATTENDANCE SHEET';
    titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF064E3B' }, // Emerald Dark Green
    };
    worksheet.getRow(1).height = 36;

    // 2. Subtitle Meta
    worksheet.mergeCells('A2:H2');
    const subtitleCell = worksheet.getCell('A2');
    const metaParts = [];
    if (data.className) metaParts.push(`Auditorium/Class: ${data.className}`);
    if (data.subject) metaParts.push(`Subject: ${data.subject}`);
    if (data.dateRange) metaParts.push(`Session: ${data.dateRange}`);
    metaParts.push(`Generated: ${new Date().toLocaleString()}`);
    subtitleCell.value = metaParts.join(' | ');
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF374151' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    worksheet.getRow(2).height = 22;

    // Row 3 separator
    worksheet.getRow(3).height = 8;

    // 3. Headers
    const headers = [
      'Sr. No',
      'Enrollment Number',
      'Name Of Student',
      'Division',
      'Roll Number',
      'Group',
      'Status',
      'Time Marked',
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 26;
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let col = 1; col <= headers.length; col++) {
      const cell = headerRow.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }, // Emerald Green
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF6EE7B7' } },
        bottom: { style: 'medium', color: { argb: 'FF047857' } },
      };
    }

    // 4. Rows
    let rowIndex = 5;
    data.records.forEach((rec, idx) => {
      const row = worksheet.getRow(rowIndex);
      const isPresent = rec.status.toUpperCase() === 'PRESENT';

      row.values = [
        idx + 1,
        rec.enrollmentNumber,
        rec.studentName,
        rec.division || 'N/A',
        rec.rollNumber || 'N/A',
        rec.groupName || 'N/A',
        rec.status.toUpperCase(),
        rec.markedAt ? new Date(rec.markedAt).toLocaleTimeString() : (isPresent ? 'Present' : '-'),
      ];

      row.height = 22;
      row.alignment = { vertical: 'middle', horizontal: 'left' };

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

      // Status styling
      const statusCell = row.getCell(7);
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      statusCell.font = { bold: true, color: { argb: isPresent ? 'FF15803D' : 'FFDC2626' } };

      rowIndex++;
    });

    // Summary Footer
    worksheet.getRow(rowIndex).height = 10;
    rowIndex++;

    const totalStudents = data.records.length;
    const presentStudents = data.records.filter((r) => r.status.toUpperCase() === 'PRESENT').length;
    const absentStudents = totalStudents - presentStudents;
    const rate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;

    worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);
    const summaryLabel = worksheet.getCell(`A${rowIndex}`);
    summaryLabel.value = 'ATTENDANCE SUMMARY';
    summaryLabel.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
    summaryLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    worksheet.mergeCells(`E${rowIndex}:H${rowIndex}`);
    const summaryVal = worksheet.getCell(`E${rowIndex}`);
    summaryVal.value = `Total Students: ${totalStudents} | Present: ${presentStudents} | Absent: ${absentStudents} (${rate}%)`;
    summaryVal.font = { bold: true, size: 11, color: { argb: 'FF047857' } };
    summaryVal.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryVal.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' },
    };
    worksheet.getRow(rowIndex).height = 26;

    // Column widths
    worksheet.getColumn(1).width = 8;  // Sr. No
    worksheet.getColumn(2).width = 22; // Enrollment Number
    worksheet.getColumn(3).width = 32; // Name Of Student
    worksheet.getColumn(4).width = 14; // Division
    worksheet.getColumn(5).width = 14; // Roll Number
    worksheet.getColumn(6).width = 14; // Group
    worksheet.getColumn(7).width = 14; // Status
    worksheet.getColumn(8).width = 18; // Time Marked

    return await workbook.xlsx.writeBuffer();
  }
}
