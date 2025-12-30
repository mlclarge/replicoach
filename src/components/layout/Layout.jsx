import { Outlet } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'

function Layout() {
  return (
    <div className="min-h-screen bg-darker flex flex-col">
      <Header />
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default Layout
