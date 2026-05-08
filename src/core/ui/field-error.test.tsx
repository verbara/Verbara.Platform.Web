import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldError } from './field-error';

describe('FieldError', () => {
  it('Renders_Null_WhenMessageIsUndefined', () => {
    const { container } = render(<FieldError id="email-error" />);
    expect(container.firstChild).toBeNull();
  });

  it('Renders_PWithRoleAlertAndId_WhenMessagePresent', () => {
    const { container } = render(<FieldError id="email-error" message="invalid" />);
    const p = container.firstChild as HTMLParagraphElement;
    expect(p).toBeInTheDocument();
    expect(p.tagName).toBe('P');
    expect(p.getAttribute('role')).toBe('alert');
    expect(p.getAttribute('id')).toBe('email-error');
    expect(p.textContent).toBe('invalid');
  });

  it('Merges_CustomClassName', () => {
    const { container } = render(<FieldError id="x" message="oops" className="extra" />);
    const p = container.firstChild as HTMLElement;
    expect(p.className).toContain('extra');
    expect(p.className).toContain('text-destructive');
  });
});
