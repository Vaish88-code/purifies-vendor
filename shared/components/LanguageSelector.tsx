import { useEffect } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import { useAuth, Language } from '@shared/contexts/AuthContext';

const languages: { code: Language | 'es' | 'te'; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useAuth();
  const currentLang = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    // Inject Google Translate script dynamically if not present
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);

      // Add the init function
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'en', autoDisplay: false },
          'google_translate_element'
        );
      };
    }
  }, []);

  const handleLanguageChange = (langCode: string) => {
    // set language in context (saves to storage/firebase)
    setLanguage(langCode as Language);
    
    // Set Google Translate cookies
    const cookieString = `/en/${langCode}`;
    document.cookie = `googtrans=${cookieString}; path=/; domain=${window.location.hostname}`;
    document.cookie = `googtrans=${cookieString}; path=/`;
    
    // Reload to apply translation via Google widget
    window.location.reload();
  };

  return (
    <>
      <div id="google_translate_element" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{currentLang.nativeName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={language === lang.code ? 'bg-accent' : ''}
            >
              <span className="mr-2">{lang.nativeName}</span>
              <span className="text-muted-foreground text-sm">({lang.name})</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// Add TypeScript support for the google window object
declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: any;
  }
}
