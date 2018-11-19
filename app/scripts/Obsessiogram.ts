import { Behaviour } from './behaviour';
import { Renderer } from './renderer';
import { resolve } from 'url';
import { Scrolling, Like, Comment, Stalking, Selfie } from './configuration' 

export class Obsessiogram{

    private behaviourListener;
    private renderer;
    private debugging = true;
    private active = false;
    private firstLoad = true;
    player;

    constructor(){
        // Test via a getter in the options object to see if the passive property is accessed
        var supportsPassive = false;
        try {
        var opts = Object.defineProperty({}, 'passive', {
            get: function() {
            supportsPassive = true;
            }
        });
        window.addEventListener("testPassive", (e) => e, opts);
        window.removeEventListener("testPassive", (e) => e, opts);
        } catch (e) {}      

        this.behaviourListener = new Behaviour();
        this.renderer = new Renderer();

        // Use our detect's results. passive applied if supported, capture will be false either way.
        document.addEventListener('scroll', 
            this.behaviourListener.scrollListener,
            supportsPassive ? { passive: true } : false
        ); 

    }

    initialize(){
        console.log(`[YOU ARE ON FACEBOOK] Initializing Obsessiogram 😱.`);
        this.behaviourListener.initialize();        
        this.renderer.inject();

        window.addEventListener('showObsessiogram', (e) => {
            if(this.active) return false;
            this.active = true;

            this.runSequence(e.detail);
            this.disableScrolling();
        })

        window.addEventListener('hideObsessiogram', () => {
            this.active = false;
            this.renderer.data.templateVisible = false;  
            this.enableScrolling();
        })   

    }

    getSequence(sequence){
        return new Promise((res, rej) => {
            switch(sequence){
                case "Like":
                res(Like);
                case "Scrolling":
                res(Scrolling);
                case "Comment":
                res(Comment);
                case "Stalking":
                res(Stalking);
                case "Selfie":
                res(Selfie);
            }
        })
    }

    runSequence(sequence){
        const backgroundElem = document.querySelector('#videoplayerWrapper');
        const textElem = document.querySelector('#obsessiogram-text');
        
        var bgShow = [
            { opacity: 0},
            { opacity: 1, easing: 'ease-in'}
        ]

        var bgHide = [
            { opacity: 1},
            { opacity: 0, easing: 'ease-out'}
        ]

        var textShow = [
            { 
              transform: 'translateY(-1000px) scaleY(2.5) scaleX(.2)', 
              transformOrigin: '50% 0', filter: 'blur(40px)', opacity: 0 
            },
            { 
              transform: 'translateY(0) scaleY(1) scaleX(1)',
              transformOrigin: '50% 50%',
              filter: 'blur(0)',
              opacity: 1 
            }
          ];

        var textHide = [
            { 
                transform: 'translateY(0) scaleY(1) scaleX(1)',
                transformOrigin: '50% 50%',
                filter: 'blur(0)',
                opacity: 1 
            },
            { 
              transform: 'translateY(1000px) scaleY(2.5) scaleX(.2)', 
              transformOrigin: '50% 0', filter: 'blur(40px)', opacity: 0 
            },
          ];

                  
        const displayText = (text) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    this.renderer.data.text = text;  
                    textElem.animate(textShow as any, { duration: 700, fill: "forwards"}); 
                    setTimeout(() => {
                        textElem.animate(textHide as any, { duration: 700, fill: "forwards"});
                        setTimeout(() => resolve(), 1500);
                    }, (text.length * 90));
                }, 1000)
            })
        }      
        this.renderer.data.templateVisible = true; 
        this.renderer.setupCamera();
        backgroundElem.animate(bgShow as any, { duration: 500, fill: "forwards"});

        return this.getSequence(sequence).then(sequenceData => {
            return displayText(sequenceData[0].content)
            .then(done => displayText(sequenceData[1].content))
            .then(done => {
                chrome.runtime.sendMessage({videoId: sequenceData[2].videoId}, function(response) {
                    //here we know the message is sent and the timeout for the next item can be polled.
                });
                return displayText("Obsessiogram will show you the move.")
            })
            .then(done => this.showExample(sequenceData[2].videoId))
            .then(done => this.finishMovement(sequenceData[2].timeout))
            .then(done => displayText("Movement completed!"))
            .then(done => {
                backgroundElem.animate(bgHide as any, { duration: 500, fill: "forwards"});
                setTimeout(() => {
                    const finish = new CustomEvent('hideObsessiogram');
                    return window.dispatchEvent(finish);
                }, 500);
            })
        })
    }

    onPlayerReady(event) {
        var player = event.target;
        event.target.mute();
        event.target.a.setAttribute('muted', true);
        event.target.a.setAttribute('playsinline', true);
      }

      onPlayerStateChange(event) {
        console.log(`player State == ${event.data} `);
        if(event.data === window.YT.PlayerState.ENDED){
          //document.exitPictureInPicture();
          window.dispatchEvent(new CustomEvent('exampleFinished'));
          document.querySelector('#exampleVideo').classList.add('hide');
        }
        
        if(event.data === window.YT.PlayerState.PLAYING){
          //document.querySelector('#exampleVideo').requestPictureInPicture();
          document.querySelector('#exampleVideo').classList.remove('hide');
        }
      }

    showExample(videoId){
        this.renderer.data.showExample = true;
        this.initVideo(videoId);
        return new Promise((resolve, reject) => {
            window.addEventListener('exampleFinished', (e) => {             
                resolve(true);
              }, {once: true}); 
        })  

    }

    finishMovement(timeout){

        const videoElem = document.querySelector('#videoPlayer');

        var videoShow= [
            { opacity: 0, filter: 'blur(40px)'},
            { opacity: 1, filter: 'blur(0)', easing: 'ease-in'}
        ]

        var videoHide = [
            { opacity: 1, filter: 'blur(0)'},
            { opacity: 0, filter: 'blur(40px)', easing: 'ease-out'}
        ]

        this.renderer.data.showVideo = true;
        videoElem.animate(videoShow as any, { duration: 700, fill: "forwards"});


        return new Promise((resolve, reject) => {
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('moveMade'));
                videoElem.animate(videoHide as any, { duration: 700, fill: "forwards"});
                resolve();
            }, timeout * 1000);
        }) 
    }

    initVideo(id) {

        if(this.player){
          this.player.loadVideoById(id);
          return false;
        }
      }

    disableScrolling(){
        var x=window.scrollX;
        var y=window.scrollY;
        window.onscroll=function(){window.scrollTo(x, y);};
    }
    
    enableScrolling(){
        window.onscroll=function(){};
    }

    destroy(){
        const videoNode = document.querySelector('#videoPlayer');
        videoNode.parentNode.removeChild(videoNode);
    }

}