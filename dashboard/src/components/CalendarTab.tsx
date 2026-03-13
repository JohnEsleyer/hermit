import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Bell } from 'lucide-react';
import { CalendarEvent, Agent } from '../types';

const API_BASE = '';

interface CalendarTabProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  agents: Agent[];
}

export function CalendarTab({ triggerToast, agents }: CalendarTabProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState({ agentId: 0, date: '', time: '', prompt: '' });
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calendar`);
      if (!res.ok) {
        console.error('Failed to fetch calendar:', res.status);
        setEvents([]);
        return;
      }
      const data = await res.json();
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!newEvent.agentId || !newEvent.date || !newEvent.time || !newEvent.prompt) {
      triggerToast('Please fill all fields', 'error');
      return;
    }
    try {
      await fetch(`${API_BASE}/api/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      triggerToast('Event created');
      setShowCreate(false);
      setNewEvent({ agentId: 0, date: '', time: '', prompt: '' });
      fetchEvents();
    } catch (err) {
      triggerToast('Failed to create event', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this event?')) return;
    try {
      await fetch(`${API_BASE}/api/calendar/${id}`, { method: 'DELETE' });
      triggerToast('Event deleted');
      fetchEvents();
    } catch (err) {
      triggerToast('Failed to delete event', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center mb-6 animate-pulse">
          <CalendarIcon className="w-8 h-8 opacity-50" />
        </div>
        <p className="text-lg font-medium">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="flex justify-between items-center mb-6">
        <p className="text-zinc-400 text-sm">Scheduled events for your agents</p>
        <button 
          onClick={() => setShowCreate(true)}
          className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-zinc-200 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {(!events || events.length === 0) ? (
        <div className="flex flex-col items-center justify-center text-zinc-500 py-20">
          <CalendarIcon className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No scheduled events</p>
          <p className="text-sm">Create an event to schedule agent reminders</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events?.map(event => (
            <div key={event.id} className="bg-black border border-zinc-800 rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center">
                  <Bell className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span className="font-mono text-sm">{event.date} at {event.time}</span>
                    {event.executed && <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">Executed</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">{event.prompt}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(event.id)}
                className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-[2.5rem] p-8">
            <h3 className="text-2xl font-bold mb-6">Create Calendar Event</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Agent</label>
                <select 
                  value={newEvent.agentId}
                  onChange={e => setNewEvent({...newEvent, agentId: parseInt(e.target.value)})}
                  className="w-full bg-black border border-zinc-800 rounded-full px-6 py-3 text-white"
                >
                  <option value={0}>Select agent...</option>
                  {agents?.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Date</label>
                  <input 
                    type="date" 
                    value={newEvent.date}
                    onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-full px-6 py-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Time</label>
                  <input 
                    type="time" 
                    value={newEvent.time}
                    onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                    className="w-full bg-black border border-zinc-800 rounded-full px-6 py-3 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Prompt</label>
                <textarea 
                  value={newEvent.prompt}
                  onChange={e => setNewEvent({...newEvent, prompt: e.target.value})}
                  placeholder="What should the agent do?"
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-3 text-white h-24 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 text-zinc-400 hover:text-white">Cancel</button>
              <button onClick={handleCreate} className="flex-1 bg-white text-black py-3 rounded-full font-bold">Create Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
