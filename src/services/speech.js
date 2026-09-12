export class SpeechInput {
  constructor(){this.Constructor=window.SpeechRecognition||window.webkitSpeechRecognition;this.active=null;}
  get supported(){return !!this.Constructor;}
  start({onTranscript,onStatus}){
    this.stop();
    if(!this.supported){onStatus('此浏览器不支持语音输入。请打字回答。 / Please type: speech recognition is unavailable in this browser.');return;}
    const r=new this.Constructor();this.active=r;r.lang='zh-CN';r.interimResults=false;r.continuous=false;
    r.onresult=e=>{onTranscript(e.results[0][0].transcript);onStatus('请检查文字，再提交。 / Check the transcript, then submit.');};
    r.onerror=e=>onStatus(e.error==='not-allowed'?'麦克风未获授权。你可以打字。 / Microphone access was denied. You can type instead.':'没有听清，请重试或打字。 / Could not transcribe. Try again or type.');
    r.onend=()=>{if(this.active===r)this.active=null;};
    try{r.start();onStatus('正在听… / Listening…');}catch{onStatus('语音输入暂时不可用，请打字。 / Speech input is unavailable; please type.');}
  }
  stop(){if(this.active){this.active.onresult=null;this.active.onerror=null;this.active.abort();this.active=null;}}
}
