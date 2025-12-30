const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  gold: 'btn-gold',
  danger: 'bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 active:scale-95',
  ghost: 'text-gray-400 hover:text-white hover:bg-gray-800 px-4 py-2 rounded-lg transition-all duration-200'
}

function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  loading = false,
  ...props 
}) {
  return (
    <button
      className={`
        ${variants[variant]} 
        ${className}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        inline-flex items-center justify-center gap-2
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}

export default Button
