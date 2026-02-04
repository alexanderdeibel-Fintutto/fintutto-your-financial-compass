import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  FolderOpen,
  Users,
  Building2,
  BarChart3,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Buchungen', url: '/buchungen', icon: Receipt },
  { title: 'Rechnungen', url: '/rechnungen', icon: FileText },
  { title: 'Belege', url: '/belege', icon: FolderOpen },
  { title: 'Kontakte', url: '/kontakte', icon: Users },
  { title: 'Bankkonten', url: '/bankkonten', icon: Building2 },
  { title: 'Berichte', url: '/berichte', icon: BarChart3 },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { companies, currentCompany, setCurrentCompany } = useCompany();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">F</span>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">Fintutto</h1>
            <p className="text-xs text-muted-foreground">Finanzbuchhaltung</p>
          </div>
        </div>

        {/* Company Selector */}
        {companies.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full mt-4 justify-between text-left h-auto py-3 px-3 bg-sidebar-accent hover:bg-sidebar-accent/80"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{currentCompany?.name || 'Firma wählen'}</span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setCurrentCompany(company)}
                  className={currentCompany?.id === company.id ? 'bg-accent' : ''}
                >
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className={`h-5 w-5 ${isActive(item.url) ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/20 text-primary">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
