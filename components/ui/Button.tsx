"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--accent)] hover:opacity-90 active:translate-y-[1px]",
  secondary:
    "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-[var(--text-primary)]",
  outline:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-4 border-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-[11px] tracking-wider",
  md: "px-5 py-2 text-[13px] tracking-wider",
  lg: "px-6 py-3 text-[15px] tracking-widest",
};

/**
 * Editorial press button for Ballot.
 * Crisp edges, small-caps, high-contrast type.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2",
          "font-sans font-semibold uppercase select-none transition-all cursor-pointer",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0",
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <>
            <span
              className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
