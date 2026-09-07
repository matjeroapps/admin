import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  Button,
  Input,
  Select,
  Checkbox,
  Radio,
  Badge,
  Alert,
  Card,
  CardTitle,
  Skeleton,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Pagination,
} from '../src/index.js';

describe('MatjerHub Core UI Components', () => {
  it('renders Button with variants and handles click events', () => {
    const handleClick = vi.fn();
    render(<Button variant="primary" onClick={handleClick}>Click Me</Button>);
    
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders Input with label and handles text change', () => {
    const handleChange = vi.fn();
    render(<Input label="Username" placeholder="Enter username" onChange={handleChange} />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/enter username/i);
    fireEvent.change(input, { target: { value: 'johndoe' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders Select with options', () => {
    const options = [
      { label: 'Option A', value: 'a' },
      { label: 'Option B', value: 'b' },
    ];
    render(<Select label="Test Select" options={options} />);
    expect(screen.getByLabelText(/test select/i)).toBeInTheDocument();
  });

  it('renders Checkbox and handles toggle', () => {
    const handleChange = vi.fn();
    render(<Checkbox label="Accept terms" onChange={handleChange} />);

    const checkbox = screen.getByRole('checkbox', { name: /accept terms/i });
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders Badge and Alert', () => {
    render(
      <div>
        <Badge variant="success">Active</Badge>
        <Alert variant="info" title="Notice">Operation completed</Alert>
      </div>
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Operation completed');
  });

  it('renders Card and Table structure', () => {
    render(
      <Card>
        <CardTitle>Data Summary</CardTitle>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>1</TableCell>
              <TableCell>MatjerHub</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    );

    expect(screen.getByText('Data Summary')).toBeInTheDocument();
    expect(screen.getByText('MatjerHub')).toBeInTheDocument();
  });

  it('renders Pagination and handles page changes', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={handlePageChange}
        totalItems={50}
      />
    );

    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
