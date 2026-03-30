import { useState, useEffect } from 'react';
import { Download, LogOut, Users, Clock, Activity, TrendingUp } from 'lucide-react';
import { api } from '@/api';

export function OrganizationDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total_drives: number;
    active_drives: number;
    total_volunteers: number;
    checked_in: number;
    checked_out: number;
    avg_duration_minutes: number;
  } | null>(null);
  const [drives, setDrives] = useState<Array<{
    id: string;
    name: string;
    location: string;
    status: string;
    manager_name: string;
    total_volunteers: number;
    checked_out: number;
    avg_duration_minutes: number | null;
  }>>([]);
  const [managers, setManagers] = useState<Array<{
    id: string;
    mgr_id: string;
    name: string;
    email: string;
  }>>([]);
  const [orgInfo, setOrgInfo] = useState<{ name: string; org_id: string } | null>(null);
  const [showVolunteers, setShowVolunteers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    checked_in_at: string;
    checked_out_at: string;
    duration_minutes: number;
  }>>([]);

  const token = localStorage.getItem('vo_token');
  const orgId = localStorage.getItem('vo_org_id');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!token) return;
    try {
      const [me, statsData, driveList, managerList] = await Promise.all([
        api.organization.me(token),
        api.organization.getStats(token),
        api.organization.getDrives(token),
        api.organization.getManagers(token),
      ]);
      setOrgInfo(me);
      setStats(statsData);
      setDrives(driveList);
      setManagers(managerList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await api.organization.download(token!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `volops_${orgId}_export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewVolunteers = async (driveId: string) => {
    try {
      const volunteers = await api.organization.getVolunteers(token!, driveId);
      setShowVolunteers(volunteers);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <div>
          <h1 className="font-semibold">{orgInfo?.name}</h1>
          <p className="text-sm text-muted-foreground">{orgId}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <section className="grid grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="w-4 h-4" />
              Total Drives
            </div>
            <p className="text-3xl font-bold">{stats?.total_drives}</p>
          </div>
          <div className="bg-card rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              Active
            </div>
            <p className="text-3xl font-bold text-green-500">{stats?.active_drives}</p>
          </div>
          <div className="bg-card rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              Volunteers
            </div>
            <p className="text-3xl font-bold">{stats?.total_volunteers}</p>
          </div>
          <div className="bg-card rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              Avg Duration
            </div>
            <p className="text-3xl font-bold">{formatDuration(stats?.avg_duration_minutes || 0)}</p>
          </div>
        </section>

        <section className="bg-card rounded-2xl border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Site Managers ({managers.length})</h2>
          </div>
          <div className="divide-y">
            {managers.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No managers registered yet.</p>
            ) : (
              managers.map((mgr) => (
                <div key={mgr.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{mgr.name}</p>
                    <p className="text-sm text-muted-foreground">{mgr.email}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{mgr.mgr_id}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-card rounded-2xl border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">All Drives</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b">
                  <th className="p-4 font-medium">Drive</th>
                  <th className="p-4 font-medium">Manager</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Volunteers</th>
                  <th className="p-4 font-medium text-right">Avg Duration</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drives.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No drives yet.
                    </td>
                  </tr>
                ) : (
                  drives.map((drive) => (
                    <tr key={drive.id}>
                      <td className="p-4">
                        <p className="font-medium">{drive.name}</p>
                        <p className="text-sm text-muted-foreground">{drive.location}</p>
                      </td>
                      <td className="p-4 text-sm">{drive.manager_name}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          drive.status === 'active' ? 'bg-green-500/10 text-green-500' :
                          drive.status === 'ended' ? 'bg-muted text-muted-foreground' :
                          'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {drive.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium">{drive.total_volunteers}</td>
                      <td className="p-4 text-right">{formatDuration(drive.avg_duration_minutes)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleViewVolunteers(drive.id)}
                          className="text-sm text-violet-500 hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showVolunteers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Volunteer Details</h3>
              <button onClick={() => setShowVolunteers([])} className="text-muted-foreground">✕</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="text-left sticky top-0 bg-card">
                  <tr className="text-muted-foreground border-b">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Check In</th>
                    <th className="pb-2">Check Out</th>
                    <th className="pb-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {showVolunteers.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2">{v.name}</td>
                      <td className="py-2 text-muted-foreground">{v.email}</td>
                      <td className="py-2">{formatTime(v.checked_in_at)}</td>
                      <td className="py-2">{formatTime(v.checked_out_at)}</td>
                      <td className="py-2 font-medium">{formatDuration(v.duration_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
