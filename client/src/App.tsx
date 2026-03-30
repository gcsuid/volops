import { useState, useEffect } from 'react';
import { SignInPage, type UserRole } from '@/components/ui/sign-in';
import { SignUpForm, SignUpSuccess } from '@/components/ui/sign-up';
import { api } from '@/api';

type View = 'signin' | 'signup' | 'success';

function App() {
  const [view, setView] = useState<View>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('volunteer');
  const [signupData, setSignupData] = useState<{ userId: string; role: UserRole } | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('vo_token');
    const savedRole = localStorage.getItem('vo_role') as UserRole;
    if (savedToken && savedRole) {
      window.location.href = getDashboardPath(savedRole);
    }
  }, []);

  const getDashboardPath = (role: UserRole) => {
    switch (role) {
      case 'volunteer':
        return '/volunteer.html';
      case 'manager':
        return '/manager.html';
      case 'organization':
        return '/org-dashboard.html';
    }
  };

  const handleSignIn = async (data: { email: string; password: string; role: UserRole }) => {
    setError('');
    setLoading(true);

    try {
      if (data.role === 'volunteer') {
        const result = await api.volunteer.login({ vol_id: data.email, password: data.password });
        localStorage.setItem('vo_token', result.token);
        localStorage.setItem('vo_role', data.role);
        localStorage.setItem('vo_name', result.name);
        localStorage.setItem('vo_vol_id', result.vol_id);
        window.location.href = getDashboardPath(data.role);
      } else if (data.role === 'manager') {
        const result = await api.manager.login({ mgr_id: data.email, password: data.password });
        localStorage.setItem('vo_token', result.token);
        localStorage.setItem('vo_role', data.role);
        localStorage.setItem('vo_name', result.name);
        localStorage.setItem('vo_mgr_id', result.mgr_id);
        window.location.href = getDashboardPath(data.role);
      } else {
        const result = await api.organization.login({ org_id: data.email, email: data.email });
        localStorage.setItem('vo_token', result.token);
        localStorage.setItem('vo_role', data.role);
        localStorage.setItem('vo_name', result.name);
        localStorage.setItem('vo_org_id', result.org_id);
        window.location.href = getDashboardPath(data.role);
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
        setSignupData({ userId: result.vol_id, role: selectedRole });
      } else if (selectedRole === 'manager') {
        const result = await api.manager.signup({
          name: data.name,
          email: data.email,
          org_id: data.org_id,
        });
        setSignupData({ userId: result.mgr_id, role: selectedRole });
      } else {
        const result = await api.organization.signup({
          name: data.name,
          email: data.email,
          location: data.location,
          password: data.password,
        });
        setSignupData({ userId: result.org_id, role: selectedRole });
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
      window.location.href = getDashboardPath(signupData.role);
    }
  };

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
