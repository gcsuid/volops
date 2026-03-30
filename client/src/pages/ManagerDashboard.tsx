import { useState, useEffect } from 'react';
import { Plus, Play, StopCircle, LogOut, Clock } from 'lucide-react';
import { api } from '@/api';

export function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [drives, setDrives] = useState<Array<{
    id: string;
    name: string;
    location: string;
    status: string;
    total_volunteers: number;
    checked_in: number;
    checked_out: number;
    avg_duration_minutes: number | null;
  }>>([]);
  const [manager, setManager] = useState<{ name: string; mgr_id: string; org: { name: string } } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showQR, setShowQR] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [showVolunteers, setShowVolunteers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    checked_in_at: string;
    checked_out_at: string;
    duration_minutes: number;
  }>>([]);
  const [newDrive, setNewDrive] = useState({ name: '', location: '', description: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const token = localStorage.getItem('vo_token');
  const mgrId = localStorage.getItem('vo_mgr_id');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!token) return;
    try {
      const [me, driveList] = await Promise.all([
        api.manager.me(token),
        api.manager.getDrives(token),
      ]);
      setManager(me);
      setDrives(driveList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.manager.createDrive(token!, newDrive);
      setShowCreate(false);
      setNewDrive({ name: '', location: '', description: '' });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoading(true);
    try {
      const result = await api.manager.startDrive(token!, id);
      setShowQR({ id, name: drives.find(d => d.id === id)?.name || '', secret: result.qr_secret });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm('End this drive? All checked-in volunteers will be auto clocked out.')) return;
    setActionLoading(true);
    try {
      await api.manager.endDrive(token!, id);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewVolunteers = async (id: string) => {
    try {
      const volunteers = await api.manager.getVolunteers(token!, id);
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

  const getQRUrl = (driveId: string, secret: string) => {
    return `${window.location.origin}/join.html?drive=${driveId}&secret=${secret}`;
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
          <h1 className="font-semibold">{manager?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {manager?.org.name} • {mgrId}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Drive
          </button>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <section className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-2xl border p-4">
            <p className="text-sm text-muted-foreground">Total Drives</p>
            <p className="text-3xl font-bold">{drives.length}</p>
          </div>
          <div className="bg-card rounded-2xl border p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-3xl font-bold text-green-500">
              {drives.filter(d => d.status === 'active').length}
            </p>
          </div>
          <div className="bg-card rounded-2xl border p-4">
            <p className="text-sm text-muted-foreground">Total Volunteers</p>
            <p className="text-3xl font-bold">
              {drives.reduce((sum, d) => sum + d.total_volunteers, 0)}
            </p>
          </div>
        </section>

        <section className="bg-card rounded-2xl border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Your Drives</h2>
          </div>
          <div className="divide-y">
            {drives.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No drives yet. Create your first drive!</p>
            ) : (
              drives.map((drive) => (
                <div key={drive.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{drive.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        drive.status === 'active' ? 'bg-green-500/10 text-green-500' :
                        drive.status === 'ended' ? 'bg-muted text-muted-foreground' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {drive.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{drive.location}</p>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{drive.total_volunteers} volunteers</span>
                      {drive.avg_duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(drive.avg_duration_minutes)} avg
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewVolunteers(drive.id)}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                    >
                      View
                    </button>
                    {drive.status === 'draft' && (
                      <button
                        onClick={() => handleStart(drive.id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                    )}
                    {drive.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleEnd(drive.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <StopCircle className="w-4 h-4" />
                          End
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Drive</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Drive Name *</label>
                <input
                  type="text"
                  value={newDrive.name}
                  onChange={(e) => setNewDrive({ ...newDrive, name: e.target.value })}
                  className="w-full mt-1 p-3 rounded-xl border bg-background"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Location</label>
                <input
                  type="text"
                  value={newDrive.location}
                  onChange={(e) => setNewDrive({ ...newDrive, location: e.target.value })}
                  className="w-full mt-1 p-3 rounded-xl border bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Description</label>
                <textarea
                  value={newDrive.description}
                  onChange={(e) => setNewDrive({ ...newDrive, description: e.target.value })}
                  className="w-full mt-1 p-3 rounded-xl border bg-background"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-violet-500 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold mb-2">{showQR.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Scan to check in</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getQRUrl(showQR.id, showQR.secret))}`}
              alt="QR Code"
              className="mx-auto rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-4 break-all">
              {getQRUrl(showQR.id, showQR.secret)}
            </p>
            <button
              onClick={() => setShowQR(null)}
              className="mt-6 w-full py-3 border rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showVolunteers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Volunteers</h3>
              <button onClick={() => setShowVolunteers([])} className="text-muted-foreground">✕</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="text-muted-foreground">
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
