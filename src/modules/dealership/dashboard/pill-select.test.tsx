import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PillSelect } from './pill-select';

const options = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar', disabled: true },
  { value: 4, label: 'Apr' },
];

function setup(onChange = vi.fn()) {
  render(
    <div>
      <PillSelect label="Choose month" value={2} options={options} onChange={onChange} />
      <button type="button">elsewhere</button>
    </div>,
  );
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Choose month' }) };
}

describe('PillSelect', () => {
  it('shows the chosen option on the pill and keeps the list closed', () => {
    const { trigger } = setup();
    expect(trigger).toHaveTextContent('Feb');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens a visible list of options on a plain click, with the current one selected', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const list = await screen.findByRole('listbox', { name: 'Choose month' });
    expect(list).toBeVisible();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
    ]);
    expect(screen.getByRole('option', { name: 'Feb' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Jan' })).toHaveAttribute('aria-selected', 'false');
  });

  it('picks an option with a click, closes, and gives focus back to the pill', async () => {
    const user = userEvent.setup();
    const { trigger, onChange } = setup();
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Apr' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('does not pick a disabled option', async () => {
    const user = userEvent.setup();
    const { trigger, onChange } = setup();
    await user.click(trigger);
    const disabled = await screen.findByRole('option', { name: 'Mar' });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on Escape and on a click outside, without picking anything', async () => {
    const user = userEvent.setup();
    const { trigger, onChange } = setup();
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking the pill again closes it', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    await screen.findByRole('listbox');
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('works from the keyboard: arrows skip disabled options, Enter picks', async () => {
    const user = userEvent.setup();
    const { trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const feb = await screen.findByRole('option', { name: 'Feb' });
    expect(feb).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    // Mar is disabled, so Apr is next.
    expect(screen.getByRole('option', { name: 'Apr' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('option', { name: 'Jan' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('gives each option a 40px touch target', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    await user.click(trigger);
    for (const option of await screen.findAllByRole('option')) {
      expect(option.className).toContain('min-h-10');
    }
  });
});
