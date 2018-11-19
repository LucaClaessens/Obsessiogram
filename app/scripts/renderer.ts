import * as posenet from '@tensorflow-models/posenet';
import { html, render } from 'lit-html';
import { drawKeypoints, drawSkeleton } from './demo_util';
import { CONFIG } from './configuration'


interface ObsessiogramData {
  showExample: boolean;
  templateVisible: boolean | null,
  showVideo: boolean | null,
  text: string | null,
  debugging: boolean | null,
  offset: number | null
}

export class Renderer {

  renderElem: HTMLElement | null;
  voice: SpeechSynthesisVoice;
  sentence: SpeechSynthesisUtterance;
  data: ObsessiogramData;
  dataPrimitive: object;
  videoWidth: 600;
  videoHeight: 500;
  videoStream: any; //idk this one.
  trackingFrames: any;
  net;
  guiState: object;
  movementAwaiting: any;

  constructor() {
    chrome.storage.local.get(['webcamtime', 'fakemovement'], (config) => {
        this.detectMovement = !config.fakemovement || false;
        this.movementAwaiting = false;
        this.movementTimeout = config.webcamtime || 30000;
    })


    this.dataPrimitive = {
      templateVisible: false,
      showVideo: false,
      text: null,
      offset: 0,
      debugging: true
    };
    this.guiState = {
      algorithm: 'single-pose',
      input: {
        mobileNetArchitecture: '0.75',
        outputStride: 16,
        imageScaleFactor: 0.5,
      },
      singlePoseDetection: {
        minPoseConfidence: 0.1,
        minPartConfidence: 0.5,
      },
      multiPoseDetection: {
        maxPoseDetections: 5,
        minPoseConfidence: 0.15,
        minPartConfidence: 0.1,
        nmsRadius: 30.0,
      },
      output: {
        showVideo: true,
        showSkeleton: true,
        showPoints: true,
        showBoundingBox: false,
      },
      net: null,
    };
  }

  HTMLTemplate = (data) => html`
    <div id="videoplayerWrapper" hidden=${!data.templateVisible}>
      <div id="obsessiogram-text" hidden=${data.showVideo}>
        ${data.text}
      </div>
      <div id="videoPlayer" hidden=${!data.showVideo}>
        <video id="video" playsinline style="-moz-transform: scaleX(-1);
                    -o-transform: scaleX(-1);
                    -webkit-transform: scaleX(-1);
                    transform: scaleX(-1);
                    display: none;
                    ">
        </video>
        <canvas id="cvoutput"></canvas>
      </div>
    </div>
    <div class="exampleWrapper" hidden=${!data.showExample}>
          <video id="exampleVideo"></video>
    </div>
    `;

  async setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    this.videoStream = document.getElementById('video');
    this.videoStream.width = 500;
    this.videoStream.height = 600;

    const stream = await navigator.mediaDevices.getUserMedia({
      'audio': false,
      'video': {
        facingMode: 'user',
        width: 500,
        height: 600,
      },
    });
    this.videoStream.srcObject = stream;

