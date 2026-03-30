import { useState, useEffect } from 'react';
import { SignInPage, type UserRole } from '@/components/ui/sign-in';
import { SignUpForm, SignUpSuccess } from '@/components/ui/sign-up';
import { VolunteerDashboard } from '@/pages/VolunteerDashboard';
import { ManagerDashboard } from '@/pages/ManagerDashboard';
import { OrganizationDashboard } from '@/pages/OrganizationDashboard';
import { api } from '@/api';

type View = 'signin' | 'signup' | 'success';

function App() {
  const [view, setView] = useState<View>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('volunteer');
  const [signupData, setSignupData] = useState<{ userId: string; role: UserRole } | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<UserRole | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('vo_token');
    const savedRole = localStorage.getItem('vo_role') as UserRole;
    if (savedToken && savedRole) {
      setDashboard(savedRole);
    }
  }, []);

  const handleSignIn = async (data: { email: string; password: string; role: UserRole }) => {
    setError('');
    setLoading(true);

    try {
      if (data.role === 'volunteer') {
        const result = await api.volunteer.login(data.email);
        localStorage.setItem('vo_token', result.token);
        localStorage.setItem('vo_role', 'volunteer');
        localStorage.setItem('vo_name', result.name);
        localStorage.setItem('vo_vol_id', result.vol_id);
        setDashboard('volunteer');
      } else if (data.role === 'manager') {
        const orgId = prompt('Enter your Organisation ID (ORG-XXXXXX):');
        if (!orgId) return;
        const result = await api.manager.login(data.email, orgId.toUpperCase());
        localStorage.setItem('vo_token', result.token);
        localStorage.setItem('vo_role', 'manager');
        localStorage.setItem('vo_name', result.name);
        localStorage.setItem('vo_mgr_id', result.mgr_id);
        setDashboard('manager');
      } else {
        const orgId = prompt('Enter your Organisation ID (ORG-XXXXXX):');
        if (!orgId) return;
        const result = await api.organization.login(orgId.toUpperCase(), data.email);
        localStorage.setItem('vo_token', result.token);
        localStorage.setItem('vo_role', 'organization');
        localStorage.setItem('vo_name', result.name);
        localStorage.setItem('vo_org_id', result.org_id);
        setDashboard('organization');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    alert('Google Sign In - Coming Soon');
  };

  const handleResetPassword = () => {
    alert('Reset Password - Coming Soon');
  };

  const handleCreateAccount = (role: UserRole) => {
    setSelectedRole(role);
    setView('signup');
    setError('');
  };

  const handleSignup = async (data: Record<string, string>) => {
    setError('');
    setLoading(true);

    try {
      if (selectedRole === 'volunteer') {
        const result = await api.volunteer.signup({
          name: data.name,
          email: data.email,
          age: data.age,
          gender: data.gender,
          password: data.password,
        });
        setSignupData({ userId: result.vol_id, role: 'volunteer' });
      } else if (selectedRole === 'manager') {
        const result = await api.manager.signup({
          name: data.name,
          email: data.email,
          org_id: data.org_id,
          password: data.password,
        });
        setSignupData({ userId: result.mgr_id, role: 'manager' });
      } else {
        const result = await api.organization.signup({
          name: data.name,
          email: data.email,
          location: data.location,
          password: data.password,
        });
        setSignupData({ userId: result.org_id, role: 'organization' });
      }
      setView('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setView('signin');
    setError('');
  };

  const handleContinue = () => {
    if (signupData) {
      localStorage.setItem('vo_token', signupData.userId);
      localStorage.setItem('vo_role', signupData.role);
      setDashboard(signupData.role);
    }
  };

  if (dashboard === 'volunteer') {
    return <VolunteerDashboard />;
  }

  if (dashboard === 'manager') {
    return <ManagerDashboard />;
  }

  if (dashboard === 'organization') {
    return <OrganizationDashboard />;
  }

  if (view === 'signup') {
    return (
      <SignUpForm
        role={selectedRole}
        onSubmit={handleSignup}
        onBack={handleBack}
        error={error}
        loading={loading}
      />
    );
  }

  if (view === 'success' && signupData) {
    return (
      <SignUpSuccess
        role={signupData.role}
        userId={signupData.userId}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <SignInPage
      onSignIn={handleSignIn}
      onGoogleSignIn={handleGoogleSignIn}
      onResetPassword={handleResetPassword}
      onCreateAccount={handleCreateAccount}
      heroImageSrc="https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=2160&q=80"
    />
  );
}

export default App;
