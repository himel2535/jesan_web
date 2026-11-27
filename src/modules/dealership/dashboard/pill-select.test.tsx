import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PillSelect } from './pill-select';

const options = [
  { value: 'today' as const, label: 'Today' },
  { value: 'yesterday' as const, label: 'Yesterday' },
];

function setup() {
  render(<PillSelect label="Period" value="today" options={options} onChange={vi.fn()} />);
  const select = screen.getByRole('combobox', { name: 'Period' });
  return { select, label: select.closest('label') as HTMLLabelElement };
}

describe('PillSelect', () => {
  afterEach(() => {
    // jsdom has no showPicker; each test installs its own and removes it again.
    Reflect.deleteProperty(HTMLSelectElement.prototype, 'showPicker');
  });

  it('sits above the label hit-area overlay, so a click reaches the select', () => {
    const { select } = setup();
    // The label's ::before is positioned; an unpositioned select would paint under it.
    expect(select.className.split(/\s+/)).toContain('relative');
  });

  it('opens the picker when the click lands on the label hit area outside the select', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLSelectElement.prototype, 'showPicker', {
      value: showPicker,
      configurable: true,
    });
    const { label } = setup();
    fireEvent.click(label);
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('leaves a click on the select itself to the browser (no second picker call)', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLSelectElement.prototype, 'showPicker', {
      value: showPicker,
      configurable: true,
    });
    const { select } = setup();
    fireEvent.click(select);
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('survives a browser without showPicker', () => {
    const { label } = setup();
    expect(() => fireEvent.click(label)).not.toThrow();
  });

  it('survives showPicker throwing (no user activation)', () => {
    Object.defineProperty(HTMLSelectElement.prototype, 'showPicker', {
      value: () => {
        throw new DOMException('not allowed', 'NotAllowedError');
      },
      configurable: true,
    });
    const { label } = setup();
    expect(() => fireEvent.click(label)).not.toThrow();
  });
});
