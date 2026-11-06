/**
 * Trigger, label, panel and footer styling shared by the date and time pickers.
 * Components add their own `picker-*` class alongside their specific classes so
 * the two pickers keep one visual convention.
 */
export const pickerShellStyles = `
  .picker-trigger {
    width: 100%;
    min-height: 3.05rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
    border: 0;
    border-radius: 0.95rem;
    padding: 0.78rem 0.92rem;
    background: var(--surface-container-lowest);
    box-shadow: inset 0 0 0 1px var(--outline-variant);
    color: var(--on-surface);
    text-align: left;
    cursor: pointer;
    transition:
      box-shadow 0.15s ease,
      background 0.15s ease;
  }

  .picker-trigger:disabled {
    opacity: 0.66;
    cursor: not-allowed;
  }

  .picker-trigger:focus-visible {
    outline: 2px solid var(--primary-solid);
    outline-offset: 2px;
  }

  .picker-copy {
    min-width: 0;
    display: grid;
    gap: 0.14rem;
  }

  .picker-label {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.68rem;
    font-weight: 800;
    color: var(--on-surface-subtle);
  }

  .picker-value {
    min-width: 0;
    font-size: 0.96rem;
    font-weight: 700;
    color: var(--on-surface);
  }

  .picker-trigger fa-icon {
    color: var(--on-surface-subtle);
  }

  .picker-panel {
    width: min(20.75rem, calc(100vw - 2rem));
    border-radius: 1.15rem;
    background: var(--surface-container-lowest);
    box-shadow:
      0 24px 48px var(--surface-dim-strong),
      inset 0 0 0 1px var(--outline-variant);
    padding: 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
`;
