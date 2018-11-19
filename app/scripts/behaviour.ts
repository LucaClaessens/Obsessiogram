export class Behaviour{

    //initial state
    config = {};
    configLoaded = false;
    nextClearTime = 0;
    scrollOffsetTotal = 0;
    periodicOffset = 0;
    applicationPaused = false;
    cachedButtons = [];
    likeCount = 0;
    commentCount = 0;

    constructor(){
        chrome.storage.local.get(['duration', 'scrollticks','likecount','commentcount', 'webcamtime', 'fakemovement'], (config) => {
            console.log('config loaded', config);
            this.config = config || {};
            this.configLoaded = true;
            this.nextClearTime = +new Date() + (this.config.duration || 15000);
        })
    }

    resetTimer = (ts: Number) => {
        console.log('Resetting the clear timer');
        this.nextClearTime = +new Date() + (this.config.duration || 15000);
        console.log('set new clear time to', this.nextClearTime);
        this.periodicOffset = 0;
    }

    initialize = () => {
        //schedule a task runner that analyzes scroll behaviour
        this.scheduleRenderCycle();
        if(window.attachEvent) {
            window.attachEvent('onload', this.setupListeners());
        } else {
            if(window.onload) {
                var curronload = window.onload;
                var newonload = function(evt) {
                    curronload(evt);
                    this.setupListeners();
                };
                window.onload = newonload;
            } else {
                window.onload = this.setupListeners;
            }
        }
    }

    listenToLikes = () => {
        const likeButtons = document.querySelectorAll('.UFILikeLink');

        if(likeButtons && likeButtons.length > 0){
            for(const likeButton of Array.from(likeButtons)){
                if(!this.cachedButtons.includes(likeButton)){
                    
                    const clickFunction = () => {
                        console.log('We liked something!');
                        this.likeCount++;
                        if(this.likeCount === (this.config.likecount || 6)){
                            const startObsessiogram = new CustomEvent('showObsessiogram', {detail: "Like"});
                            window.dispatchEvent(startObsessiogram);
                            this.likeCount = 0;     
                        }       
                    }
                    likeButton.addEventListener("click", clickFunction);

                    this.cachedButtons.push(likeButton);
                }
            }
        }
    }

    listenForComments = () => {
        document.addEventListener("keydown", (e) => {
            if (13 == e.keyCode){ //ENTER
                //can we edit?
                const canEdit = document.activeElement.hasAttribute('contentEditable') ||
                document.activeElement.nodeName === "TEXTAREA";
                if(!canEdit) return false;
                
                console.log('We commented!');
                this.commentCount++;
                if(this.commentCount === (this.config.commentcount || 5)){
                    const startObsessiogram = new CustomEvent('showObsessiogram', {detail: "Comment"});
                    window.dispatchEvent(startObsessiogram);
                    this.commentCount = 0;     
                } 
            }
                  
        })
    }

    detectStalking = () => {
        const photoButton = document.querySelector('[data-tab-key="photos"]');
        if(photoButton){
            document.querySelector('[data-tab-key="photos"]').addEventListener("click", () => {
                console.log('We are stalking!');
                const startObsessiogram = new CustomEvent('showObsessiogram', {detail: "Stalking"});
                window.dispatchEvent(startObsessiogram);           
            })
        }
    }

    setupListeners = () => {
        //comment
        this.listenForComments();
        //stalking
        setInterval(() => {
            this.detectStalking();
            this.listenToLikes();
        }, 2500);
        //selife
        chrome.runtime.onMessage.addListener(
            (request, sender, sendResponse) => {
              console.log(sender.tab ?
                          "from a content script:" + sender.tab.url :
                          "from the extension");

              if (request.trigger === "listenForPost"){
                console.log('polling for post button');
                //wait until we press the button
                const buttons = Array.from(document.querySelectorAll('button'));
                for(const button of buttons){
                    const buttonTrigger = () => {
                        const startObsessiogram = new CustomEvent('showObsessiogram', {detail: "Selfie"});
                        window.dispatchEvent(startObsessiogram); 
                        for(const button of buttons){
                            button.removeEventListener("click", buttonTrigger, true); 
                        }
                    }
                    button.addEventListener("click", buttonTrigger); 
                }
              }
                sendResponse({farewell: "goodbye"});
            });       
    }

    scheduleRenderCycle = () => {
        let running = true;
        let lastFrame = +new Date;
        const loop = ( now: any ) => {
            // stop the loop if render returned false
            if ( running !== false ) {
                requestAnimationFrame( loop );
                var deltaT = now - lastFrame;
                // do not render frame when deltaT is too high
                if ( deltaT < 160 ) {
                    running = this.analysis( deltaT );
                }
                lastFrame = now;
            }
        }
        loop( lastFrame );
    }

    scrollListener = (e: Event) => {
        //interpret every scroll event fired as a 'tick'
        //this way we don't have to mess with negative and positive scroll
        this.scrollOffsetTotal += 1;
        this.periodicOffset += 1;
        console.log(`offset: ${this.periodicOffset}`);
    }

    analysis = (delta: Number) => {
        //all of our state analysis goes here
        const now = +new Date();
 
        if(now > this.nextClearTime){
            this.resetTimer(now);
        }
        if(this.periodicOffset > (this.config.scrollticks || 300) && this.configLoaded){
            console.log('periodic offset boundary hit. Showing Obsessiogram');
            const startObsessiogram = new CustomEvent('showObsessiogram', {detail: "Scrolling"});
            window.dispatchEvent(startObsessiogram);
            this.periodicOffset = 0;
            this.resetTimer(now);
        }
 
        return !this.applicationPaused;
     }
         
}