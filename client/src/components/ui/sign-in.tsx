import React, { useState } from 'react';
import { Eye, EyeOff, ChevronRight, User, Building2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UserRole = 'volunteer' | 'manager' | 'organization';

export interface SignInPageProps {
  onSignIn?: (data: { email: string; password: string; role: UserRole }) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: (role: UserRole) => void;
  heroImageSrc?: string;
}

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-border/50 bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

const RoleCard = ({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  role: UserRole;
  icon: React.ElementType;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
      selected
        ? 'border-violet-500 bg-violet-500/10'
        : 'border-border/50 hover:border-violet-400/50 hover:bg-violet-500/5'
    )}
  >
    <div className={cn(
      'rounded-full p-3 transition-colors',
      selected ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'
    )}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="text-center">
      <p className={cn(
        'font-medium transition-colors',
        selected ? 'text-violet-400' : 'text-foreground'
      )}>
        {title}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  </button>
);

export const SignInPage: React.FC<SignInPageProps> = ({
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  heroImageSrc,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('volunteer');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn?.({ email, password, role: selectedRole });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row font-sans">
      <section className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight">
              Welcome to <span className="text-violet-500">VolOps</span>
            </h1>
            <p className="text-muted-foreground">
              Volunteer Operations Platform - Select your role to continue
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <RoleCard
              role="volunteer"
              icon={User}
              title="Volunteer"
              description="Join drives"
              selected={selectedRole === 'volunteer'}
              onClick={() => setSelectedRole('volunteer')}
            />
            <RoleCard
              role="manager"
              icon={Users}
              title="Manager"
              description="Organize drives"
              selected={selectedRole === 'manager'}
              onClick={() => setSelectedRole('manager')}
            />
            <RoleCard
              role="organization"
              icon={Building2}
              title="Organisation"
              description="Manage org"
              selected={selectedRole === 'organization'}
              onClick={() => setSelectedRole('organization')}
            />
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <GlassInputWrapper>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full bg-transparent text-sm p-4 rounded-xl focus:outline-none"
                  required
                />
              </GlassInputWrapper>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <GlassInputWrapper>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-sm p-4 pr-12 rounded-xl focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </GlassInputWrapper>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-muted" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <button
                type="button"
                onClick={onResetPassword}
                className="text-violet-400 hover:underline"
              >
                Reset password
              </button>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-4 font-medium text-white hover:bg-violet-600 transition-colors"
            >
              Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <span className="w-full border-t border-border" />
            <span className="absolute bg-background px-4 text-sm text-muted-foreground">Or continue with</span>
          </div>

          <button
            type="button"
            onClick={onGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-4 hover:bg-muted transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="text-center text-sm text-muted-foreground">
            New to VolOps?{' '}
            <button
              type="button"
              onClick={() => onCreateAccount?.(selectedRole)}
              className="text-violet-400 hover:underline"
            >
              Create Account
            </button>
          </p>
        </div>
      </section>

      {heroImageSrc && (
        <section className="hidden lg:block lg:w-1/2 relative p-4">
          <div
            className="absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
        </section>
      )}
    </div>
  );
};
