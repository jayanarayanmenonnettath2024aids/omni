import React, { useEffect, useRef, useState } from 'react';
import { Mic, Radio, Power, Loader2 } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';

const parseApiError = (payload, fallbackText) => {
  if (!payload) return fallbackText;

  const detail = payload.detail ?? payload.error ?? payload;
  if (typeof detail === 'string' && detail.trim()) return detail;

  if (typeof detail === 'object') {
    const message = typeof detail.message === 'string' ? detail.message : fallbackText;
    const attempts = Array.isArray(detail.attempts) ? detail.attempts : [];
    if (!attempts.length) {
      return message;
    }

    const formattedAttempts = attempts
      .slice(0, 2)
      .map((a) => {
        const status = a?.status ?? 'error';
        const url = a?.url || 'unknown-url';
        return `${status} @ ${url}`;
      })
      .join(' | ');

    return `${message}. Attempts: ${formattedAttempts}`;
  }

  return fallbackText;
};

const LiveVoiceAgentView = () => {
  const [liveAgentState, setLiveAgentState] = useState({
    status: 'idle',
    roomName: '',
    message: '',
  });

  const liveRoomRef = useRef(null);
  const liveAgentStateRef = useRef({ roomName: '' });
  const remoteAudioContainerRef = useRef(null);

  useEffect(() => {
    liveAgentStateRef.current = liveAgentState;
  }, [liveAgentState]);

  useEffect(() => {
    return () => {
      if (liveRoomRef.current) {
        try {
          liveRoomRef.current.disconnect();
        } catch (_e) {
          // no-op
        }
      }
    };
  }, []);

  const attachRemoteAudio = (track, participantName) => {
    if (track.kind !== Track.Kind.Audio || !remoteAudioContainerRef.current) return;
    const element = track.attach();
    element.autoplay = true;
    element.dataset.participant = participantName || 'remote-agent';
    remoteAudioContainerRef.current.appendChild(element);
  };

  const detachRemoteAudio = (track) => {
    track.detach().forEach((element) => element.remove());
  };

  const endLiveVoiceAgent = async () => {
    const activeRoomName = liveAgentStateRef.current.roomName;
    setLiveAgentState((prev) => ({ ...prev, status: 'ending', message: 'Ending live voice session...' }));

    try {
      if (liveRoomRef.current) {
        liveRoomRef.current.disconnect();
        liveRoomRef.current = null;
      }

      if (activeRoomName) {
        const response = await fetch('/api/voice-agent/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_name: activeRoomName }),
        });

        if (!response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch (_e) {
            payload = null;
          }
          throw new Error(parseApiError(payload, 'Unable to end live voice session.'));
        }
      }

      setLiveAgentState({ status: 'idle', roomName: '', message: 'Live voice session ended.' });
    } catch (error) {
      setLiveAgentState({ status: 'error', roomName: activeRoomName || '', message: error?.message || 'Unable to end live voice session.' });
    }
  };

  const startLiveVoiceAgent = async () => {
    if (liveAgentState.status === 'starting' || liveAgentState.status === 'connected') {
      return;
    }

    setLiveAgentState({ status: 'starting', roomName: '', message: 'Starting live voice agent...' });

    try {
      const response = await fetch('/api/voice-agent/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_e) {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(parseApiError(payload, 'Unable to start live voice session.'));
      }

      const roomUrl =
        payload?.livekitUrl ||
        payload?.liveKitUrl ||
        payload?.url ||
        payload?.wsUrl ||
        payload?.roomUrl ||
        payload?.data?.livekitUrl ||
        payload?.data?.url ||
        payload?.data?.wsUrl;
      const token = payload?.userToken || payload?.token || payload?.accessToken || payload?.data?.userToken || payload?.data?.token;
      const roomName = payload.roomName || payload.room_name || '';

      if (!roomUrl || !token) {
        throw new Error('Voice agent response is missing room URL or token.');
      }

      const room = new Room();
      room
        .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          attachRemoteAudio(track, participant?.identity);
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          detachRemoteAudio(track);
        })
        .on(RoomEvent.Disconnected, () => {
          liveRoomRef.current = null;
          setLiveAgentState((prev) => ({ ...prev, status: 'idle', message: prev.message || 'Live voice session disconnected.' }));
        });

      await room.connect(roomUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      liveRoomRef.current = room;

      setLiveAgentState({
        status: 'connected',
        roomName,
        message: roomName ? `Connected to room ${roomName}` : 'Connected to live voice agent.',
      });
    } catch (error) {
      if (liveRoomRef.current) {
        try {
          liveRoomRef.current.disconnect();
        } catch (_e) {
          // no-op
        }
        liveRoomRef.current = null;
      }
      setLiveAgentState({ status: 'error', roomName: '', message: error?.message || 'Unable to connect to live voice agent.' });
    }
  };

  return (
    <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-corp-dark tracking-tight leading-none mb-3 flex items-center gap-3">
            <span className="text-indigo-600">Lyzr</span> Live Voice Agent
            <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-indigo-200">Voice</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium">Dedicated LiveKit-backed voice room isolated from the AI Assistant chat experience.</p>
        </div>
      </div>

      <div className="bg-white border border-corp-border rounded-[2rem] enterprise-shadow p-8">
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Radio size={22} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Live Voice Agent</div>
              <div className="text-sm font-bold text-slate-700">Start a separate real-time voice session via backend-proxied Lyzr API.</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{liveAgentState.message || 'Use this for a parallel live voice room, independent of the built-in assistant voice mode.'}</div>
            </div>
          </div>
          <div className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${liveAgentState.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : liveAgentState.status === 'error' ? 'bg-red-50 text-red-700 border-red-200' : liveAgentState.status === 'starting' || liveAgentState.status === 'ending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            {liveAgentState.status}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={startLiveVoiceAgent}
            disabled={liveAgentState.status === 'starting' || liveAgentState.status === 'connected'}
            className="w-full rounded-2xl px-5 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
          >
            {liveAgentState.status === 'starting' ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            {liveAgentState.status === 'starting' ? 'Starting...' : 'Start Live Session'}
          </button>

          <button
            onClick={endLiveVoiceAgent}
            disabled={liveAgentState.status !== 'connected'}
            className="w-full rounded-2xl px-5 py-4 bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Power size={16} />
            End Live Session
          </button>
        </div>

        {liveAgentState.roomName && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
            Active Room: {liveAgentState.roomName}
          </div>
        )}

        <div ref={remoteAudioContainerRef} className="hidden" />
      </div>
    </div>
  );
};

export default LiveVoiceAgentView;