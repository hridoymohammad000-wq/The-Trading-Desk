import React from 'react';
import { 
  LayoutDashboard, 
  Database, 
  TrendingUp, 
  BarChart2, 
  Briefcase, 
  Coins, 
  History, 
  Settings,
  X,
  Lock,
  BookOpen
} from 'lucide-react';
import { ActiveModule } from '../types';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeModule, 
  setActiveModule, 
  isOpen, 
  onClose 
}) => {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, desc: 'Overview & Market Bias' },
    { id: 'data-engine', name: 'Data Engine', icon: Database, desc: 'DSE CSV/Manual Input' },
    { id: 'signal-board', name: 'Swing Signal Board', icon: TrendingUp, desc: 'A/B/C Grade Buy Setup' },
    { id: 'chart-lab', name: 'Chart Lab', icon: BarChart2, desc: 'EMA20/50 & Key Levels' },
    { id: 'portfolio', name: 'LankaBangla Portfolio', icon: Briefcase, desc: 'PDF holdings statement' },
    { id: 'paper-trading', name: 'Paper Trading', icon: Coins, desc: 'Risk simulator & orders' },
    { id: 'trading-journal', name: 'Trading Journal', icon: BookOpen, desc: 'Diary, reviews & lessons' },
    { id: 'signal-history', name: 'Signal History', icon: History, desc: 'Past trade setup records' },
    { id: 'settings', name: 'Settings', icon: Settings, desc: 'Risk, Capital & Presets' },
  ] as const;

  const handleNavClick = (moduleId: ActiveModule) => {
    setActiveModule(moduleId);
    onClose(); // Close mobile overlay
  };

  return (
    <>
      {/* Mobile Drawer Overlay Background */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        id="app-sidebar"
        className={`
          fixed md:sticky top-0 left-0 h-screen md:h-[calc(100vh-80px)] w-64 
          bg-[#151921] border-r border-slate-800 flex flex-col justify-between 
          transition-transform duration-300 z-50
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div>
          {/* Mobile Header Close Button */}
          <div className="flex items-center justify-between p-4 md:hidden border-b border-slate-850">
            <span className="text-sm font-bold font-display text-emerald-400">DSE SWING RADAR</span>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 hover:bg-[#1C222D] rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Stats / Environment indicator */}
          <div className="p-4">
            <div className="bg-[#1C222D] rounded-xl p-3.5 border border-slate-750/70 shadow-md">
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Engine Status</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 glow-pulse-green" />
                DSE V1 CORE READY
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]" id="sidebar-navigation">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    w-full flex items-start gap-3 px-4 py-2.5 rounded-lg text-left transition-all group border text-xs font-medium
                    ${isActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-950/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent'
                    }
                  `}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <div>
                    <div className="text-sm font-bold tracking-tight">{item.name}</div>
                    <div className="text-[10px] text-slate-500 group-hover:text-slate-400 font-sans">{item.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Storage usage layout panel from design */}
        <div className="px-4 py-2">
          <div className="p-3.5 bg-[#1C222D] rounded-xl border border-slate-750/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase text-slate-500 font-bold">Storage Usage</span>
              <span className="text-[10px] text-slate-300 font-bold font-mono">12%</span>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-1 w-[12%] bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-slate-800 bg-[#0F131A] text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-mono font-medium">
            <Lock className="h-3 w-3" /> Pipra-Ready V1
          </div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1 font-semibold">
            Dhaka Stock Exchange Support
          </div>
        </div>
      </aside>
    </>
  );
};
