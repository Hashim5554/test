import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';
import { 
  Home, 
  Bell, 
  BookOpen, 
  Library, 
  Settings, 
  Users,
  LogOut,
  Menu,
  X,
  FileText,
  Palette,
  Calendar,
  Sun,
  Moon,
  Clock,
  CalendarDays,
  GraduationCap,
  BookMarked,
  NotebookPen,
  Users2
} from 'lucide-react';
import { getUnreadNotificationCount, markNotificationsAsRead, fetchUnreadNotifications } from '../lib/notifications';
import type { Class } from '../types/index';

interface NotificationCounts {
  announcements: number;
  subjects: number;
  library: number;
  recordRoom: number;
  clubs: number;
  timetable: number;
}

type NotificationType = 'announcement' | 'subject' | 'library' | 'record' | 'club' | 'timetable';

const notificationTypes: Record<keyof NotificationCounts, NotificationType> = {
  announcements: 'announcement',
  subjects: 'subject',
  library: 'library',
  recordRoom: 'record',
  clubs: 'club',
  timetable: 'timetable'
};

export function Layout() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationCounts>({
    announcements: 0,
    subjects: 0,
    library: 0,
    recordRoom: 0,
    clubs: 0,
    timetable: 0
  });
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<Array<{ id: string; message: string; created_at: string }>>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [sidebarPages, setSidebarPages] = useState<Array<{ id: string; page_id: string; title: string; order_index: number }>>([]);

  const isAdmin = user && (user.role === 'admin' || user.role === 'ultra_admin');

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Load notifications and classes
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadClasses();
    }
  }, [user]);

  // Update current class when selectedClassId changes
  useEffect(() => {
    if (selectedClassId) {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      setCurrentClass(selectedClass || null);
    } else {
      setCurrentClass(null);
    }
  }, [selectedClassId, classes]);

  // Load sidebar pages when current class changes
  useEffect(() => {
    if (currentClass) {
      loadSidebarPages();
    } else {
      setSidebarPages([]);
    }
  }, [currentClass]);

  const loadSidebarPages = async () => {
    if (!currentClass) {
      setSidebarPages([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('sidebar_pages')
        .select('*')
        .eq('class_id', currentClass.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setSidebarPages(data || []);
    } catch (error) {
      console.error('Error loading sidebar pages:', error);
    }
  };

  // Subscribe to real-time notification changes using Supabase channel API
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          loadNotifications();
          loadNotificationItems();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Load notification items (dropdown content)
  const loadNotificationItems = async () => {
    if (!user) return;
    try {
      const items = await fetchUnreadNotifications(user.id);
      setNotificationItems(items);
    } catch (error) {
      console.error('Error loading notification items:', error);
    }
  };

  // Toggle notification dropdown
  const toggleNotificationDropdown = () => {
    setIsNotificationDropdownOpen(!isNotificationDropdownOpen);
    if (!isNotificationDropdownOpen) {
      loadNotificationItems();
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }
    loadNotificationItems();
    loadNotifications();
  };

  const loadNotifications = async () => {
    try {
      const notificationPromises = Object.entries(notificationTypes).map(
        async ([key, type]) => {
          const count = await getUnreadNotificationCount(type);
          return [key, count] as [keyof NotificationCounts, number];
        }
      );

      const results = await Promise.all(notificationPromises);
      const newNotifications = Object.fromEntries(results) as unknown as NotificationCounts;
      setNotifications(newNotifications);
    } catch (error) {
      setNotificationError('Failed to load notifications');
      console.error('Error loading notifications:', error);
    }
  };

  const loadClasses = async () => {
    if (!user) return;
    
    try {
      const { data: classData, error } = await supabase
        .from('classes')
        .select('*');

      if (error) throw error;
      if (!classData || classData.length === 0) {
        console.warn("No classes found in database");
        return;
      }

      console.log("Classes loaded:", classData.length);
      setClasses(classData);
      
      // Get the stored class ID
      const storedClassId = localStorage.getItem('selectedClassId');
      console.log("Stored class ID:", storedClassId);
      
      if (storedClassId) {
        const classExists = classData.some(c => c.id === storedClassId);
        console.log("Class exists:", classExists);
        
        if (classExists) {
          console.log("Setting selected class ID:", storedClassId);
          setSelectedClassId(storedClassId);
          
          // Navigate to home if we're on the select page
          if (location.pathname === '/select-class') {
            console.log("Navigating to home from select page");
            navigate('/');
          }
        } else {
          console.warn("Stored class ID not found in available classes");
          // Class ID not found, clear it
          localStorage.removeItem('selectedClassId');
        }
      } else {
        console.log("No stored class ID found");
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const handleClassChange = async (classId: string) => {
    try {
      setSelectedClassId(classId);
      localStorage.setItem('selectedClassId', classId);
      navigate('/');
    } catch (error) {
      console.error('Error changing class:', error);
    }
  };

  const handleNotificationClick = async (key: keyof NotificationCounts) => {
    try {
      const type = notificationTypes[key];
      await markNotificationsAsRead(type);
      setNotifications(prev => ({ ...prev, [key]: 0 }));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const NavLink = ({ to, icon: Icon, label, notificationCount = 0 }: { 
    to: string; 
    icon: React.ElementType; 
    label: string;
    notificationCount?: number;
  }) => (
    <Link
      to={to}
      className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
        isActive(to)
          ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
          : 'text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400'
      }`}
    >
      <Icon className={`h-5 w-5 mr-3 transition-transform duration-200 group-hover:scale-110 ${
        isActive(to) ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400'
      }`} />
      <span className="flex-1">{label}</span>
      {notificationCount > 0 && (
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full animate-pulse">
          {notificationCount}
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-200 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo and Title */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/lgs-logo.png" alt="LGS JTi Logo" className="h-9 w-auto mr-2 rounded-2xl object-center object-contain mb-[-4px]" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">LGS JTi</span>
            </Link>
            <ThemeToggle />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <NavLink to="/" icon={Home} label="Home" />
            <NavLink 
              to="/announcements" 
              icon={Bell} 
              label="Announcements" 
              notificationCount={notifications.announcements} 
            />
            <NavLink 
              to="/subjects" 
              icon={BookOpen} 
              label="Subjects" 
              notificationCount={notifications.subjects} 
            />
            <NavLink 
              to="/library" 
              icon={Library} 
              label="Library" 
              notificationCount={notifications.library} 
            />
            <NavLink 
              to="/record-room" 
              icon={FileText} 
              label="Record Room" 
              notificationCount={notifications.recordRoom} 
            />
            <NavLink 
              to="/afternoon-clubs" 
              icon={Users} 
              label="Clubs" 
              notificationCount={notifications.clubs} 
            />
            {isAdmin && (
              <NavLink to="/users" icon={Users} label="Users" />
            )}
            {isAdmin && (
            <NavLink to="/customize" icon={Palette} label="Customize" />
            )}

            {/* Sidebar Pages */}
            {sidebarPages.length > 0 && (
              <>
                <div className="pt-4 pb-2">
                  <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Custom Pages
                  </div>
                </div>
                {sidebarPages.map((sidebarPage) => (
                  <Link
                    key={sidebarPage.id}
                    to={`/custom-page/${sidebarPage.page_id}`}
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive(`/custom-page/${sidebarPage.page_id}`)
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400'
                    }`}
                  >
                    <FileText className={`h-5 w-5 mr-3 transition-transform duration-200 group-hover:scale-110 ${
                      isActive(`/custom-page/${sidebarPage.page_id}`) ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400'
                    }`} />
                    <span className="flex-1 truncate">{sidebarPage.title}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* Class Selector - Always show for all users */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/select-class"
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <GraduationCap className="h-5 w-5 mr-2" />
              <span>Change Class</span>
            </Link>
          </div>

          {/* User Info, Timetable, and Logout */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Timetable Button */}
            <a
              href="https://lgs254f1.edupage.org/timetable/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <CalendarDays className="h-5 w-5 mr-2" />
              <span>Timetable</span>
            </a>

            {/* User Info and Logout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-semibold text-sm overflow-hidden">
                  {user?.photo_url ? (
                    <img
                      src={user.photo_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Image'; }}
                    />
                  ) : (
                    user?.username?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.username || 'Ultra Admin'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role === 'ultra_admin' ? 'Ultra Admin' : user?.role || 'Ultra Admin'}
                  </p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={toggleNotificationDropdown}
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                >
                  <Bell className="h-5 w-5" />
                  {totalUnread > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                      {totalUnread}
                    </span>
                  )}
                </button>
                {isNotificationDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
                        <button
                          onClick={() => {
                            notificationItems.forEach(item => markNotificationAsRead(item.id));
                            setNotificationItems([]);
                          }}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          Mark all as read
                        </button>
                      </div>
                      {notificationItems.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">No new notifications</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {notificationItems.map((item) => (
                            <li key={item.id} className="flex items-start p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                              <div className="flex-1">
                                <p className="text-sm text-gray-900 dark:text-white">{item.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                              </div>
                              <button
                                onClick={() => markNotificationAsRead(item.id)}
                                className="ml-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              >
                                Mark as read
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="p-6">
          <Outlet context={{ currentClass, selectedClassId, classes }} />
        </main>
      </div>
    </div>
  );
}