    return new Promise((resolve) => {
      this.videoStream.onloadedmetadata = () => {
        resolve(this.videoStream);
      };
    });
  }

  detectPoseInRealTime(video, net) {
    const canvas: any = document.getElementById('cvoutput');
    const ctx = canvas.getContext('2d');
    // since images are being fed from a webcam
    const flipHorizontal = true;

    canvas.width = 500;
    canvas.height = 600;

    async function poseDetectionFrame() {
      const imageScaleFactor = this.guiState.input.imageScaleFactor;
      const outputStride = +this.guiState.input.outputStride;

      let poses = [];
      let minPoseConfidence;
      let minPartConfidence;
      switch (this.guiState.algorithm) {
        case 'single-pose':
          debugger;
          const pose = await this.guiState.net.estimateSinglePose(
            this.videoStream, imageScaleFactor, flipHorizontal, outputStride);
          poses.push(pose);

          minPoseConfidence = +this.guiState.singlePoseDetection.minPoseConfidence;
          minPartConfidence = +this.guiState.singlePoseDetection.minPartConfidence;
          break;
        case 'multi-pose':
          poses = await this.guiState.net.estimateMultiplePoses(
            this.videoStream, imageScaleFactor, flipHorizontal, outputStride,
            this.guiState.multiPoseDetection.maxPoseDetections,
            this.guiState.multiPoseDetection.minPartConfidence,
            this.guiState.multiPoseDetection.nmsRadius);

          minPoseConfidence = +this.guiState.multiPoseDetection.minPoseConfidence;
          minPartConfidence = +this.guiState.multiPoseDetection.minPartConfidence;
          break;
      }

      ctx.clearRect(0, 0, this.videoWidth, this.videoHeight);

      if (this.guiState.output.showVideo) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-500, 0);
        ctx.drawImage(this.videoStream, 0, 0, 500, 600);
        ctx.restore();
      }

      // For each pose (i.e. person) detected in an image, loop through the poses
      // and draw the resulting skeleton and keypoints if over certain confidence
      // scores
      poses.forEach(({ score, keypoints }) => {
        if (score >= minPoseConfidence) {
          if (this.guiState.output.showPoints) {
            drawKeypoints(keypoints, minPartConfidence, ctx);
          }
          if (this.guiState.output.showSkeleton) {
            drawSkeleton(keypoints, minPartConfidence, ctx);
          }
          
        }
      });

      if (this.data.showVideo) requestAnimationFrame(poseDetectionFrame.bind(this));
    }

    if (this.data.showVideo){
      const pd = poseDetectionFrame.bind(this);
      pd();
    }
  }

  monitorMovement(keypoints, minConfidence, marker) {
    for (const keypoint of keypoints) {
      if (keypoint.part != marker) continue;
      this.trackingFrames.push(keypoint.position);
    }

    if (this.trackingFrames.length === CONFIG.frameStackSize) {
      //the movement algorithm
      const sortedXFrames = this.trackingFrames
        .map(f => f.x)
        .sort()
      const lowestX = sortedXFrames[0];
      const highestX = sortedXFrames[sortedXFrames.length - 1]
      const diffX = highestX - lowestX;

      const sortedYFrames = this.trackingFrames
        .map(f => f.y)
        .sort()
      const lowestY = sortedYFrames[0];
      const highestY = sortedYFrames[sortedYFrames.length - 1]
      const diffY = highestY - lowestY;

      console.log(`diffX: ${diffX}, diffY: ${diffY}`);

      if (diffX < 30 && diffY > 50) {
        //moved right eye up pretty straight
        window.dispatchEvent(new CustomEvent('moveMade'));
        setTimeout(() => {
          this.data.showVideo = false;
          this.videoStream.srcObject.getTracks()[0].stop();
        }, 1000);
      }

      this.trackingFrames = [];
    }
  }

  proxyHandler = (object, onChange) => {
    const handler: ProxyHandler<any> = {
      set(obj, prop, value){
        console.log(`[observer] ${prop} => ${value}`)

        obj[prop] = value;
        onChange(prop, value);
        return true;
      },
      get(target, key) {
          return target[key];
      },
      defineProperty(target, property, descriptor) {
        onChange(property, descriptor);
        return Reflect.defineProperty(target, property, descriptor);
      },
      deleteProperty(target, property) {
        onChange(property, null);
        return Reflect.deleteProperty(target, property);
      }
    }
    return new Proxy(object, handler);
  }

  async inject() {
    document.body.innerHTML += `<div id="obsessiogram-app"></div>`
    this.renderElem = document.querySelector('#obsessiogram-app');
    this.initializeSpeech();

    this.data = this.proxyHandler(this.dataPrimitive, 
      (prop, value) => {

        if(prop === 'showVideo'){
          if(value === true){
            this.data.showExample = false;
            this.videoStream.play();
            this.detectPoseInRealTime(this.videoStream, this.guiState.net);
            
            if(!this.movementAwaiting){
              this.movementAwaiting = true;
              window.addEventListener('moveMade', (e) => {
                console.log('waiting for clear');
                this.movementAwaiting = false;             
                setTimeout(() => {
                  console.log('ai clear');
                  this.data.showVideo = false;
                  this.videoStream.srcObject.getTracks()[0].stop();
                }, 1000);
              }, {once: true});   
          }
          } else {
            this.videoStream.pause();
          }
        }

        if(prop === 'text'){
          this.sentence.text = value;
          speechSynthesis.speak(this.sentence);
        }

        render(this.HTMLTemplate(this.dataPrimitive), this.renderElem)
      });

    //initial render.
    render(this.HTMLTemplate(this.dataPrimitive), this.renderElem);

    this.trackingFrames = [];

    this.guiState.net = await posenet.load(0.75);
  }

  initializeSpeech() {
    this.sentence = new SpeechSynthesisUtterance();
    if ('speechSynthesis' in window) {
      let speech_voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        speech_voices = window.speechSynthesis.getVoices();
        this.sentence.voice = speech_voices[49];
        this.sentence.volume = 1;
        this.sentence.rate = 0.85;
        this.sentence.pitch = 0.95;
        this.sentence.lang = 'en-GB';
      };
    }
  }

}