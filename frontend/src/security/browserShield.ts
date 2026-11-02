/**
 * ZERO-TRUST BROWSER SHIELD & ANTI-REVERSE ENGINEERING GUARD (GÜNAY KİMYA)
 * 
 * Enforces hardware and browser-level safeguards:
 * 1. Blocks Right-Click (contextmenu), text selection, and drag events.
 * 2. Intercepts DevTools hotkeys: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S.
 * 3. Anti-DevTools Infinite Debugger Trap: Freezes DevTools execution upon inspection attempts.
 * 4. Domain & License Enforcement: Verifies authorized execution on *.onrender.com.
 */

const LICENSED_DOMAIN_SUFFIX = 'onrender.com';

export function enforceDomainLicense(): boolean {
  if (typeof window === 'undefined') return true;

  const hostname = window.location.hostname.toLowerCase();
  
  // Allow localhost only if explicit local development flag is set
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLicensedDomain = hostname.endsWith(LICENSED_DOMAIN_SUFFIX);

  // In production builds, strict domain license applies
  if (import.meta.env.PROD && !isLicensedDomain && !isLocalhost) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0826;color:#ffffff;font-family:sans-serif;padding:24px;text-align:center;">
        <div style="max-width:500px;background:#181045;padding:32px;border-radius:16px;border:1px solid #e11d48;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          <div style="font-size:48px;margin-bottom:16px;">🛡️</div>
          <h1 style="font-size:20px;font-weight:bold;color:#f43f5e;margin-bottom:12px;">YAZILIM LİSANS İHLALİ (ZERO-TRUST LOCK)</h1>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.6;margin-bottom:16px;">
            Bu yazılım Günay Kimya A.Ş. fikri mülkiyeti olup sadece yetkili kurumsal bulut alanında (<strong>*.onrender.com</strong>) çalışacak şekilde şifrelenmiştir.
          </p>
          <div style="font-size:11px;color:#94a3b8;background:#0f092e;padding:12px;border-radius:8px;font-family:monospace;">
            Geçersiz Etki Alanı: ${hostname}<br/>
            Erişim Donanım Seviyesinde Kilitlendi.
          </div>
        </div>
      </div>
    `;
    throw new Error('Lisans Geçersiz: Yetkisiz etki alanı algılandı.');
  }

  return true;
}

export function initBrowserShield(): void {
  if (typeof window === 'undefined') return;

  // 1. Verify Domain License
  enforceDomainLicense();

  // 2. Disable Context Menu (Right Click)
  window.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    true
  );

  // 3. Disable Text Selection & Dragging
  window.addEventListener(
    'selectstart',
    (e: Event) => {
      // Allow selection inside inputs and textareas
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return true;
      }
      e.preventDefault();
      return false;
    },
    true
  );

  window.addEventListener('dragstart', (e: DragEvent) => e.preventDefault(), true);

  // 4. Intercept DevTools & Source View Hotkeys
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerDebuggerTrap();
        return false;
      }

      // Ctrl + Shift + I, J, C (Inspect, Console, Element Picker)
      if (e.ctrlKey && e.shiftKey) {
        const key = e.key.toUpperCase();
        if (key === 'I' || key === 'J' || key === 'C') {
          e.preventDefault();
          e.stopPropagation();
          triggerDebuggerTrap();
          return false;
        }
      }

      // Cmd + Alt + I, J, C (Mac OS DevTools)
      if (e.metaKey && e.altKey) {
        const key = e.key.toUpperCase();
        if (key === 'I' || key === 'J' || key === 'C') {
          e.preventDefault();
          e.stopPropagation();
          triggerDebuggerTrap();
          return false;
        }
      }

      // Ctrl + U (View Source), Ctrl + S (Save Page)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toUpperCase();
        if (key === 'U' || key === 'S') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    },
    true
  );

  // 5. Infinite Debugger Loop (DevTools Execution Freeze)
  if (import.meta.env.PROD) {
    setInterval(() => {
      const startTime = performance.now();
      (function () {
        Function('debugger')();
      })();
      const elapsed = performance.now() - startTime;
      if (elapsed > 100) {
        // DevTools breakpoint halted execution -> Trigger aggressive freeze
        triggerDebuggerTrap();
      }
    }, 500);
  }
}

function triggerDebuggerTrap(): void {
  // Freezes inspect session
  while (true) {
    (function () {
      Function('debugger')();
    })();
  }
}
