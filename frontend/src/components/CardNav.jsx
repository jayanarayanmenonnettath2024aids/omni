import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { ArrowUpRight, Search, Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import './CardNav.css';

const CardNav = ({
  logo,
  logoText = 'OMNI',
  logoAlt = 'Logo',
  showLogo = true,
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#ffffff',
  menuColor = '#0f172a',
  textColor = '#0f172a',
  userRole,
  currentUser,
  onLogout
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format the user role for display
  const getRoleDisplay = (role) => {
    switch(role?.toLowerCase()) {
      case 'super': return 'Trade Admin';
      case 'export': return 'Export Manager';
      case 'import': return 'Import Controller';
      case 'domestic': return 'Domestic Fleets';
      default: return 'Data Manager';
    }
  };

  const roleName = getRoleDisplay(userRole);
  const userName = String(
    currentUser?.display_name || currentUser?.name || currentUser?.email || roleName || 'User'
  ).trim();
  const userEmail = String(currentUser?.email || '').trim();
  const sessionMode = currentUser?.auth_mode === 'signup' ? 'New Session' : 'Active Session';
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content');
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';

        /* trigger reflow */
        // eslint-disable-next-line no-unused-expressions
        contentEl.offsetHeight;

        const topBar = 64; // SaaS Height
        const padding = 24;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return window.matchMedia('(max-width: 1024px)').matches ? 350 : 400; // default height for expanded area
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 64, overflow: 'visible' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.5,
      ease
    });

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.1 }, '-=0.2');

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const setCardRef = i => el => {
    if (el) cardsRef.current[i] = el;
  };

  const collapseMenu = () => {
    setIsExpanded(false);
    setIsHamburgerOpen(false);
    const tl = tlRef.current;
    if (tl) {
      tl.pause(0);
    }
    if (navRef.current) {
      gsap.set(navRef.current, { height: 64, overflow: 'visible' });
    }
  };

  const toggleMenu = () => {
    const tl = tlRef.current;

    if (!tl) {
      setIsExpanded((prev) => !prev);
      setIsHamburgerOpen((prev) => !prev);
      return;
    }

    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
      return;
    }

    setIsHamburgerOpen(false);
    tl.eventCallback('onReverseComplete', () => {
      setIsExpanded(false);
    });

    // Timeline can be recreated at progress 0 on parent re-renders.
    if (tl.progress() === 0) {
      collapseMenu();
      return;
    }

    tl.reverse();
  };

  const handleLogout = () => {
    setIsDropdownOpen(false);
    collapseMenu();
    onLogout?.();
  };

  const handleNavLinkClick = (event, callback) => {
    callback?.(event);
    setIsDropdownOpen(false);
    collapseMenu();
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav ref={navRef} className={`card-nav ${isExpanded ? 'open' : ''}`} style={{ backgroundColor: baseColor }}>
        <div className="card-nav-top">
          
          <div className="logo-container flex items-center gap-3">
             <div
                className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
                onClick={toggleMenu}
                role="button"
                aria-label={isExpanded ? 'Close menu' : 'Open menu'}
                tabIndex={0}
                style={{ color: isExpanded ? '#ffffff' : (menuColor || '#000') }}
              >
                <div className="hamburger-line" />
                <div className="hamburger-line" />
              </div>
            {showLogo && (
              logo ? (
                <img src={logo} alt={logoAlt} className="logo w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/20">T</div>
              )
            )}
            <span className="logo-text text-xl md:text-2xl font-black tracking-tight" style={{ color: isExpanded ? '#ffffff' : textColor }}>{logoText}</span>
          </div>

          <div className="flex items-center gap-6 z-50">
            {/* Search Bar */}
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search shipments, invoices, clients..." 
                className="pl-10 pr-4 py-2 w-48 md:w-64 lg:w-80 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-full text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                style={{ color: '#000' }}
              />
            </div>
            
            {/* Notification Bell */}
            <button className="relative p-2 rounded-full hover:bg-gray-100/50 transition-colors group flex items-center justify-center" style={{ color: isExpanded ? '#ffffff' : menuColor }}>
              <Bell size={20} className="transition-colors" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white ring-1 ring-red-500/50"></span>
            </button>

            {/* Trade Admin Status Box */}
            <div className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-[11px] font-bold tracking-wide shadow-sm flex-shrink-0 hidden md:block">
              {roleName}
            </div>

            {/* User Profile Section */}
            <div className="relative flex-shrink-0" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 p-1 pr-2 rounded-full hover:bg-gray-100/20 transition-colors border border-transparent focus:outline-none focus:border-gray-200/50"
              >
                <div className="w-9 h-9 rounded-full bg-[#0b1731] text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white/50">
                  {userInitials}
                </div>
                <div className="hidden md:flex flex-col items-start pr-1" style={{ color: isExpanded ? '#ffffff' : textColor }}>
                  <span className="text-sm font-bold leading-tight">{userName}</span>
                  <span className="text-xs opacity-70 font-medium">{roleName}</span>
                </div>
                <ChevronDown size={14} className="hidden md:block transition-colors" style={{ color: isExpanded ? '#ffffff' : menuColor }} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 origin-top-right z-50 overflow-hidden">
                  <div className="px-4 py-4 border-b border-gray-100 bg-slate-50/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0b1731] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {userInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{userName}</div>
                        <div className="text-xs font-medium text-slate-500 truncate">{userEmail || 'No email provided'}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">{roleName}</span>
                      <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{sessionMode}</span>
                    </div>
                  </div>
                  <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <User size={16} className="text-gray-400" />
                    <span className="font-medium">{userName}</span>
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Settings size={16} className="text-gray-400" />
                    <span className="font-medium">Current desk: {roleName}</span>
                  </button>
                  <div className="h-px bg-gray-100 my-1.5 mx-2"></div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors group">
                    <LogOut size={16} className="text-red-400 group-hover:text-red-600" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 4).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {item.links?.map((lnk, i) => (
                  <a key={`${lnk.label}-${i}`} className="nav-card-link" href={lnk.href} aria-label={lnk.ariaLabel} onClick={(event) => handleNavLinkClick(event, lnk.onClick)}>
                    {lnk.label}
                    <ArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;
