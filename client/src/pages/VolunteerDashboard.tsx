import { useState, useEffect } from 'react';
import { Clock, LogOut, History, User } from 'lucide-react';
import { api } from '@/api';

export function VolunteerDashboard() {
  const [loading, setLoading] = useState(true);
  const [currentDrive, setCurrentDrive] = useState<{
    active: boolean;
    drive?: { id: string; name: string; location: string };
    checked_in_at?: string;
  } | null>(null);
  const [pastDrives, setPastDrives] = useState<Array<{
    id: string;
    name: string;
    location: string;
    status: string;
    duration_minutes: number;
  }>>([]);
  const [elapsed, setElapsed] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('vo_token');
  const volId = localStorage.getItem('vo_vol_id');
  const userName = localStorage.getItem('vo_name');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentDrive?.active && currentDrive.checked_in_at) {
      const interval = setInterval(() => {
        const start = new Date(currentDrive.checked_in_at!).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - start) / 1000 / 60));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentDrive]);

  const loadData = async () => {
    if (!token) return;
    try {
      const [current, drives] = await Promise.all([
        api.volunteer.currentDrive(token),
        api.volunteer.getDrives(token),
      ]);
      setCurrentDrive(current);
      setPastDrives(drives.filter(d => d.status === 'ended' || d.checked_out_at));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    const driveId = prompt('Enter Drive ID to check in:');
    if (!driveId) return;
    const secret = prompt('Enter QR Secret:');
    if (!secret) return;
    
    setActionLoading(true);
    try {
      const driveInfo = await api.drives.info(driveId);
      const confirmed = confirm(`Check in to "${driveInfo.name}" at ${driveInfo.location}?`);
      if (!confirmed) return;
      
      await api.drives.register(driveId, secret, volId!);
      await api.volunteer.checkin(token!, driveId);
      setMessage('Checked in successfully!');
      loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage(error.message || 'Failed to check in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!currentDrive?.drive) return;
    setActionLoading(true);
    try {
      const result = await api.volunteer.checkout(token!, currentDrive.drive.id);
      setMessage(`Checked out! Duration: ${result.duration_minutes} minutes`);
      loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage(error.message || 'Failed to check out');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold">{userName}</h1>
            <p className="text-sm text-muted-foreground">{volId}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-6">
        {message && (
          <div className="p-4 bg-violet-500/10 text-violet-500 rounded-xl text-sm">{message}</div>
        )}

        <section className="bg-card rounded-2xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Current Status</h2>
          
          {currentDrive?.active ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 rounded-xl">
                <p className="text-green-500 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Currently clocked in
                </p>
                <p className="text-2xl font-bold mt-2">{currentDrive.drive?.name}</p>
                <p className="text-muted-foreground text-sm">{currentDrive.drive?.location}</p>
              </div>
              
              <div className="flex items-center justify-center gap-4 py-6 bg-muted rounded-xl">
                <Clock className="w-8 h-8 text-violet-500" />
                <div className="text-center">
                  <p className="text-4xl font-mono font-bold">{elapsed}</p>
                  <p className="text-sm text-muted-foreground">minutes</p>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={actionLoading}
                className="w-full py-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Clock Out'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">Not currently checked in to any drive.</p>
              <button
                onClick={handleCheckin}
                disabled={actionLoading}
                className="w-full py-4 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Check In (Enter Drive ID)'}
              </button>
            </div>
          )}
        </section>

        <section className="bg-card rounded-2xl border p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Past Drives
          </h2>
          
          {pastDrives.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No past drives yet.</p>
          ) : (
            <div className="space-y-3">
              {pastDrives.map((drive) => (
                <div key={drive.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div>
                    <p className="font-medium">{drive.name}</p>
                    <p className="text-sm text-muted-foreground">{drive.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-violet-500">
                      {formatDuration(drive.duration_minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {drive.duration_minutes ? 'Duration' : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
