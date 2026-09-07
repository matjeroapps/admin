import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, style, className = '', ...props }) => (
  <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
        textAlign: 'left',
        color: 'var(--color-foreground)',
        ...style,
      }}
      className={`matjer-table ${className}`}
      {...props}
    >
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, style, ...props }) => (
  <thead style={{ backgroundColor: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)', ...style }} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, ...props }) => (
  <tbody {...props}>{children}</tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, style, className = '', ...props }) => (
  <tr
    style={{
      borderBottom: '1px solid var(--color-border)',
      transition: 'var(--transition-fast)',
      ...style,
    }}
    className={`matjer-table-row ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, style, ...props }) => (
  <th
    style={{
      padding: '12px 16px',
      fontWeight: 600,
      color: 'var(--color-muted-foreground)',
      fontSize: '13px',
      ...style,
    }}
    {...props}
  >
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, style, ...props }) => (
  <td
    style={{
      padding: '12px 16px',
      color: 'var(--color-foreground)',
      ...style,
    }}
    {...props}
  >
    {children}
  </td>
);
