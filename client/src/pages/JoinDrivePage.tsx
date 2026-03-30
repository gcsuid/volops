import { useEffect, useState } from 'react';
import { api } from '@/api';

interface JoinDrivePageProps {
  driveId: string;
  secret: string;
}

export function JoinDrivePage({ driveId, secret }: JoinDrivePageProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [drive, setDrive] = useState<{ id: string; name: string; location: string; status: string } | null>(null);
  const [volunteerId, setVolunteerId] = useState(() => localStorage.getItem('vo_vol_id') || '');

  useEffect(() => {
    let cancelled = false;

    async function loadDrive() {
      try {
        const result = await api.drives.join(driveId, secret);
        if (!cancelled) {
          setDrive(result);
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Unable to load drive');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDrive();
    return () => {
      cancelled = true;
    };
  }, [driveId, secret]);

  const handleRegister = async () => {
    if (!volunteerId.trim()) {
      setMessage('Enter your Volunteer ID to join this drive.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      await api.drives.register(driveId, secret, volunteerId.trim().toUpperCase());
      localStorage.setItem('vo_vol_id', volunteerId.trim().toUpperCase());
      setMessage('Registration successful. Open the volunteer dashboard to check in.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Join Drive</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the drive link or QR code from the site manager to register yourself before check-in.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading drive details...</p>
        ) : drive ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-lg font-medium">{drive.name}</p>
              <p className="text-sm text-muted-foreground">{drive.location || 'Location not provided'}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Status: {drive.status}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Volunteer ID</label>
              <input
                type="text"
                value={volunteerId}
                onChange={(event) => setVolunteerId(event.target.value)}
                placeholder="VOL-XXXXXX"
                className="mt-1 w-full rounded-xl border bg-background p-3 focus:outline-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                If you have already signed in as a volunteer, this fills automatically from local storage.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRegister}
              disabled={submitting}
              className="w-full rounded-xl bg-violet-500 py-3 font-medium text-white disabled:opacity-60"
            >
              {submitting ? 'Registering...' : 'Register for this Drive'}
            </button>
          </div>
        ) : null}

        {message && (
          <div className="mt-4 rounded-xl bg-violet-500/10 p-3 text-sm text-violet-700">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
