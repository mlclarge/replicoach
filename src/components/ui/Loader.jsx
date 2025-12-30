function Loader({ size = 'md', text = 'Chargement...' }) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4'
  }
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div 
        className={`${sizes[size]} border-primary-700 border-t-gold-500 
                    rounded-full animate-spin`} 
      />
      {text && (
        <span className="text-gray-400 text-sm">{text}</span>
      )}
    </div>
  )
}

export default Loader
