import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, CircleDot, StopCircle } from 'lucide-react';
import { db, storage, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, collection, addDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

export default function VideoCall() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Media State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingRecord, setUploadingRecord] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const roomCreated = useRef(false);

  useEffect(() => {
    if (!id) return;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setLoading(false);
        setupWebRTC(stream);
      } catch (err) {
        console.error("Error accessing media devices", err);
        setLoading(false);
        toast.error("Could not access camera/microphone.");
      }
    };
    init();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      peerConnection.current?.close();
    };
  }, [id]);

  const setupWebRTC = async (stream: MediaStream) => {
    if (!id) return;
    const roomRef = doc(db, 'bookings', id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      toast.error("Meeting room does not exist.");
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
      ]
    });
    peerConnection.current = pc;

    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote tracks
    const rStream = new MediaStream();
    setRemoteStream(rStream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = rStream;
    }

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        rStream.addTrack(track);
      });
    };

    const offerCandidates = collection(roomRef, 'offerCandidates');
    const answerCandidates = collection(roomRef, 'answerCandidates');

    const uid = auth.currentUser?.uid;
    const booking = roomSnap.data();
    const isCreator = booking.creatorId === uid;

    if (isCreator || !booking.offer) {
      roomCreated.current = true;
      // Creator makes offer
      pc.onicecandidate = event => {
        if (event.candidate) {
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });

      onSnapshot(roomRef, snapshot => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answer = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answer);
        }
      });

      onSnapshot(answerCandidates, snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });
    } else {
      // Client answers
      pc.onicecandidate = event => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON());
        }
      };

      const offer = booking.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

      onSnapshot(offerCandidates, snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !audioEnabled);
      setAudioEnabled(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !videoEnabled);
      setVideoEnabled(!videoEnabled);
    }
  };

  const startRecording = () => {
    if (!remoteStream || remoteStream.getTracks().length === 0) {
      toast.error("No remote video to record yet.");
      return;
    }
    
    // Combine local and remote streams for recording (basic combining)
    // Actually standard way is to record either local or remote.
    // Let's just record the remote stream for the creator.
    setIsRecording(true);
    recordedChunks.current = [];
    
    const options = { mimeType: 'video/webm; codecs=vp9' };
    let recorder;
    try {
      recorder = new MediaRecorder(remoteStream, options);
    } catch (e) {
      recorder = new MediaRecorder(remoteStream);
    }
    
    mediaRecorder.current = recorder;
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };
    
    recorder.start();
    toast.success("Recording started");
  };

  const stopRecording = async () => {
    if (mediaRecorder.current && isRecording) {
      setIsRecording(false);
      setUploadingRecord(true);
      toast.info("Saving recording...");
      
      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        if (id) {
          try {
            const recordingRef = ref(storage, `recordings/${id}-${Date.now()}.webm`);
            await uploadBytes(recordingRef, blob);
            const downloadUrl = await getDownloadURL(recordingRef);
            
            await updateDoc(doc(db, 'bookings', id), {
              recordingUrl: downloadUrl
            });
            toast.success("Recording saved successfully!");
          } catch (e) {
             console.error("Recording save failed", e);
             toast.error("Failed to save recording to cloud.");
             // Fallback local download
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url;
             a.download = `Meeting-${id}.webm`;
             a.click();
          } finally {
            setUploadingRecord(false);
            recordedChunks.current = [];
          }
        }
      };
      mediaRecorder.current.stop();
    }
  };

  const endCall = () => {
    if (isRecording) {
      stopRecording().then(() => navigate(-1));
    } else {
      navigate(-1);
    }
  }

  if (!id) {
    return <div className="p-8 text-center text-white bg-slate-950 h-screen">Invalid meeting ID</div>;
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-950 absolute top-0 left-0 z-50 overflow-hidden">
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shadow-md relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={endCall} className="text-white hover:bg-slate-800 rounded-full h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-white font-semibold text-lg tracking-tight">Platform Meeting</span>
          {isRecording && <span className="flex items-center gap-2 text-red-500 font-bold bg-red-500/10 px-3 py-1 rounded-full animate-pulse border border-red-500/30 text-xs uppercase tracking-widest"><CircleDot className="w-3 h-3"/> Rec</span>}
          {uploadingRecord && <span className="text-sm text-slate-400 animate-pulse">Saving Recording...</span>}
        </div>
      </div>
      
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          <p className="text-slate-400 font-medium">Accessing camera...</p>
        </div>
      )}
      
      <div className={`flex-1 relative ${loading ? 'hidden' : 'block'} bg-black`}>
         {/* Remote Video Container */}
         <video 
           ref={remoteVideoRef} 
           autoPlay 
           playsInline
           className="w-full h-full object-cover"
         />
         {!remoteStream?.active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <VideoOff className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-white text-lg font-bold">Waiting for others to join...</p>
              <p className="text-slate-400 mt-2">They will appear here once connected.</p>
            </div>
         )}
         
         {/* Local Video Thumbnail (PiP) */}
         <div className="absolute bottom-24 right-6 w-32 md:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl z-20">
           <video 
             ref={localVideoRef} 
             autoPlay 
             playsInline 
             muted 
             className={`w-full h-full object-cover ${!videoEnabled && 'hidden'}`}
           />
           {!videoEnabled && (
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <VideoOff className="w-6 h-6 text-slate-500" />
              </div>
           )}
         </div>

         {/* Controls Drawer */}
         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-8 py-4 rounded-full border border-slate-700 shadow-2xl z-30">
            <Button 
              variant={audioEnabled ? 'secondary' : 'destructive'} 
              size="icon" 
              className={`rounded-full w-14 h-14 ${audioEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : ''}`}
              onClick={toggleAudio}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </Button>
            <Button 
               variant={videoEnabled ? 'secondary' : 'destructive'} 
               size="icon" 
               className={`rounded-full w-14 h-14 ${videoEnabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : ''}`}
               onClick={toggleVideo}
            >
              {videoEnabled ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </Button>
            
            <div className="w-px h-10 bg-slate-700 mx-2"></div>
            
            {!isRecording ? (
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full w-14 h-14 bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                onClick={startRecording}
                title="Record Session"
              >
                <CircleDot className="w-6 h-6 text-red-400" />
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full w-14 h-14 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50"
                onClick={stopRecording}
                title="Stop Recording"
              >
                <StopCircle className="w-6 h-6" />
              </Button>
            )}
            
            <div className="w-px h-10 bg-slate-700 mx-2"></div>

            <Button 
              variant="destructive" 
              size="icon" 
              className="rounded-full w-14 h-14 shadow-lg hover:bg-red-600"
              onClick={endCall}
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
         </div>
      </div>
    </div>
  );
}
