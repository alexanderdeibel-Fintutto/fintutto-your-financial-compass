import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useCompany } from '@/contexts/CompanyContext';
import { useSmartNotifications } from '@/hooks/useSmartNotifications';

interface NotificationContextType {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { companies, businessCompanies, loading: companiesLoading } = useCompany();
  const { addNotification, notifications } = useNotifications();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [welcomeSent, setWelcomeSent] = useState(false);

  // Check if onboarding should be shown - only when companies have finished loading
  // Onboarding now guides to creating a business company (personal is auto-created)
  useEffect(() => {
    if (!user || companiesLoading) return;
    
    const completed = localStorage.getItem('onboarding_completed');
    
    if (businessCompanies.length > 0) {
      // User already has business companies, mark onboarding as done
      if (!completed) {
        localStorage.setItem('onboarding_completed', 'true');
      }
      setShowOnboarding(false);
    } else if (!completed) {
      // No business companies yet — show onboarding to create one
      setShowOnboarding(true);
    }
  }, [user, businessCompanies, companiesLoading]);

  // Smart notifications engine – checks real data for actionable alerts
  useSmartNotifications();

  // Send welcome notification on very first login
  useEffect(() => {
    if (user && !welcomeSent && notifications.length === 0) {
      const hasSeenWelcome = localStorage.getItem(`welcome_sent_${user.id}`);
      if (!hasSeenWelcome) {
        setTimeout(() => {
          addNotification({
            type: 'success',
            title: 'Willkommen bei Financial Compass!',
            message: 'Ihr intelligentes Finanzcockpit ist bereit. Alle Daten werden in Echtzeit analysiert.',
          });
        }, 1500);
        localStorage.setItem(`welcome_sent_${user.id}`, 'true');
        setWelcomeSent(true);
      }
    }
  }, [user, welcomeSent, notifications.length, addNotification]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    window.location.reload();
  };

  return (
    <NotificationContext.Provider value={{ showOnboarding, setShowOnboarding }}>
      {children}
      <OnboardingWizard open={showOnboarding} onComplete={handleOnboardingComplete} />
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
