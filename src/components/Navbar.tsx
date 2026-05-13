import { Link } from 'react-router-dom';
import { User } from 'firebase/auth';
import { Button, buttonVariants } from '@/components/ui/button';
import { LayoutDashboard, Wallet, User as UserIcon, LogOut, ShieldCheck, Settings } from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavbarProps {
  user: User | null;
  role: 'creator' | 'admin' | null;
}

export default function Navbar({ user, role }: NavbarProps) {
  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-xl transform group-hover:rotate-12 transition-transform shadow-lg shadow-orange-200">
            M
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-slate-900">
            Gated<span className="text-primary">Meet</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "relative h-8 w-8 rounded-full" })}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                    <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="px-2 py-1.5 text-sm font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="flex flex-col">
                    {role === 'admin' && (
                      <DropdownMenuItem>
                        <Link to="/admin" className="w-full cursor-pointer flex items-center">
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          <span>Admin</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <Link to="/dashboard" className="w-full cursor-pointer flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link to="/dashboard/profile" className="w-full cursor-pointer flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Profile Settings</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => auth.signOut()} className="cursor-pointer text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/auth" className={buttonVariants({ variant: "ghost" })}>Sign In</Link>
              <Link to="/auth" className={buttonVariants({ className: "font-semibold shadow-lg shadow-orange-100 hover:shadow-orange-200" })}>Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
