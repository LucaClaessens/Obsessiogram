// Enable chromereload by uncommenting this line:
//import 'chromereload/devonly'
import { Obsessiogram } from './Obsessiogram';
import youtubeBase from './youtube-iframe-api';
import youtubeApi from './youtube-widget-api';

const obsessiogram =  new Obsessiogram();
obsessiogram.initialize();


window.onYouTubeIframeAPIReady = function() {
    console.log('YT', YT);
    obsessiogram.player = new YT.Player('exampleVideo', {
    height: '400',
    width: '700',
    videoId: '',
    playerVars: {
      showinfo: 0,
      autoplay: 1,
      controls: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      rel: 1
    },
    events: {
      'onReady': obsessiogram.onPlayerReady,
      'onStateChange': obsessiogram.onPlayerStateChange
    }
    });
};

youtubeBase();
youtubeApi();

