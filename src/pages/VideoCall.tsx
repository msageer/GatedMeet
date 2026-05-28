import { JitsiMeeting } from '@jitsi/react-sdk';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function VideoCall() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  if (!id) {
    return <div className="p-8 text-center">Invalid meeting ID</div>;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-950 absolute top-0 left-0 z-50">
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-slate-200 font-medium tracking-tight">Built-in Meeting Room</span>
        </div>
      </div>
      
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      )}
      
      <div className={`flex-1 w-full ${loading ? 'hidden' : 'block'}`}>
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={`serene-meeting-${id}`}
          configOverwrite={{
            startWithAudioMuted: true,
            disableModeratorIndicator: true,
            startScreenSharing: false,
            enableEmailInStats: false
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
          }}
          userInfo={{
            displayName: 'Guest',
            email: 'guest@example.com'
          }}
          onApiReady={(externalApi) => {
            setLoading(false);
            externalApi.addListener('videoConferenceLeft', () => {
              navigate('/dashboard');
            });
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
}
