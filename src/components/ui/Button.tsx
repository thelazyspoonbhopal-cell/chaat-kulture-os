import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-950/20 active:bg-orange-700',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 active:bg-slate-900',
    outline: 'bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-900',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white active:bg-rose-700',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white active:bg-emerald-700',
    ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white',
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg font-medium',
    md: 'text-sm px-4 py-2 rounded-xl font-semibold',
    lg: 'text-base px-5 py-2.5 rounded-xl font-bold',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
