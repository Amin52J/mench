import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  readonly children: ReactNode;
}

export function Panel({ children, className, ...rest }: PanelProps) {
  const classes = [styles.panel, className].filter(Boolean).join(' ');
  return (
    <section className={classes} {...rest}>
      {children}
    </section>
  );
}
