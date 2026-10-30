export function applyTableLabels(tableSelector = '.table-card') {
  const tables = document.querySelectorAll(tableSelector);
  tables.forEach(table => {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const headers = [...headerRow.querySelectorAll('th')];
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      cells.forEach((cell, i) => {
        if (headers[i] && !cell.hasAttribute('data-label') && !cell.colSpan) {
          cell.setAttribute('data-label', headers[i].textContent.replace(/[↑↓↕]/g, '').trim());
        }
      });
    });
  });
}
