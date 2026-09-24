import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize, Minimize } from 'lucide-react';

export const MeetingControls = ({
  isMicMuted,
  onToggleMic,
  isVideoEnabled,
  onToggleVideo,
  onEndCall,
  isFullscreen,
  onToggleFullscreen
}) => {
  return (
    <div className="flex items-center justify-center gap-4 px-6 py-3 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl">
      <button
        onClick={onToggleMic}
        className={`p-3.5 rounded-xl transition-all duration-200 ${
          isMicMuted
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
            : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
        }`}
        title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
      >
        {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      <button
        onClick={onToggleVideo}
        className={`p-3.5 rounded-xl transition-all duration-200 ${
          !isVideoEnabled
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
            : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
        }`}
        title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
      >
        {!isVideoEnabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      </button>

      <button
        onClick={onEndCall}
        className="px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-rose-600/30"
      >
        <PhoneOff className="w-5 h-5" />
        <span>End Call</span>
      </button>

      <button
        onClick={onToggleFullscreen}
        className="p-3.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-all duration-200"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default MeetingControls;
