function Card({ children, className = '', onClick, ...props }) {
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      className={`card ${onClick ? 'cursor-pointer text-left w-full' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  )
}

function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`font-semibold text-white ${className}`}>
      {children}
    </h3>
  )
}

function CardDescription({ children, className = '' }) {
  return (
    <p className={`text-sm text-gray-400 mt-1 ${className}`}>
      {children}
    </p>
  )
}

Card.Title = CardTitle
Card.Description = CardDescription

export default Card
