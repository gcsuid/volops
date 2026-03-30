import React, { useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from './sign-in';

interface SignUpFormProps {
  role: UserRole;
  onSubmit: (data: Record<string, string>) => void;
  onBack: () => void;
  error?: string;
  loading?: boolean;
}

const VolunteerForm = ({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) => (
  <div className="space-y-4">
    <div>
      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
      <input
        type="text"
        value={data.name || ''}
        onChange={(e) => setData({ ...data, name: e.target.value })}
        placeholder="e.g. Priya Sharma"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Email</label>
      <input
        type="email"
        value={data.email || ''}
        onChange={(e) => setData({ ...data, email: e.target.value })}
        placeholder="priya@example.com"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium text-muted-foreground">Age</label>
        <input
          type="number"
          value={data.age || ''}
          onChange={(e) => setData({ ...data, age: e.target.value })}
          placeholder="25"
          min="10"
          max="100"
          className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground">Gender</label>
        <select
          value={data.gender || ''}
          onChange={(e) => setData({ ...data, gender: e.target.value })}
          className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
          required
        >
          <option value="">Select</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
      </div>
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Password</label>
      <input
        type="password"
        value={data.password || ''}
        onChange={(e) => setData({ ...data, password: e.target.value })}
        placeholder="Create a password"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
  </div>
);

const ManagerForm = ({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) => (
  <div className="space-y-4">
    <div>
      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
      <input
        type="text"
        value={data.name || ''}
        onChange={(e) => setData({ ...data, name: e.target.value })}
        placeholder="e.g. Amit Patel"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Email</label>
      <input
        type="email"
        value={data.email || ''}
        onChange={(e) => setData({ ...data, email: e.target.value })}
        placeholder="amit@org.com"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Organisation ID</label>
      <input
        type="text"
        value={data.org_id || ''}
        onChange={(e) => setData({ ...data, org_id: e.target.value.toUpperCase() })}
        placeholder="ORG-XXXXXX"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
  </div>
);

const OrganizationForm = ({ data, setData }: { data: Record<string, string>; setData: (d: Record<string, string>) => void }) => (
  <div className="space-y-4">
    <div>
      <label className="text-sm font-medium text-muted-foreground">Organisation Name</label>
      <input
        type="text"
        value={data.name || ''}
        onChange={(e) => setData({ ...data, name: e.target.value })}
        placeholder="e.g. Green Earth Foundation"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Contact Email</label>
      <input
        type="email"
        value={data.email || ''}
        onChange={(e) => setData({ ...data, email: e.target.value })}
        placeholder="contact@greenearth.org"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Location</label>
      <input
        type="text"
        value={data.location || ''}
        onChange={(e) => setData({ ...data, location: e.target.value })}
        placeholder="e.g. Mumbai, Maharashtra"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
    <div>
      <label className="text-sm font-medium text-muted-foreground">Password</label>
      <input
        type="password"
        value={data.password || ''}
        onChange={(e) => setData({ ...data, password: e.target.value })}
        placeholder="Create a password"
        className="w-full mt-1 p-3 rounded-xl border border-border/50 bg-foreground/5 focus:border-violet-400 focus:outline-none"
        required
      />
    </div>
  </div>
);

export const SignUpForm: React.FC<SignUpFormProps> = ({ role, onSubmit, onBack, error, loading }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const roleTitle = role === 'volunteer' ? 'Volunteer' : role === 'manager' ? 'Site Manager' : 'Organisation';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">
            Create {roleTitle} Account
          </h1>
          <p className="text-muted-foreground">
            Fill in your details to get started
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to sign in
        </button>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {role === 'volunteer' && <VolunteerForm data={formData} setData={setFormData} />}
          {role === 'manager' && <ManagerForm data={formData} setData={setFormData} />}
          {role === 'organization' && <OrganizationForm data={formData} setData={setFormData} />}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-4 font-medium text-white hover:bg-violet-600 transition-colors',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'Creating Account...' : `Create ${roleTitle} Account`}
            {!loading && <ChevronRight className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};

interface SignUpSuccessProps {
  role: UserRole;
  userId: string;
  onContinue: () => void;
}

export const SignUpSuccess: React.FC<SignUpSuccessProps> = ({ role, userId, onContinue }) => {
  const roleTitle = role === 'volunteer' ? 'Volunteer' : role === 'manager' ? 'Site Manager' : 'Organisation';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Account Created!</h1>
          <p className="text-muted-foreground">
            Your {roleTitle.toLowerCase()} account has been created successfully.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <p className="text-sm text-muted-foreground mb-1">Your {roleTitle} ID</p>
          <p className="text-2xl font-mono font-bold text-violet-400">{userId}</p>
        </div>

        {role === 'manager' && (
          <p className="text-sm text-muted-foreground">
            Your password has been sent to your email. Use it to log in.
          </p>
        )}

        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500 py-4 font-medium text-white hover:bg-violet-600 transition-colors"
        >
          Continue to Dashboard
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
