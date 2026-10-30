import { useState, useEffect } from 'react';

const queries = {
  mobile: '(max-width: 480px)',
  tablet: '(min-width: 481px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)'
};

function useResponsive() {
  const [screen, setScreen] = useState(() => ({
    isMobile: window.innerWidth <= 480,
    isTablet: window.innerWidth > 480 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024
  }));

  useEffect(() => {
    const mqls = {};
    const listeners = {};

    for (const [key, query] of Object.entries(queries)) {
      mqls[key] = window.matchMedia(query);
      listeners[key] = (e) => {
        if (e.matches || key === 'mobile') {
          setScreen({
            isMobile: mqls.mobile.matches,
            isTablet: mqls.tablet.matches,
            isDesktop: mqls.desktop.matches
          });
        }
      };
      mqls[key].addEventListener('change', listeners[key]);
    }

    return () => {
      for (const key of Object.keys(queries)) {
        mqls[key].removeEventListener('change', listeners[key]);
      }
    };
  }, []);

  return screen;
}

export default useResponsive;
